from datetime import datetime
from pydantic import BaseModel


class SegmentSchema(BaseModel):
    text: str
    start: float
    duration: float


class VideoInfoRequest(BaseModel):
    url: str


class VideoInfoResponse(BaseModel):
    title: str
    description: str = ""
    thumbnail: str = ""
    author: str = ""
    viewCount: int = 0
    publishDate: str = ""
    duration: int = 0
    notes: str | None = None
    transcript: str | None = None
    segments: list[SegmentSchema] | None = None


class NotesRequest(BaseModel):
    videoId: str
    transcript: str | None = None
    regenerate: bool = False


class VideoQuizAttemptSummary(BaseModel):
    score: int
    total: int

    class Config:
        from_attributes = True


class VideoListItemResponse(BaseModel):
    id: str
    title: str
    author: str | None = None
    thumbnail: str | None = None
    duration: int = 0
    createdAt: datetime
    segmentsCount: int = 0
    attempts: list[VideoQuizAttemptSummary] = []

    class Config:
        from_attributes = True
