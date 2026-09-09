import json
import uuid
from collections.abc import AsyncGenerator
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.settings import settings
from app.db.models import ChatMessage
from app.services.langfuse_client import get_langfuse_callback, langfuse_trace_context


def get_llm(streaming: bool = True) -> ChatOpenAI:
    """
    Initialise le modèle de chat (OpenRouter ou OpenAI).
    """
    if settings.AI_KEY:
        return ChatOpenAI(
            model=settings.OPENROUTER_MODEL,
            api_key=settings.AI_KEY,
            base_url="https://openrouter.ai/api/v1",
            streaming=streaming,
            temperature=0.3,
            default_headers={
                "HTTP-Referer": "https://smarttube.example.com",
                "X-Title": "SmartTube AI",
            },
        )
  


async def generate_rag_response_stream(
    messages: list[dict],
    context: str,
    using_rag: bool,
    video_id: str | None,
    user_id: str | None,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """
    Génère la réponse RAG en streaming au format Vercel AI SDK Data Stream Protocol (`0:"..."\n`)
    pour une compatibilité 100% transparente avec `useChat` du frontend Next.js.
    """
    system_content = (
        f"""Tu es un assistant vidéo pédagogique et intelligent appelé SmartTube.
Ton rôle est d'aider l'utilisateur à comprendre la vidéo en te basant sur {"les extraits pertinents suivants de sa transcription avec leurs timelines" if using_rag else "sa transcription complète"} :

<contexte_video>
{context}
</contexte_video>

Instructions impératives pour tes réponses :
1. Réponds de manière claire, concise et pédagogique en te basant sur ce contexte.
2. Réponds obligatoirement en français.
3. Pour chaque fait ou concept important que tu décris, tu dois citer sa timeline exacte sous le format précis : [Source: mm:ss] (ou [Source: hh:mm:ss] si la vidéo est longue). Base-toi strictement sur les annotations [Timeline: mm:ss] présentes dans le contexte. N'invente jamais de timeline !"""
        if context
        else "Tu es un assistant vidéo pédagogique et intelligent appelé SmartTube. Tes réponses doivent IMPÉRATIVEMENT être en français."
    )

    # Conversion des messages en format LangChain
    langchain_messages = [SystemMessage(content=system_content)]
    last_user_query = ""

    for m in messages:
        role = m.get("role")
        content = ""
        if "parts" in m and isinstance(m["parts"], list):
            content = " ".join(
                p.get("text", "") for p in m["parts"] if p.get("type") == "text"
            )
        elif isinstance(m.get("content"), str):
            content = m["content"]

        if role == "user":
            last_user_query = content
            langchain_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            langchain_messages.append(AIMessage(content=content))

    # Sauvegarde préalable du message utilisateur en DB
    if video_id and last_user_query:
        try:
            user_msg = ChatMessage(
                videoId=video_id,
                userId=user_id,
                role="user",
                content=last_user_query,
            )
            db.add(user_msg)
            await db.commit()
        except Exception as e:
            print(f"[Chat DB] Erreur sauvegarde message user: {e}")

    llm = get_llm(streaming=True)
    accumulated_response: list[str] = []
    msg_id = f"msg-{uuid.uuid4().hex[:16]}"

    # Contexte et callback Langfuse pour tracer la génération
    with langfuse_trace_context(
        session_id=video_id,
        user_id=user_id,
        trace_name="chat-rag",
        tags=["chat", "rag" if using_rag else "fallback", "streaming"],
        metadata={
            "video_id": video_id,
            "using_rag": using_rag,
            "context_length": len(context) if context else 0,
            "messages_count": len(messages),
        },
    ):
        langfuse_cb = get_langfuse_callback()
        stream_config = {"callbacks": [langfuse_cb]} if langfuse_cb else None

        # 1. Événements d'initialisation du stream UI (SSE)
        yield 'data: {"type":"start"}\n\n'
        yield 'data: {"type":"start-step"}\n\n'
        yield f'data: {{"type":"text-start","id":{json.dumps(msg_id)}}}\n\n'

        try:
            # 2. Streamer les deltas de texte au format SSE UI Message Stream
            async for chunk in llm.astream(langchain_messages, config=stream_config):
                text_chunk = ""
                if isinstance(chunk.content, str):
                    text_chunk = chunk.content
                elif isinstance(chunk.content, list):
                    text_chunk = "".join(
                        p.get("text", "") if isinstance(p, dict) else str(p)
                        for p in chunk.content
                    )
                elif chunk.content is not None:
                    text_chunk = str(chunk.content)

                if text_chunk:
                    accumulated_response.append(text_chunk)
                    delta_payload = json.dumps({
                        "type": "text-delta",
                        "id": msg_id,
                        "delta": text_chunk,
                    })
                    yield f"data: {delta_payload}\n\n"

        except Exception as stream_err:
            import logging
            logging.getLogger(__name__).error(f"[Chat RAG Stream Error] {stream_err}")
            err_msg = f"\n\n*(Une erreur est survenue lors de la génération : {stream_err})*"
            accumulated_response.append(err_msg)
            delta_payload = json.dumps({
                "type": "text-delta",
                "id": msg_id,
                "delta": err_msg,
            })
            yield f"data: {delta_payload}\n\n"

        finally:
            # 3. Finalisation du stream SSE
            yield f'data: {{"type":"text-end","id":{json.dumps(msg_id)}}}\n\n'
            yield 'data: {"type":"finish-step"}\n\n'
            yield 'data: {"type":"finish","finishReason":"stop"}\n\n'
            yield 'data: [DONE]\n\n'

    full_assistant_text = "".join(accumulated_response)

    # Sauvegarde du message assistant complet en DB
    if video_id and full_assistant_text:
        try:
            assistant_msg = ChatMessage(
                videoId=video_id,
                userId=user_id,
                role="assistant",
                content=full_assistant_text,
            )
            db.add(assistant_msg)
            await db.commit()
        except Exception as e:
            print(f"[Chat DB] Erreur sauvegarde message assistant: {e}")
