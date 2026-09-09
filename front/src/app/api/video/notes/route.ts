import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const NotesRequestSchema = z.object({
  videoId: z.string().min(1),
  transcript: z.string().optional(),
  regenerate: z.boolean().optional()
});

export const maxDuration = 60; // Autoriser jusqu'à 60 secondes pour la génération

export async function POST(req: Request) {
  try {
    // Rate Limiting (5 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 5, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return new Response(JSON.stringify({ error: 'Non autorisé. Veuillez vous connecter.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const parsedBody = NotesRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: 'Données invalides', details: parsedBody.error.errors }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { videoId, transcript, regenerate } = parsedBody.data;

    // 1. Tenter de récupérer depuis le cache si on ne force pas la régénération
    if (!regenerate) {
      const cachedVideo = await prisma.video.findUnique({
        where: { id: videoId },
        select: { notes: true },
      });

      if (cachedVideo?.notes) {
        console.log(`[Cache] Notes pour la vidéo "${videoId}" récupérées depuis PostgreSQL.`);
        return new Response(cachedVideo.notes);
      }
    }

    if (!transcript) {
      return new Response('La transcription est requise pour générer des notes.', { status: 400 });
    }

    console.log(`[Notes API] Génération de nouvelles notes pour la vidéo "${videoId}"...`);

    // 2. Initialiser OpenRouter
    const openrouterKey = process.env.AI_KEY;
    if (!openrouterKey) {
      return new Response('Configuration AI_KEY manquante dans le fichier .env.', { status: 400 });
    }

    const openrouter = createOpenRouter({ apiKey: openrouterKey });
    const modelName = process.env.OPENROUTER_MODEL ;
    const model = openrouter.chat(modelName!);

    // 3. Lancer la génération de texte en streaming
    const result = streamText({
      model,
      system: `Tu es un enseignant expert et pédagogue. Ta mission est de rédiger des notes de cours complètes, claires et hautement structurées en français à partir de la transcription d'une vidéo YouTube fournie.
      
Consignes impératives pour les notes :
1. Utilise un format Markdown riche et soigné (titres #, ##, ###, listes à puces -, texte en **gras** pour souligner les concepts clés).
2. Divise les notes en trois grandes parties bien distinctes :
   - **Vue d'ensemble de la vidéo** (résumé global de 2 à 4 phrases).
   - **Concepts clés expliqués** (détaille chaque idée, définition, formule ou exemple important mentionné).
   - **Synthèse & À retenir** (résumé sous forme de points clés exploitables pour l'étude).
3. Reste rigoureusement fidèle à la transcription. N'invente pas d'informations extérieures qui n'y figurent pas.
4. Réponds obligatoirement en français de manière fluide et professionnelle.`,
      prompt: `Voici la transcription de la vidéo :\n\n${transcript}`,
      async onFinish({ text }) {
        try {
          // Sauvegarder les notes générées en base de données PostgreSQL
          await prisma.video.update({
            where: { id: videoId },
            data: { notes: text },
          });
          console.log(`[Database] Notes de cours enregistrées avec succès pour la vidéo "${videoId}".`);
        } catch (dbError) {
          console.error("Erreur lors de l'enregistrement des notes en base de données :", dbError);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Erreur API Génération Notes:', error);
    return new Response('Erreur interne du serveur lors de la génération des notes.', { status: 500 });
  }
}
