import uuid
from datetime import datetime
from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    clerkId: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    firstName: Mapped[str | None] = mapped_column(String, nullable=True)
    lastName: Mapped[str | None] = mapped_column(String, nullable=True)
    imageUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now(), onupdate=func.now())

    videos: Mapped[list["Video"]] = relationship("Video", back_populates="user")
    quizAttempts: Mapped[list["QuizAttempt"]] = relationship("QuizAttempt", back_populates="user")
    chatMessages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="user")


class Video(Base):
    __tablename__ = "Video"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # YouTube ID
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    thumbnail: Mapped[str | None] = mapped_column(String, nullable=True)
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[int] = mapped_column(Integer, default=0)
    transcript: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    userId: Mapped[str | None] = mapped_column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now(), onupdate=func.now())

    user: Mapped[User | None] = relationship("User", back_populates="videos")
    segments: Mapped[list["Segment"]] = relationship("Segment", back_populates="video", cascade="all, delete-orphan")
    quizzes: Mapped[list["Quiz"]] = relationship("Quiz", back_populates="video", cascade="all, delete-orphan")
    attempts: Mapped[list["QuizAttempt"]] = relationship("QuizAttempt", back_populates="video", cascade="all, delete-orphan")
    chatMessages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="video", cascade="all, delete-orphan")


class Segment(Base):
    __tablename__ = "Segment"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    videoId: Mapped[str] = mapped_column(String, ForeignKey("Video.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    video: Mapped[Video] = relationship("Video", back_populates="segments")


class Quiz(Base):
    __tablename__ = "Quiz"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    videoId: Mapped[str] = mapped_column(String, ForeignKey("Video.id", ondelete="CASCADE"), nullable=False, index=True)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    video: Mapped[Video] = relationship("Video", back_populates="quizzes")
    questions: Mapped[list["QuizQuestion"]] = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts: Mapped[list["QuizAttempt"]] = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "QuizQuestion"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    quizId: Mapped[str] = mapped_column(String, ForeignKey("Quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    correctAnswerIndex: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)

    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "QuizAttempt"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    videoId: Mapped[str] = mapped_column(String, ForeignKey("Video.id", ondelete="CASCADE"), nullable=False, index=True)
    quizId: Mapped[str] = mapped_column(String, ForeignKey("Quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    userId: Mapped[str | None] = mapped_column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    video: Mapped[Video] = relationship("Video", back_populates="attempts")
    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="attempts")
    user: Mapped[User | None] = relationship("User", back_populates="quizAttempts")


class ChatMessage(Base):
    __tablename__ = "ChatMessage"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    videoId: Mapped[str] = mapped_column(String, ForeignKey("Video.id", ondelete="CASCADE"), nullable=False, index=True)
    userId: Mapped[str | None] = mapped_column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String, nullable=False)  # 'user', 'assistant', 'system'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), server_default=func.now(), index=True)

    video: Mapped[Video] = relationship("Video", back_populates="chatMessages")
    user: Mapped[User | None] = relationship("User", back_populates="chatMessages")
