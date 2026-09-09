import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const QuizAttemptPostSchema = z.object({
  videoId: z.string().min(1),
  quizId: z.string().min(1),
  score: z.union([z.number(), z.string()]),
  total: z.union([z.number(), z.string()]),
  difficulty: z.enum(['facile', 'moyen', 'difficile'])
});

const QuizAttemptGetSchema = z.object({
  videoId: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    // Rate Limiting (10 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 10, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return Response.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    const body = await req.json();
    const parsedBody = QuizAttemptPostSchema.safeParse(body);
    if (!parsedBody.success) {
      return Response.json({ error: 'Données invalides', details: parsedBody.error.errors }, { status: 400 });
    }

    const { videoId, quizId, score, total, difficulty } = parsedBody.data;

    const parsedScore = typeof score === 'number' ? score : parseInt(score, 10);
    const parsedTotal = typeof total === 'number' ? total : parseInt(total, 10);

    const attempt = await prisma.quizAttempt.create({
      data: {
        videoId,
        quizId,
        score: parsedScore,
        total: parsedTotal,
        difficulty,
        userId: currentUserRecord.id,
      },
    });

    return Response.json({ success: true, attempt });
  } catch (error: any) {
    console.error('Erreur enregistrement tentative:', error);
    return Response.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // Rate Limiting (10 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 10, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return Response.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    const parsedQuery = QuizAttemptGetSchema.safeParse({ videoId });
    if (!parsedQuery.success) {
      return Response.json({ error: 'Données invalides', details: parsedQuery.error.errors }, { status: 400 });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        videoId: parsedQuery.data.videoId,
        userId: currentUserRecord.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    return Response.json({ attempts });
  } catch (error: any) {
    console.error('Erreur récupération tentatives:', error);
    return Response.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
