from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Quiz, QuizQuestion
from app.schemas.quiz import QuizGenerationSchema, QuizQuestionSchema, QuizResponseData
from app.services.langfuse_client import get_langfuse_callback, langfuse_trace_context
from app.services.rag import get_llm


async def generate_quiz_service(
    video_id: str | None,
    transcript: str,
    difficulty: str,
    number_of_questions: int,
    db: AsyncSession,
    user_id: str | None = None,
) -> QuizResponseData:
    """
    Génère un quiz QCM structuré et typé via LangChain Structured Output / Pydantic.
    Vérifie et met en cache dans PostgreSQL.
    """
    # 1. Vérification du cache PostgreSQL
    if video_id:
        query = (
            select(Quiz)
            .where(Quiz.videoId == video_id, Quiz.difficulty == difficulty)
            .limit(1)
        )
        result = await db.execute(query)
        cached_quiz = result.scalars().first()

        if cached_quiz:
            # Charger les questions
            q_query = select(QuizQuestion).where(QuizQuestion.quizId == cached_quiz.id)
            q_res = await db.execute(q_query)
            cached_questions = q_res.scalars().all()

            if len(cached_questions) == number_of_questions:
                print(f"[Cache] Quiz '{cached_quiz.id}' récupéré depuis PostgreSQL")
                return QuizResponseData(
                    id=cached_quiz.id,
                    questions=[
                        QuizQuestionSchema(
                            question=q.question,
                            options=q.options,
                            correctAnswerIndex=q.correctAnswerIndex,
                            explanation=q.explanation,
                        )
                        for q in cached_questions
                    ],
                )

    # 2. Génération via LLM avec Structured Output
    llm = get_llm(streaming=False)
    parser = PydanticOutputParser(pydantic_object=QuizGenerationSchema)

    system_prompt = f"""Tu es un professeur expert. Génère un QCM (Quiz) à choix multiples basé EXCLUSIVEMENT sur la transcription vidéo suivante :

<transcription>
{transcript}
</transcription>

Instructions impératives :
- Génère exactement {number_of_questions} questions.
- Le niveau de difficulté doit être : {difficulty}.
- Les questions, options et explications doivent IMPÉRATIVEMENT être en français.
- Chaque question doit avoir exactement 4 options et un index de bonne réponse entre 0 et 3.
- Ne pose pas de questions sur des informations absentes de la transcription.

{parser.get_format_instructions()}"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content="Génère le quiz maintenant au format JSON structuré."),
    ]

    # Contexte et callback Langfuse pour tracer la génération de quiz
    with langfuse_trace_context(
        session_id=video_id,
        user_id=user_id,
        trace_name="quiz-generation",
        tags=["quiz", "generation", f"difficulty:{difficulty}"],
        metadata={
            "video_id": video_id,
            "difficulty": difficulty,
            "number_of_questions": number_of_questions,
            "transcript_length": len(transcript),
        },
    ):
        langfuse_cb = get_langfuse_callback()
        callbacks = [langfuse_cb] if langfuse_cb else []
        invoke_config = {"callbacks": callbacks} if callbacks else {}

        try:
            # Essai avec with_structured_output si supporté par le provider
            structured_llm = llm.with_structured_output(QuizGenerationSchema)
            structured_result: QuizGenerationSchema = await structured_llm.ainvoke(messages, config=invoke_config)
        except Exception as e:
            print(f"[Quiz Structured Output Fallback] {e}")
            # Fallback via parser standard avec callback Langfuse
            response = await llm.ainvoke(messages, config=invoke_config)
            content = response.content if isinstance(response.content, str) else ""
            structured_result = parser.parse(content)

    # 3. Sauvegarde en base de données PostgreSQL
    saved_quiz_id = f"quiz_{video_id}_{difficulty}"
    if video_id:
        try:
            new_quiz = Quiz(
                videoId=video_id,
                difficulty=difficulty,
            )
            db.add(new_quiz)
            await db.flush()  # Pour générer l'ID

            for q in structured_result.questions:
                db_question = QuizQuestion(
                    quizId=new_quiz.id,
                    question=q.question,
                    options=q.options,
                    correctAnswerIndex=q.correctAnswerIndex,
                    explanation=q.explanation,
                )
                db.add(db_question)

            await db.commit()
            saved_quiz_id = new_quiz.id
            print(f"[Quiz DB] Nouveau quiz '{saved_quiz_id}' enregistré en base.")
        except Exception as db_err:
            print(f"[Quiz DB] Erreur enregistrement: {db_err}")
            await db.rollback()

    return QuizResponseData(
        id=saved_quiz_id,
        questions=structured_result.questions,
    )
