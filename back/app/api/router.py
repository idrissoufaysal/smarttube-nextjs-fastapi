from fastapi import APIRouter

from app.api.routes.chat import router as chat_router
from app.api.routes.quiz import router as quiz_router
from app.api.routes.transcripts import router as transcripts_router
from app.api.routes.videos import router as videos_router

api_router = APIRouter()

api_router.include_router(videos_router)
api_router.include_router(transcripts_router)
api_router.include_router(chat_router)
api_router.include_router(quiz_router)
