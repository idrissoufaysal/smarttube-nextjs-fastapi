import asyncio
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone

from app.config.settings import settings

# Registre d'événements pour synchroniser les indexations en cours
_indexing_events: dict[str, asyncio.Event] = {}
_indexing_lock = asyncio.Lock()


async def wait_for_indexing_if_active(video_id: str, timeout: float = 8.0) -> bool:
    """
    Si une indexation Pinecone est en cours pour cette vidéo (ex: tâche de fond),
    attend sa finalisation jusqu'à timeout secondes.
    Retourne True si une attente a eu lieu avec succès, False sinon.
    """
    async with _indexing_lock:
        event = _indexing_events.get(video_id)
    if event and not event.is_set():
        print(f"[VectorStore Sync] Indexation en cours pour '{video_id}', mise en attente de la recherche RAG...")
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            print(f"[VectorStore Sync] Indexation terminée pour '{video_id}', poursuite de la recherche.")
            return True
        except asyncio.TimeoutError:
            print(f"[VectorStore Sync] Timeout ({timeout}s) atteint en attendant l'indexation de '{video_id}'.")
            return False
    return False


def get_embeddings() -> OpenAIEmbeddings:
    """
    Initialise les embeddings compatibles avec OpenRouter ou OpenAI direct.
    """
    if settings.AI_KEY:
        return OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            openai_api_key=settings.AI_KEY,
            openai_api_base="https://openrouter.ai/api/v1",
            check_embedding_ctx_length=False,
            model_kwargs={"extra_body": {"encoding_format": "float"}},
            default_headers={
                "HTTP-Referer": "https://smarttube.example.com",
                "X-Title": "SmartTube AI",
            },
        )
    return OpenAIEmbeddings(
        model=settings.EMBEDDING_MODEL,
        openai_api_key=settings.OPENAI_API_KEY,
    )


def get_pinecone_client() -> Pinecone:
    return Pinecone(api_key=settings.PINECONE_API_KEY)


def get_vector_store(video_id: str) -> PineconeVectorStore:
    """
    Retourne l'instance LangChain PineconeVectorStore isolée par namespace (video_id).
    """
    embeddings = get_embeddings()
    return PineconeVectorStore(
        index_name=settings.PINECONE_INDEX,
        embedding=embeddings,
        namespace=video_id,
        pinecone_api_key=settings.PINECONE_API_KEY,
        
    )


async def index_transcript_segments(video_id: str, segments: list[dict]) -> int:
    """
    Regroupe les segments en blocs sémantiques de ~1000 caractères avec timestamps,
    découpe avec RecursiveCharacterTextSplitter et indexe dans Pinecone.
    Gère la synchronisation pour éviter les concurrences et permettre au RAG d'attendre.
    """
    if not segments:
        return 0

    async with _indexing_lock:
        if video_id in _indexing_events:
            event = _indexing_events[video_id]
        else:
            event = asyncio.Event()
            _indexing_events[video_id] = event

    try:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )

        grouped_docs: list[Document] = []
        current_text = ""
        current_start = 0.0
        current_duration = 0.0

        for i, seg in enumerate(segments):
            if not current_text:
                current_start = float(seg.get("start", 0))

            seg_text = seg.get("text", "")
            current_text += (" " if current_text else "") + seg_text
            current_duration += float(seg.get("duration", 0))

            # Dès qu'on atteint la taille cible ou la fin de la vidéo
            if len(current_text) >= 1000 or i == len(segments) - 1:
                grouped_docs.append(
                    Document(
                        page_content=current_text,
                        metadata={
                            "videoId": video_id,
                            "start": current_start,
                            "duration": current_duration,
                        },
                    )
                )
                current_text = ""
                current_duration = 0.0

        splits = splitter.split_documents(grouped_docs)
        if splits:
            vector_store = get_vector_store(video_id)
            # add_documents synchronise vers Pinecone
            vector_store.add_documents(splits)
            print(f"[Pinecone] {len(splits)} chunks indexés dans le namespace '{video_id}'")

            # Tracer l'indexation dans Langfuse
            try:
                from app.services.langfuse_client import get_langfuse_client, flush_langfuse
                lf = get_langfuse_client()
                if lf:
                    trace = lf.trace(
                        name="index-transcript-segments",
                        session_id=video_id,
                        tags=["indexing", "pinecone", "embeddings"],
                        metadata={
                            "video_id": video_id,
                            "chunk_count": len(splits),
                            "segment_count": len(segments),
                            "chunk_size": 1000,
                            "chunk_overlap": 200,
                        },
                    )
                    trace.span(
                        name="pinecone-upsert",
                        metadata={"chunks": len(splits)},
                    )
                    flush_langfuse()
            except Exception as lf_err:
                print(f"[Langfuse Indexing] Notice: {lf_err}")

        return len(splits) if splits else 0
    finally:
        event.set()
        async with _indexing_lock:
            if _indexing_events.get(video_id) is event:
                _indexing_events.pop(video_id, None)


async def similarity_search_rag(video_id: str, query: str, k: int = 5) -> str:
    """
    Effectue une recherche par similarité dans le namespace de la vidéo
    et formate les résultats avec les marqueurs temporels [Timeline: mm:ss].
    Attend automatiquement si une indexation est déjà en cours pour cette vidéo.
    """
    try:
        # Attendre que l'indexation se termine si elle est en cours
        await wait_for_indexing_if_active(video_id)

        vector_store = get_vector_store(video_id)
        docs = vector_store.similarity_search(query, k=k)

        formatted_chunks: list[str] = []
        for doc in docs:
            start_val = float(doc.metadata.get("start", 0))
            # Normalisation en secondes
            start_sec = int(start_val / 1000) if start_val > 10000 else int(start_val)
            mins = start_sec // 60
            secs = start_sec % 60
            timestamp_str = f"{mins:02d}:{secs:02d}"

            formatted_chunks.append(f"[Timeline: {timestamp_str}]\n{doc.page_content}")

        return "\n\n".join(formatted_chunks)
    except Exception as e:
        print(f"[VectorStore RAG] Erreur de recherche: {e}")
        return ""


async def delete_video_vectors(video_id: str) -> None:
    """
    Supprime tous les vecteurs du namespace correspondant à la vidéo.
    """
    try:
        pc = get_pinecone_client()
        index = pc.Index(settings.PINECONE_INDEX)
        index.delete(delete_all=True, namespace=video_id)
        print(f"[Pinecone] Namespace '{video_id}' supprimé avec succès.")
    except Exception as e:
        print(f"[Pinecone] Erreur suppression namespace '{video_id}': {e}")
