from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.config.settings import settings
from app.core.limiter import limiter
from app.db.models import QuizAttempt, User
from app.db.session import get_db
from app.schemas.quiz import (
    QuizAttemptCreate,
    QuizAttemptResponse,
    QuizRequest,
    QuizResponse,
)
from app.services.langfuse_client import score_trace
from app.services.quiz import generate_quiz_service

router = APIRouter(tags=["Quiz"])


@router.post("/video/quiz", response_model=QuizResponse)
@limiter.limit(settings.RATE_LIMIT_QUIZ)
async def create_or_get_quiz(
    request: Request,
    body: QuizRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = int(body.numberOfQuestions) if str(body.numberOfQuestions).isdigit() else 5
    user_id = current_user.id

    quiz_data = await generate_quiz_service(
        video_id=body.videoId,
        transcript=body.transcript,
        difficulty=body.difficulty,
        number_of_questions=count,
        db=db,
        user_id=user_id,
    )

    return QuizResponse(quiz=quiz_data)


@router.post("/quiz/attempt")
async def record_quiz_attempt(
    body: QuizAttemptCreate,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    score = int(body.score) if str(body.score).isdigit() else 0
    total = int(body.total) if str(body.total).isdigit() else 5
    user_id = current_user.id if current_user else None

    attempt = QuizAttempt(
        videoId=body.videoId,
        quizId=body.quizId,
        score=score,
        total=total,
        difficulty=body.difficulty,
        userId=user_id,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    # Ingestion du score d'évaluation dans Langfuse
    ratio = round(score / total, 4) if total > 0 else 0.0
    score_trace(
        name="quiz-score",
        value=ratio,
        session_id=body.videoId,
        user_id=user_id,
        data_type="NUMERIC",
        comment=f"Score QCM: {score}/{total} ({body.difficulty})",
        metadata={
            "videoId": body.videoId,
            "quizId": body.quizId,
            "score": score,
            "total": total,
            "difficulty": body.difficulty,
        },
    )

    return {
        "success": True,
        "attempt": QuizAttemptResponse.model_validate(attempt),
    }


@router.get("/quiz/attempt")
async def get_quiz_attempts(
    videoId: str = Query(..., description="ID de la vidéo"),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    query = (
        select(QuizAttempt)
        .where(QuizAttempt.videoId == videoId)
        .order_by(QuizAttempt.createdAt.desc())
        .limit(10)
    )
    if user_id:
        query = query.where(QuizAttempt.userId == user_id)

    result = await db.execute(query)
    attempts = result.scalars().all()

    return {
        "attempts": [QuizAttemptResponse.model_validate(a) for a in attempts]
    }
