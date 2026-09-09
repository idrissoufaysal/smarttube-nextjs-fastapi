import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const VideoInfoRequestSchema = z.object({
  url: z.string().url()
});

export async function POST(req: Request) {
  try {
    // Rate Limiting (20 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 20, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return Response.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
    }

    const body = await req.json();
    const parsedBody = VideoInfoRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return Response.json({ error: 'Données invalides', details: parsedBody.error.errors }, { status: 400 });
    }

    const { url } = parsedBody.data;

    // Extrait l'ID vidéo
    const videoId = extractVideoId(url);
    if (!videoId) {
      return Response.json({ error: 'URL YouTube invalide.' }, { status: 400 });
    }

    // 1. Tenter de récupérer la vidéo depuis le cache PostgreSQL
    const cachedVideo = await prisma.video.findUnique({
      where: { id: videoId },
      include: { segments: { orderBy: { start: 'asc' } } },
    });

    if (cachedVideo) {
      console.log(`[Cache] Métadonnées, transcription et notes de la vidéo "${videoId}" récupérées depuis PostgreSQL.`);
      return Response.json({
        title: cachedVideo.title,
        description: cachedVideo.description || '',
        thumbnail: cachedVideo.thumbnail || '',
        author: cachedVideo.author || '',
        viewCount: 0, // Optionnel, fallback
        publishDate: '', // Optionnel, fallback
        duration: cachedVideo.duration,
        notes: cachedVideo.notes || null,
        transcript: cachedVideo.transcript || '',
        segments: cachedVideo.segments.map((s) => ({
          text: s.text,
          start: s.start,
          duration: s.duration,
        })),
      });
    }

    // 2. Cache miss: Fetch metadata using oEmbed (to avoid Vercel IP blocks with Innertube)
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oEmbedRes = await fetch(oEmbedUrl);

    if (!oEmbedRes.ok) {
      return Response.json({ error: 'Vidéo introuvable ou privée.' }, { status: 404 });
    }

    const oData = await oEmbedRes.json();

    return Response.json({
      title: oData.title || 'Vidéo sans titre',
      description: '', // oEmbed doesn't provide description
      thumbnail: oData.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      author: oData.author_name || '',
      viewCount: 0,
      publishDate: '',
      duration: 0,
    });
  } catch (error) {
    console.error('Erreur video-info:', error);
    return Response.json({ error: 'Impossible de récupérer les informations de la vidéo.' }, { status: 500 });
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
