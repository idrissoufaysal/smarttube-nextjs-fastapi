from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_current_user_optional
from app.db.models import Segment, User, Video
from app.db.session import get_db
from app.schemas.transcript import TranscriptRequest, TranscriptResponse
from app.schemas.video import SegmentSchema
from app.services.vectorstore import index_transcript_segments
from app.services.youtube import extract_video_id, fetch_video_metadata, fetch_youtube_transcript

router = APIRouter(tags=["Transcripts"])


@router.post("/transcript", response_model=TranscriptResponse)
async def get_or_create_transcript(
    body: TranscriptRequest,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    video_id = extract_video_id(body.url)
    if not video_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL YouTube invalide.",
        )

    # 1. Vérification du cache PostgreSQL
    query = (
        select(Video)
        .where(Video.id == video_id)
        .options(selectinload(Video.segments))
    )
    result = await db.execute(query)
    cached_video = result.scalars().first()

    # Vérification de la limite de 4 vidéos par utilisateur
    user_id = current_user.id if current_user else None
    if user_id and not (cached_video and cached_video.userId == user_id):
        count_query = select(func.count(Video.id)).where(Video.userId == user_id)
        count_res = await db.execute(count_query)
        user_video_count = count_res.scalar_one_or_none() or 0
        if user_video_count >= 8:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Limite de 8 vidéos atteinte. Veuillez supprimer une vidéo existante pour en ajouter une nouvelle.",
            )

    if cached_video:
        print(f"[Cache] Transcription vidéo '{video_id}' récupérée depuis PostgreSQL.")
        return TranscriptResponse(
            transcript=cached_video.transcript,
            pineconeIndexed=True,
            pineconeError="",
            segments=[
                SegmentSchema(text=s.text, start=s.start, duration=s.duration)
                for s in cached_video.segments
            ],
        )

    # 2. Cache miss : Extraction de la transcription et des métadonnées
    try:
        full_transcript, segments = await fetch_youtube_transcript(video_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aucun sous-titre trouvé pour cette vidéo ({e}).",
        )

    meta = await fetch_video_metadata(video_id)

    # 3. Enregistrement dans PostgreSQL
    new_video = Video(
        id=video_id,
        title=meta.get("title", "Vidéo sans titre"),
        description=meta.get("description", ""),
        thumbnail=meta.get("thumbnail", ""),
        author=meta.get("author", ""),
        duration=meta.get("duration", 0),
        transcript=full_transcript,
        userId=user_id,
    )
    db.add(new_video)
    await db.flush()

    for seg in segments:
        db_segment = Segment(
            videoId=video_id,
            text=seg["text"],
            start=seg["start"],
            duration=seg["duration"],
        )
        db.add(db_segment)

    await db.commit()
    print(f"[Database] Vidéo '{video_id}' et {len(segments)} segments enregistrés.")

    # 4. Indexation Pinecone en tâche de fond (Background Task)
    background_tasks.add_task(index_transcript_segments, video_id, segments)

    return TranscriptResponse(
        transcript=full_transcript,
        pineconeIndexed=True,
        pineconeError="",
        segments=[
            SegmentSchema(text=s["text"], start=s["start"], duration=s["duration"])
            for s in segments
        ],
    )
