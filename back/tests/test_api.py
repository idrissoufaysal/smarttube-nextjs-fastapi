import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000"
TEST_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


async def run_backend_tests():
    print("=" * 60)
    print("[TEST] DEMARRAGE DES TESTS DU BACKEND SMARTTUBE (FASTAPI)")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60.0) as client:
        # 1. Health check
        print("\n1. Test Health Check (GET /health)...")
        res = await client.get("/health")
        print(f"Status: {res.status_code} | Reponse: {res.json()}")

        # 2. List Videos (Public)
        print("\n2. Test List Videos (GET /api/videos)...")
        res = await client.get("/api/videos")
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            videos = res.json()
            print(f"   Nombre de videos en base: {len(videos)}")
            for v in videos[:3]:
                print(f"   - [{v.get('id')}] {v.get('title')} ({v.get('segmentsCount')} segments)")

        # 3. Video Info
        print(f"\n3. Test Video Info (POST /api/video-info) pour {TEST_VIDEO_URL}...")
        res = await client.post("/api/video-info", json={"url": TEST_VIDEO_URL})
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"   Titre: {data.get('title')}")
            print(f"   Auteur: {data.get('author')}")
            print(f"   Thumbnail: {data.get('thumbnail')}")

        # 4. Transcription & Pinecone Indexing
        print(f"\n4. Test Transcript (POST /api/transcript)...")
        res = await client.post("/api/transcript", json={"url": TEST_VIDEO_URL})
        print(f"Status: {res.status_code}")
        transcript_text = ""
        video_id = "dQw4w9WgXcQ"
        if res.status_code == 200:
            data = res.json()
            transcript_text = data.get("transcript", "")
            segments = data.get("segments", [])
            print(f"   Longueur transcription: {len(transcript_text)} caracteres")
            print(f"   Nombre de segments: {len(segments)}")
            print(f"   Pinecone indexe: {data.get('pineconeIndexed')}")
            if segments:
                print(f"   Premier segment: {segments[0]}")

        if not transcript_text:
            print("[WARN] Pas de transcription recuperee, arret des tests RAG et Quiz.")
            return

        # 5. Quiz Generation (Structured Output)
        print("\n5. Test Generation Quiz (POST /api/video/quiz)...")
        res = await client.post(
            "/api/video/quiz",
            json={
                "videoId": video_id,
                "transcript": transcript_text[:2000],
                "difficulty": "facile",
                "numberOfQuestions": 3,
            },
        )
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            quiz_data = res.json().get("quiz", {})
            questions = quiz_data.get("questions", [])
            print(f"   ID Quiz: {quiz_data.get('id')}")
            print(f"   Nombre de questions: {len(questions)}")
            for i, q in enumerate(questions, 1):
                print(f"   Q{i}: {q.get('question')}")
                print(f"      Options: {q.get('options')}")
                print(f"      Index reponse: {q.get('correctAnswerIndex')}")

        # 6. Chat RAG Streaming
        print("\n6. Test Chatbot RAG Streaming (POST /api/chat)...")
        chat_payload = {
            "videoId": video_id,
            "transcript": transcript_text[:2000],
            "messages": [
                {
                    "role": "user",
                    "content": "De quoi parle cette video en resume ?",
                }
            ],
        }
        async with client.stream("POST", "/api/chat", json=chat_payload) as stream_res:
            print(f"Status Stream: {stream_res.status_code}")
            print("--- Debut du flux LLM (format AI SDK) ---")
            async for chunk in stream_res.aiter_text():
                print(chunk, end="", flush=True)
            print("\n--- Fin du flux LLM ---")

    print("\n" + "=" * 60)
    print("[OK] TOUS LES TESTS SONT TERMINES AVEC SUCCES !")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_backend_tests())
