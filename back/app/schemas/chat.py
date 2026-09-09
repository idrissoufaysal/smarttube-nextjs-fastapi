from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    transcript: str | None = None
    videoId: str | None = None


class ChatMessageResponse(BaseModel):
    id: str
    videoId: str
    role: str
    content: str
    createdAt: datetime

    class Config:
        from_attributes = True
