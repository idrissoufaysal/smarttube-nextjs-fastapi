from typing import TYPE_CHECKING

import asyncio
import math

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone
from langfuse import observe

from app.config.settings import settings
from app.services.rerank import rerank_documents

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


_bm25_encoder = None
_bm25_unavailable = False


def get_bm25_encoder():
    """
    Retourne l'encodeur BM25 pré-entraîné (pinecone-text) pour la branche sparse
    du hybrid search. Singleton lazy ; en cas d'échec (ex: hors-ligne), le RAG
    bascule proprement sur la recherche dense seule.
    """
    global _bm25_encoder, _bm25_unavailable
    if _bm25_unavailable:
        return None
    if _bm25_encoder is None:
        try:
            from pinecone_text.sparse import BM25Encoder

            _bm25_encoder = BM25Encoder.default()
        except Exception as e:
            print(f"[VectorStore] BM25 indisponible ({e}) — recherche en mode dense seul.")
            _bm25_unavailable = True
            return None
    return _bm25_encoder


def get_embeddings() -> OpenAIEmbeddings:
    """
    Initialise les embeddings compatibles avec OpenRouter ou OpenAI direct.
    Si text-embedding-3 est utilisé, projette en EMBEDDING_DIMENSIONS (1536)
    pour matcher la dimension de l'index Pinecone.
    """
    is_v3 = "text-embedding-3" in settings.EMBEDDING_MODEL.lower()
    dimensions = settings.EMBEDDING_DIMENSIONS if is_v3 else None

    if settings.AI_KEY:
        kwargs = {
            "model": settings.EMBEDDING_MODEL,
            "openai_api_key": settings.AI_KEY,
            "openai_api_base": "https://openrouter.ai/api/v1",
            "check_embedding_ctx_length": False,
            "default_headers": {
                "HTTP-Referer": "https://smarttube.example.com",
                "X-Title": "SmartTube AI",
            },
        }
        if dimensions:
            kwargs["dimensions"] = dimensions
        return OpenAIEmbeddings(**kwargs)

    kwargs = {
        "model": settings.EMBEDDING_MODEL,
        "openai_api_key": settings.OPENAI_API_KEY,
    }
    if dimensions:
        kwargs["dimensions"] = dimensions
    return OpenAIEmbeddings(**kwargs)


def get_pinecone_client() -> Pinecone:
    return Pinecone(api_key=settings.PINECONE_API_KEY)


def get_pinecone_index():
    """
    Retourne l'index Pinecone brut. L'isolation par vidéo se fait via le
    namespace (= video_id), utilisé à l'upsert comme à la recherche.
    """
    pc = get_pinecone_client()
    return pc.Index(settings.PINECONE_INDEX)


@observe(name="index-transcript-segments")
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
            texts = [s.page_content for s in splits]
            embeddings = get_embeddings()
            # Embeddings hors du thread event-loop (appel bloquant réseau)
            dense_vectors = await asyncio.to_thread(embeddings.embed_documents, texts)

            # Branche sparse (BM25) du hybrid search
            bm25 = get_bm25_encoder()
            sparse_vectors = bm25.encode_documents(texts) if bm25 else None

            # IDs déterministes → l'upsert est idempotent (ré-indexation sans doublons)
            vectors = []
            for i, split in enumerate(splits):
                vector: dict = {
                    "id": f"{video_id}-{i:04d}",
                    "values": dense_vectors[i],
                    "metadata": {
                        "text": split.page_content,
                        **split.metadata,
                    },
                }
                if sparse_vectors:
                    vector["sparse_values"] = sparse_vectors[i]
                vectors.append(vector)

            index = get_pinecone_index()
            index.upsert(
                vectors=vectors,
                namespace=video_id,
                batch_size=100,
                show_progress=False,
            )
            mode = "dense+sparse (hybrid)" if sparse_vectors else "dense seul"
            print(f"[Pinecone] {len(splits)} chunks indexés dans le namespace '{video_id}' [{mode}]")

        return len(splits) if splits else 0
    finally:
        event.set()
        async with _indexing_lock:
            if _indexing_events.get(video_id) is event:
                _indexing_events.pop(video_id, None)


def _hybrid_query(index, video_id: str, query: str, query_dense: list[float], top_k: int):
    """
    Requête hybride en un seul appel Pinecone : dense (embeddings) + sparse (BM25),
    fusionnés côté serveur avec pondération convexe côté client (doc Pinecone) :
        score = alpha * dense + (1 - alpha) * sparse
    Requiert un index de type dense avec metric dotproduct.
    Repli sur la seule dense si BM25 est indisponible ou si l'index ne supporte
    pas l'hybride (ex: metric cosine).
    """
    bm25 = get_bm25_encoder()
    if bm25:
        try:
            alpha = settings.HYBRID_ALPHA
            query_sparse = bm25.encode_queries([query])[0]
            response = index.query(
                vector=[v * alpha for v in query_dense],
                sparse_vector={
                    "indices": query_sparse["indices"],
                    "values": [v * (1 - alpha) for v in query_sparse["values"]],
                },
                top_k=top_k,
                include_metadata=True,
                namespace=video_id,
            )
            return response.matches or []
        except Exception as e:
            print(f"[VectorStore RAG] Requête hybride échouée ({e}) — repli sur la dense seule.")
    response = index.query(
        vector=query_dense,
        top_k=top_k,
        include_metadata=True,
        namespace=video_id,
    )
    return response.matches or []


@observe(name="pinecone-retrieval", as_type="retriever")
async def similarity_search_rag(video_id: str, query: str, k: int = 5) -> str:
    """
    Pipeline de retrieval complet :
    1. Hybrid search : requête unique dense (embeddings) + sparse (BM25) avec
       pondération alpha, fusion côté serveur Pinecone
    2. Reranking des candidats via cohere/rerank-4-fast (OpenRouter)
    3. Formatage avec les marqueurs temporels [Timeline: mm:ss]
    Attend automatiquement si une indexation est déjà en cours pour cette vidéo.
    """
    try:
        # Attendre que l'indexation se termine si elle est en cours
        await wait_for_indexing_if_active(video_id)

        # "Retrieve wide, rerank narrow" : sur-récupérer puis reranker
        candidates_n = max(k, settings.RERANK_CANDIDATES)
        index = get_pinecone_index()
        embeddings = get_embeddings()

        # --- 1. Hybrid search (dense + BM25 en une seule requête) ---
        query_dense = await asyncio.to_thread(embeddings.embed_query, query)
        # Normalisation L2 de la requête dense pour calibrer la pondération alpha
        norm = math.sqrt(sum(v * v for v in query_dense))
        if norm > 0:
            query_dense = [v / norm for v in query_dense]

        matches = _hybrid_query(index, video_id, query, query_dense, candidates_n)

        # --- 2. Reranking des candidats (→ cohere/rerank-4-fast) ---
        docs: list[Document] = []
        for match in matches:
            metadata = match.metadata or {}
            text = metadata.get("text", "")
            if not text:
                continue
            docs.append(
                Document(
                    page_content=text,
                    metadata={**metadata, "pinecone_score": match.score},
                )
            )

        # Nombre final de chunks : plafonné par RERANK_TOP_N (et par k si plus petit)
        top_n = min(k, settings.RERANK_TOP_N)
        if len(docs) > top_n:
            docs = await rerank_documents(query, docs, top_n=top_n)
        else:
            docs = docs[:top_n]

        # --- 3. Formatage temporel [Timeline: mm:ss] ---
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
