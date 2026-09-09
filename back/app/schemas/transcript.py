from pydantic import BaseModel
from app.schemas.video import SegmentSchema


class TranscriptRequest(BaseModel):
    url: str


class TranscriptResponse(BaseModel):
    transcript: str
    pineconeIndexed: bool = True
    pineconeError: str = ""
    segments: list[SegmentSchema]
