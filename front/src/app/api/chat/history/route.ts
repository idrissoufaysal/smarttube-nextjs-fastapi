import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const ChatHistoryGetSchema = z.object({
  videoId: z.string().min(1)
});

export async function GET(req: Request) {
  try {
    // Rate Limiting (10 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 10, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return NextResponse.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    const parsedQuery = ChatHistoryGetSchema.safeParse({ videoId });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsedQuery.error.errors }, { status: 400 });
    }

    const validVideoId = parsedQuery.data.videoId;

    const messages = await prisma.chatMessage.findMany({
      where: {
        videoId: validVideoId,
        userId: currentUserRecord.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
