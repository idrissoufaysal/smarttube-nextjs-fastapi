# app/schemas/chat.py
from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    video_id: str = Field(..., description="ID de la vidéo YouTube")
    message: str = Field(..., min_length=1)



    


