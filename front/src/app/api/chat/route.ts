import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { getVectorStore } from '@/lib/pinecone';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const ChatRequestSchema = z.object({
  messages: z.array(z.any()),
  transcript: z.string().optional(),
  videoId: z.string().optional()
});

// Autoriser le streaming de la réponse jusqu'à 30 secondes
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Rate Limiting (10 requêtes par minute)
    const rateLimitResponse = checkRateLimit(req, 10, 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const parsedBody = ChatRequestSchema.safeParse(body);
    
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: 'Données invalides', details: parsedBody.error.errors }), { status: 400 });
    }

    const { messages, transcript, videoId } = parsedBody.data;

    let context = '';
    let usingRAG = false;

    // Récupérer l'utilisateur connecté (Strict Check)
    const currentUserRecord = await getCurrentUser();
    if (!currentUserRecord) {
      return new Response(JSON.stringify({ error: 'Non autorisé. Veuillez vous connecter.' }), { status: 401 });
    }
    
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const latestUserMessage = userMessages[userMessages.length - 1];
    const latestUserQuery = latestUserMessage?.parts
      ? latestUserMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ')
      : typeof (latestUserMessage as any)?.content === 'string' ? (latestUserMessage as any).content : '';

    if (videoId && latestUserQuery) {
      // Sauvegarder le message utilisateur
      try {
        await prisma.chatMessage.create({
          data: {
            videoId,
            role: 'user',
            content: latestUserQuery,
            userId: currentUserRecord?.id ?? null,
          },
        });
      } catch (dbError) {
        console.error("Erreur sauvegarde message user:", dbError);
      }
    }

    // Tentative de récupération contextuelle RAG via Pinecone
    if (videoId && latestUserQuery) {
      try {
        const vectorStore = await getVectorStore(videoId);
        const results = await vectorStore.similaritySearch(latestUserQuery, 5);
        
        context = results.map((doc) => {
          const startMs = doc.metadata?.start || 0;
          // youtube-transcript renvoie l'offset en millisecondes. 
          // Si la valeur est très grande (> 10000), on divise par 1000, sinon on suppose que c'est déjà en secondes.
          const startSec = startMs > 10000 ? Math.floor(startMs / 1000) : Math.floor(startMs);
          const mins = Math.floor(startSec / 60);
          const secs = Math.floor(startSec % 60);
          const timestampStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          
          return `[Timeline: ${timestampStr}]\n${doc.pageContent}`;
        }).join('\n\n');
        
        usingRAG = true;
        console.log(`[RAG] ${results.length} segments pertinents avec timelines récupérés pour la vidéo "${videoId}".`);
      } catch (ragError) {
        console.warn("[RAG] Échec de la recherche vectorielle, repli sur la transcription complète :", ragError);
      }
    }

    // Repli (fallback) sur la transcription complète
    if (!context && transcript) {
      context = transcript;
    }

    const systemPrompt = context
      ? `Tu es un assistant vidéo pédagogique et intelligent appelé SmartTube.
Ton rôle est d'aider l'utilisateur à comprendre la vidéo en te basant sur ${usingRAG ? "les extraits pertinents suivants de sa transcription avec leurs timelines" : "sa transcription complète"} :

<contexte_video>
${context}
</contexte_video>

Instructions impératives pour tes réponses :
1. Réponds de manière claire, concise et pédagogique en te basant sur ce contexte.
2. Réponds obligatoirement en français.
3. Pour chaque fait ou concept important que tu décris, tu dois citer sa timeline exacte sous le format précis : [Source: mm:ss] (ou [Source: hh:mm:ss] si la vidéo est longue). Base-toi strictement sur les annotations [Timeline: mm:ss] présentes dans le contexte. N'invente jamais de timeline !`
      : `Tu es un assistant vidéo pédagogique et intelligent appelé SmartTube. Tes réponses doivent IMPÉRATIVEMENT être en français.`;

    const openrouter = createOpenRouter({
      apiKey: process.env.AI_KEY,
    });

    const modelName = process.env.OPENROUTER_MODEL ;

    const result = streamText({
      model: openrouter.chat(modelName!),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      async onFinish({ text }) {
        if (videoId) {
          try {
            await prisma.chatMessage.create({
              data: {
                videoId,
                role: 'assistant',
                content: text,
                userId: currentUserRecord?.id ?? null,
              },
            });
          } catch (dbError) {
            console.error("Erreur sauvegarde message assistant:", dbError);
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Erreur Chatbot OpenRouter:', error);
    return new Response('Erreur interne du serveur', { status: 500 });
  }
}
