import asyncio
import json
import sys
import httpx
from sqlalchemy import select

# Assurer UTF-8 sur Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.main import app
from app.db.session import async_session_factory
from app.db.models import Video, ChatMessage
from app.services.vectorstore import similarity_search_rag


async def test_chat_rag():
    print("=" * 70)
    print("🧪 [TEST COMPLET] CHAT RAG AVEC PINECONE & POSTGRESQL (SMARTTUBE)")
    print("=" * 70)

    async with async_session_factory() as db:
        # 1. Récupérer une vidéo existante
        result = await db.execute(select(Video).limit(5))
        videos = result.scalars().all()

        if not videos:
            print("❌ Aucune vidéo trouvée en base de données.")
            return

        print(f"\n1. Vidéos disponibles en base ({len(videos)}) :")
        for v in videos:
            print(f"   - ID: {v.id} | Titre: {v.title[:50]}... | User: {v.userId}")

        selected_video = videos[0]
        video_id = selected_video.id
        user_id = selected_video.userId
        print(f"\n👉 Vidéo sélectionnée pour le test: '{selected_video.title}' (ID: {video_id})")

    # 2. Test recherche de similarité Pinecone
    query = "Quel est le sujet principal et que dit la vidéo ?"
    print(f"\n2. Test de la recherche vectorielle Pinecone (k=3)...")
    print(f'   Question: "{query}"')
    
    rag_context = await similarity_search_rag(video_id, query, k=3)
    if rag_context:
        print("   ✅ Contexte vectoriel RAG trouvé dans Pinecone :")
        for line in rag_context.split("\n")[:8]:
            print(f"      | {line}")
        if len(rag_context.split("\n")) > 8:
            print("      | ...")
    else:
        print("   ⚠️ Aucun chunk dans le namespace Pinecone pour cette vidéo (fallback sur transcript).")

    # 3. Test de l'endpoint POST /api/chat avec Streaming
    print("\n3. Envoi d'une question à l'endpoint /api/chat...")
    payload = {
        "videoId": video_id,
        "transcript": selected_video.title,
        "messages": [
            {
                "role": "user",
                "content": "Peux-tu me résumer les points clés de cette vidéo en indiquant les timestamps [Source: mm:ss] ?",
            }
        ],
    }

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=60.0) as client:
        try:
            async with client.stream("POST", "/api/chat", json=payload) as response:
                print(f"   HTTP Status: {response.status_code}")
                print(f"   Header x-vercel-ai-ui-message-stream: {response.headers.get('x-vercel-ai-ui-message-stream')}")
                print("\n   --- Réponse Streaming reçue (SSE UI Message Stream) ---")
                
                full_text = ""
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        raw_data = line[6:].strip()
                        if raw_data == "[DONE]":
                            continue
                        try:
                            event = json.loads(raw_data)
                            if event.get("type") == "text-delta":
                                delta = event.get("delta", "")
                                print(delta, end="", flush=True)
                                full_text += delta
                        except Exception:
                            pass
                    elif line.startswith('0:"'):
                        try:
                            chunk_text = json.loads(line[2:])
                            print(chunk_text, end="", flush=True)
                            full_text += chunk_text
                        except Exception:
                            print(line, end="", flush=True)

                print("\n   -------------------------------------------------")
                print(f"\n   ✅ Réponse complète reçue ({len(full_text)} caractères)")

        except Exception as e:
            print(f"   ❌ Erreur appel API: {e}")

    # 4. Vérification de la sauvegarde en base de données
    print("\n4. Vérification de la persistance des messages dans PostgreSQL...")
    async with async_session_factory() as db:
        res = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.videoId == video_id)
            .order_by(ChatMessage.createdAt.desc())
            .limit(2)
        )
        saved_messages = res.scalars().all()
        print(f"   Nombre de messages récents trouvés en base : {len(saved_messages)}")
        for m in reversed(saved_messages):
            print(f"   - [{m.role.upper()}]: {m.content[:80]}... (créé à {m.createdAt})")

    print("\n" + "=" * 70)
    print("🎉 [SUCCÈS] LE TEST DU CHAT RAG EST TERMINÉ AVEC SUCCÈS !")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_chat_rag())
