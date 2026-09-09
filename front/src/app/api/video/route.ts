import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPineconeIndex } from '@/lib/pinecone';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const VideoDeleteSchema = z.object({
  videoId: z.string().min(1)
});

export async function DELETE(req: Request) {
  try {
    // Rate Limiting (5 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 5, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Vérifier que l'utilisateur est connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return NextResponse.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    const parsedQuery = VideoDeleteSchema.safeParse({ videoId });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsedQuery.error.errors }, { status: 400 });
    }

    const validVideoId = parsedQuery.data.videoId;

    // Vérifier que l'utilisateur est propriétaire de la vidéo
    const video = await prisma.video.findUnique({
      where: { id: validVideoId },
      select: { userId: true },
    });

    if (!video) {
      return NextResponse.json({ error: 'Vidéo introuvable' }, { status: 404 });
    }

    if (video.userId && video.userId !== currentUserRecord.id) {
      return NextResponse.json({ error: 'Non autorisé à supprimer cette vidéo' }, { status: 403 });
    }

    // Suppression des vecteurs dans Pinecone
    try {
      await getPineconeIndex().namespace(validVideoId).deleteAll();
    } catch (pineconeError) {
      console.error('Erreur suppression Pinecone:', pineconeError);
    }

    // Suppression en cascade (segments, quiz, attempts, messages)
    await prisma.video.delete({
      where: { id: validVideoId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erreur suppression vidéo:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Vidéo introuvable' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
