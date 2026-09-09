from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_current_user_optional
from app.db.models import Segment, User, Video
from app.db.session import get_db
from app.schemas.video import (
    NotesRequest,
    SegmentSchema,
    VideoInfoRequest,
    VideoInfoResponse,
    VideoListItemResponse,
    VideoQuizAttemptSummary,
)
from app.services.notes import generate_notes_stream
from app.services.vectorstore import delete_video_vectors
from app.services.youtube import extract_video_id, fetch_video_metadata

router = APIRouter(tags=["Videos"])


@router.get("/videos", response_model=list[VideoListItemResponse])
async def get_all_videos(
    db: AsyncSession = Depends(get_db),
):
    """
    Route PUBLIQUE (sans authentification) :
    Récupère TOUTES les vidéos stockées en base de données.
    """
    query = (
        select(Video)
        .options(
            selectinload(Video.segments),
            selectinload(Video.attempts),
        )
        .order_by(Video.createdAt.desc())
    )

    result = await db.execute(query)
    videos = result.scalars().all()

    return [
        VideoListItemResponse(
            id=v.id,
            title=v.title,
            author=v.author,
            thumbnail=v.thumbnail,
            duration=v.duration,
            createdAt=v.createdAt,
            segmentsCount=len(v.segments),
            attempts=[
                VideoQuizAttemptSummary(score=a.score, total=a.total)
                for a in v.attempts
            ],
        )
        for v in videos
    ]


@router.get("/videos/me", response_model=list[VideoListItemResponse])
async def get_my_videos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Route PROTÉGÉE (requiert authentification) :
    Récupère uniquement les vidéos de l'utilisateur connecté.
    """
    query = (
        select(Video)
        .where(Video.userId == current_user.id)
        .options(
            selectinload(Video.segments),
            selectinload(Video.attempts),
        )
        .order_by(Video.createdAt.desc())
    )

    result = await db.execute(query)
    videos = result.scalars().all()

    return [
        VideoListItemResponse(
            id=v.id,
            title=v.title,
            author=v.author,
            thumbnail=v.thumbnail,
            duration=v.duration,
            createdAt=v.createdAt,
            segmentsCount=len(v.segments),
            attempts=[
                VideoQuizAttemptSummary(score=a.score, total=a.total)
                for a in v.attempts
            ],
        )
        for v in videos
    ]


@router.get("/videos/user/{user_id}", response_model=list[VideoListItemResponse])
async def get_videos_by_user_id(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Récupère les vidéos associées à un identifiant utilisateur spécifique.
    """
    query = (
        select(Video)
        .where(Video.userId == user_id)
        .options(
            selectinload(Video.segments),
            selectinload(Video.attempts),
        )
        .order_by(Video.createdAt.desc())
    )

    result = await db.execute(query)
    videos = result.scalars().all()

    return [
        VideoListItemResponse(
            id=v.id,
            title=v.title,
            author=v.author,
            thumbnail=v.thumbnail,
            duration=v.duration,
            createdAt=v.createdAt,
            segmentsCount=len(v.segments),
            attempts=[
                VideoQuizAttemptSummary(score=a.score, total=a.total)
                for a in v.attempts
            ],
        )
        for v in videos
    ]


@router.post("/video-info", response_model=VideoInfoResponse)
async def get_video_info(
    body: VideoInfoRequest,
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

    if cached_video:
        print(f"[Cache] Vidéo '{video_id}' trouvée en base de données.")
        return VideoInfoResponse(
            title=cached_video.title,
            description=cached_video.description or "",
            thumbnail=cached_video.thumbnail or "",
            author=cached_video.author or "",
            viewCount=0,
            publishDate="",
            duration=cached_video.duration,
            notes=cached_video.notes,
            transcript=cached_video.transcript,
            segments=[
                SegmentSchema(text=s.text, start=s.start, duration=s.duration)
                for s in cached_video.segments
            ],
        )

    # 2. Métadonnées via oEmbed
    meta = await fetch_video_metadata(video_id)
    return VideoInfoResponse(
        title=meta.get("title", "Vidéo sans titre"),
        description="",
        thumbnail=meta.get("thumbnail", ""),
        author=meta.get("author", ""),
        viewCount=0,
        publishDate="",
        duration=meta.get("duration", 0),
    )


@router.post("/video/notes")
async def get_or_create_notes(
    body: NotesRequest,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    # 1. Vérifier le cache si pas de régénération demandée
    if not body.regenerate:
        query = select(Video.notes).where(Video.id == body.videoId)
        res = await db.execute(query)
        cached_notes = res.scalars().first()
        if cached_notes:
            return Response(content=cached_notes, media_type="text/plain")

    if not body.transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La transcription est requise pour générer des notes.",
        )

    # 2. Streaming de la réponse en direct
    user_id = current_user.id if current_user else None
    return StreamingResponse(
        generate_notes_stream(body.videoId, body.transcript, db, user_id=user_id),
        media_type="text/plain",
    )


@router.delete("/video")
async def delete_video(
    videoId: str = Query(..., description="ID de la vidéo YouTube"),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    # 1. Vérifier l'existence
    query = select(Video).where(Video.id == videoId)
    result = await db.execute(query)
    video = result.scalars().first()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vidéo introuvable.",
        )

    # 2. Suppression des vecteurs Pinecone
    await delete_video_vectors(videoId)

    # 3. Suppression en cascade dans PostgreSQL
    await db.delete(video)
    await db.commit()

    return {"success": True}
