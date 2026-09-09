import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.db.models import ChatMessage, User
from app.db.session import get_db
from app.schemas.chat import ChatMessageResponse, ChatRequest
from app.services.rag import generate_rag_response_stream

router = APIRouter(tags=["Chat"])

# Limite stricte de caractères pour un message utilisateur (Guardrail anti-abus et économie de tokens)
MAX_USER_QUERY_CHARS = 1000


@router.post("/chat")
async def chat_rag_endpoint(
    body: ChatRequest,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    # Extraire la dernière requête de l'utilisateur pour vérifier les guardrails
    last_user_query = ""
    for m in reversed(body.messages):
        if m.get("role") == "user":
            if "parts" in m and isinstance(m["parts"], list):
                last_user_query = " ".join(
                    p.get("text", "") for p in m["parts"] if p.get("type") == "text"
                )
            elif isinstance(m.get("content"), str):
                last_user_query = m["content"]
            break

    # Guardrail : Contrôle de la taille du message utilisateur
    if len(last_user_query) > MAX_USER_QUERY_CHARS:
        async def stream_query_too_long():
            msg_id = f"msg-{uuid.uuid4().hex[:16]}"
            warning_msg = (
                f"⚠️ **Votre message est trop long ({len(last_user_query)} caractères).**\n\n"
                f"Pour garantir une réponse rapide et pertinente sans saturer le modèle, la limite autorisée est de **{MAX_USER_QUERY_CHARS} caractères** par message.\n\n"
                "Veuillez raccourcir votre question et la renvoyer."
            )
            yield 'data: {"type":"start"}\n\n'
            yield 'data: {"type":"start-step"}\n\n'
            yield f'data: {{"type":"text-start","id":{json.dumps(msg_id)}}}\n\n'
            delta_payload = json.dumps({
                "type": "text-delta",
                "id": msg_id,
                "delta": warning_msg,
            })
            yield f"data: {delta_payload}\n\n"
            yield f'data: {{"type":"text-end","id":{json.dumps(msg_id)}}}\n\n'
            yield 'data: {"type":"finish-step"}\n\n'
            yield 'data: {"type":"finish","finishReason":"stop"}\n\n'
            yield 'data: [DONE]\n\n'

        return StreamingResponse(
            stream_query_too_long(),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "x-vercel-ai-ui-message-stream": "v1",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    user_id = current_user.id if current_user else None

    # Retourner le flux : le cycle complet Retrieval + Génération s'exécute sous la trace Langfuse unifiée
    return StreamingResponse(
        generate_rag_response_stream(
            messages=body.messages,
            video_id=body.videoId,
            user_id=user_id,
            raw_transcript=body.transcript,
            db=db,
        ),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/history", response_model=list[ChatMessageResponse])
async def get_chat_history(
    videoId: str = Query(..., description="ID de la vidéo"),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    query = (
        select(ChatMessage)
        .where(ChatMessage.videoId == videoId)
        .order_by(ChatMessage.createdAt.asc())
    )
    if user_id:
        query = query.where(ChatMessage.userId == user_id)

    result = await db.execute(query)
    messages = result.scalars().all()
    return messages
