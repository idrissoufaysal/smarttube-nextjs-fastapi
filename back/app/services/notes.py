from collections.abc import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.db.models import Video
from app.services.langfuse_client import get_langfuse_callback, langfuse_trace_context
from app.services.rag import get_llm


async def generate_notes_stream(
    video_id: str,
    transcript: str,
    db: AsyncSession,
    user_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Génère les notes de cours en Markdown structuré et streame en texte brut.
    Sauvegarde le résultat final dans PostgreSQL.
    """
    system_prompt = """Tu es un enseignant expert et pédagogue. Ta mission est de rédiger des notes de cours complètes, claires et hautement structurées en français à partir de la transcription d'une vidéo YouTube fournie.
      
Consignes impératives pour les notes :
1. Utilise un format Markdown riche et soigné (titres #, ##, ###, listes à puces -, texte en **gras** pour souligner les concepts clés).
2. Divise les notes en trois grandes parties bien distinctes :
   - **Vue d'ensemble de la vidéo** (résumé global de 2 à 4 phrases).
   - **Concepts clés expliqués** (détaille chaque idée, définition, formule ou exemple important mentionné).
   - **Synthèse & À retenir** (résumé sous forme de points clés exploitables pour l'étude).
3. Reste rigoureusement fidèle à la transcription. N'invente pas d'informations extérieures qui n'y figurent pas.
4. Réponds obligatoirement en français de manière fluide et professionnelle."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Voici la transcription de la vidéo :\n\n{transcript}"),
    ]

    llm = get_llm(streaming=True, max_tokens=settings.MAX_TOKENS_NOTES)
    accumulated_notes: list[str] = []

    # Contexte et callback Langfuse pour tracer la génération de notes
    with langfuse_trace_context(
        session_id=video_id,
        user_id=user_id,
        trace_name="notes-generation",
        tags=["notes", "streaming", "summary"],
        metadata={
            "video_id": video_id,
            "transcript_length": len(transcript),
        },
    ):
        langfuse_cb = get_langfuse_callback()
        stream_config = {"callbacks": [langfuse_cb]} if langfuse_cb else None

        async for chunk in llm.astream(messages, config=stream_config):
            text_chunk = chunk.content if isinstance(chunk.content, str) else ""
            if text_chunk:
                accumulated_notes.append(text_chunk)
                yield text_chunk

    full_notes = "".join(accumulated_notes)

    # Mise à jour en base de données
    if full_notes:
        try:
            await db.execute(
                update(Video).where(Video.id == video_id).values(notes=full_notes)
            )
            await db.commit()
            print(f"[Notes DB] Notes enregistrées pour la vidéo '{video_id}'")
        except Exception as e:
            print(f"[Notes DB] Erreur sauvegarde: {e}")
