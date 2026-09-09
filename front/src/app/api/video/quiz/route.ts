import { prisma } from '@/lib/db';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const QuizRequestSchema = z.object({
  transcript: z.string().min(1),
  difficulty: z.enum(['facile', 'moyen', 'difficile']).optional(),
  numberOfQuestions: z.union([z.number(), z.string()]).optional(),
  videoId: z.string().optional()
});

// Le schéma Zod définit exactement la structure de données de quiz.
const quizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("La question à poser."),
      options: z.array(z.string()).length(4).describe("4 options de réponse possibles."),
      correctAnswerIndex: z.number().min(0).max(3).describe("L'index (de 0 à 3) de la bonne réponse parmi les options."),
      explanation: z.string().describe("Une brève explication du pourquoi c'est la bonne réponse.")
    })
  )
});

export const maxDuration = 60; // Autoriser jusqu'à 60 secondes pour la génération d'IA structurée

export async function POST(req: Request) {
  try {
    // Rate Limiting (5 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 5, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return NextResponse.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    console.log("Génération de quiz demandée");

    const body = await req.json();
    const parsedBody = QuizRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsedBody.error.errors }, { status: 400 });
    }

    const { transcript, difficulty = 'moyen', numberOfQuestions = 5, videoId } = parsedBody.data;

    const count = typeof numberOfQuestions === 'number'
      ? numberOfQuestions
      : typeof numberOfQuestions === 'string'
        ? (parseInt(numberOfQuestions, 10) || 5)
        : 5;

    // 1. Tenter de récupérer un quiz déjà généré depuis la base de données PostgreSQL
    if (videoId) {
      const cachedQuiz = await prisma.quiz.findFirst({
        where: {
          videoId: videoId,
          difficulty: difficulty,
        },
        include: {
          questions: true,
        },
      });

      if (cachedQuiz && cachedQuiz.questions.length === count) {
        console.log(`[Cache] Quiz pour la vidéo "${videoId}" (${difficulty}, ${count} questions) récupéré depuis PostgreSQL.`);
        return NextResponse.json({
          quiz: {
            id: cachedQuiz.id,
            questions: cachedQuiz.questions.map((q) => ({
              question: q.question,
              options: q.options,
              correctAnswerIndex: q.correctAnswerIndex,
              explanation: q.explanation,
            })),
          },
        });
      }
    }

    // 2. Cache miss : Choisir et initialiser le modèle d'IA disponible
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const openrouterKey = process.env.AI_KEY;

    let model;

    if (geminiKey) {
      const google = createGoogleGenerativeAI({ apiKey: geminiKey });
      model = google('gemini-1.5-flash');
    } else if (openrouterKey) {
      const openrouter = createOpenRouter({ apiKey: openrouterKey });
      const modelName = process.env.OPENROUTER_MODEL ;
      model = openrouter.chat(modelName!);
    } else {
      return NextResponse.json(
        { error: "Veuillez configurer GEMINI_API_KEY ou AI_KEY dans votre fichier .env." },
        { status: 400 }
      );
    }

    // 3. Générer le quiz structuré via l'IA
    const { object } = await generateObject({
      model,
      schema: quizSchema,
      prompt: `Tu es un professeur expert. Génère un QCM (Quiz) à choix multiples basé EXCLUSIVEMENT sur la transcription vidéo suivante :

<transcription>
${transcript}
</transcription>

Instructions :
- Génère exactement ${count} questions.
- Le niveau de difficulté doit être : ${difficulty}.
- Les questions, options et explications doivent IMPÉRATIVEMENT être en français.
- Ne pose pas de questions sur des choses qui ne sont pas dites dans la transcription.`,
    });

    // 4. Enregistrer le nouveau quiz dans la base de données PostgreSQL pour les prochaines requêtes
    let savedQuizId = "";
    if (videoId) {
      try {
        const createdQuiz = await prisma.quiz.create({
          data: {
            videoId: videoId,
            difficulty: difficulty,
            questions: {
              create: object.questions.map((q) => ({
                question: q.question,
                options: q.options,
                correctAnswerIndex: q.correctAnswerIndex,
                explanation: q.explanation,
              })),
            },
          },
        });
        savedQuizId = createdQuiz.id;
        console.log(`[Database] Nouveau quiz enregistré pour la vidéo "${videoId}" (${difficulty}, ID: ${savedQuizId}).`);
      } catch (dbError) {
        console.warn("[Database] Impossible d'enregistrer le quiz généré en cache :", dbError);
      }
    }

    return NextResponse.json({
      quiz: {
        id: savedQuizId || "temp-id-" + Date.now(),
        questions: object.questions,
      }
    });

  } catch (error: any) {
    console.error('Erreur Génération Quiz:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la génération du quiz.' },
      { status: 500 }
    );
  }
}
