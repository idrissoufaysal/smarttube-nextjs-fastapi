from datetime import datetime
from pydantic import BaseModel, Field


class QuizQuestionSchema(BaseModel):
    question: str = Field(..., description="La question à poser sur le contenu de la vidéo.")
    options: list[str] = Field(..., min_length=4, max_length=4, description="Exactement 4 options de réponse possibles.")
    correctAnswerIndex: int = Field(..., ge=0, le=3, description="L'index (de 0 à 3) de la bonne réponse parmi les options.")
    explanation: str = Field(..., description="Une brève explication du pourquoi c'est la bonne réponse.")


class QuizGenerationSchema(BaseModel):
    questions: list[QuizQuestionSchema] = Field(..., description="Liste ordonnée de questions de quiz générées.")


class QuizRequest(BaseModel):
    transcript: str
    difficulty: str = "moyen"
    numberOfQuestions: int | str = 5
    videoId: str | None = None


class QuizResponseData(BaseModel):
    id: str
    questions: list[QuizQuestionSchema]


class QuizResponse(BaseModel):
    quiz: QuizResponseData


class QuizAttemptCreate(BaseModel):
    videoId: str
    quizId: str
    score: int | str
    total: int | str
    difficulty: str


class QuizAttemptResponse(BaseModel):
    id: str
    videoId: str
    quizId: str
    score: int
    total: int
    difficulty: str
    createdAt: datetime

    class Config:
        from_attributes = True
