import re
import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from app.config.settings import settings


def extract_video_id(url: str) -> str | None:
    """
    Extrait l'ID de la vidéo YouTube (11 caractères) depuis différents formats d'URL.
    """
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})",
        r"youtube\.com/embed/([\w-]{11})",
        r"youtube\.com/shorts/([\w-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


async def fetch_video_metadata(video_id: str) -> dict:
    """
    Récupère les métadonnées de la vidéo (titre, auteur, miniature) via l'API oEmbed de YouTube.
    """
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    default_thumb = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(oembed_url)
            if res.status_code == 200:
                data = res.json()
                return {
                    "title": data.get("title") or "Vidéo sans titre",
                    "description": "",
                    "thumbnail": data.get("thumbnail_url") or default_thumb,
                    "author": data.get("author_name") or "",
                    "duration": 0,
                }
    except Exception as e:
        print(f"[YouTube Metadata] Erreur oEmbed pour {video_id}: {e}")

    return {
        "title": "Vidéo sans titre",
        "description": "",
        "thumbnail": default_thumb,
        "author": "",
        "duration": 0,
    }


async def fetch_youtube_transcript(video_id: str) -> tuple[str, list[dict]]:
    """
    Extrait les sous-titres avec timestamps.
    1. Essaie d'abord avec youtube-transcript-api (direct et gratuit)
    2. Repli vers Supadata si configuré en cas de blocage d'IP.
    """
    # 1. Tentative avec youtube-transcript-api
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        # Priorité au français, puis anglais, puis première langue disponible
        try:
            transcript_obj = transcript_list.find_transcript(["fr"])
        except Exception:
            try:
                transcript_obj = transcript_list.find_transcript(["en"])
            except Exception:
                transcript_obj = next(iter(transcript_list))

        raw_items = transcript_obj.fetch()
        segments = [
            {
                "text": item.get("text", "").strip(),
                "start": float(item.get("start", 0)),
                "duration": float(item.get("duration", 0)),
            }
            for item in raw_items
            if item.get("text", "").strip()
        ]
        full_text = " ".join(seg["text"] for seg in segments)
        if full_text:
            return full_text, segments
    except (NoTranscriptFound, TranscriptsDisabled, Exception) as yt_err:
        print(f"[YouTubeTranscriptApi] {yt_err}. Tentative de repli vers Supadata...")

    # 2. Repli Supadata
    if settings.SUPADATA_API_KEY:
        try:
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(
                    "https://api.supadata.ai/v1/youtube/transcript",
                    params={"url": video_url, "lang": "fr", "text": "false"},
                    headers={"x-api-key": settings.SUPADATA_API_KEY},
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data.get("content", [])
                    if not content:
                        # Deuxième tentative sans spécifier la langue
                        res_fallback = await client.get(
                            "https://api.supadata.ai/v1/youtube/transcript",
                            params={"url": video_url, "text": "false"},
                            headers={"x-api-key": settings.SUPADATA_API_KEY},
                        )
                        if res_fallback.status_code == 200:
                            content = res_fallback.json().get("content", [])

                    if content:
                        segments = [
                            {
                                "text": seg.get("text", "").strip(),
                                "start": float(seg.get("offset", 0)) / 1000.0 if seg.get("offset", 0) > 10000 else float(seg.get("offset", 0)),
                                "duration": float(seg.get("duration", 0)) / 1000.0 if seg.get("duration", 0) > 10000 else float(seg.get("duration", 0)),
                            }
                            for seg in content
                        ]
                        full_text = " ".join(seg["text"] for seg in segments)
                        return full_text, segments
        except Exception as supa_err:
            print(f"[Supadata] Erreur: {supa_err}")

    raise ValueError("Impossible d'extraire les sous-titres pour cette vidéo YouTube.")
