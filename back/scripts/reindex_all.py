"""
Ré-indexe toutes les vidéos PostgreSQL dans Pinecone avec le pipeline actuel
(text-embedding-3-small + BM25 sparse → hybrid search).

À lancer après tout changement de modèle d'embeddings, de dimension, ou pour
ajouter la branche BM25 à des vidéos indexées avant le hybrid search :
    cd back && uv run python scripts/reindex_all.py

Prérequis : l'index Pinecone doit avoir une dimension = EMBEDDING_DIMENSIONS
(1536 pour text-embedding-3-small). Le script vérifie et refuse de tourner sinon.
"""

import asyncio
import sys
from pathlib import Path

# Permet d'importer `app.*` en lançant le script depuis back/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config.settings import settings
from app.db.models import Video
from app.db.session import async_session_factory
from app.services.vectorstore import (
    delete_video_vectors,
    get_pinecone_index,
    index_transcript_segments,
)


async def main() -> None:
    # 1. Vérifier la dimension de l'index Pinecone (changement de modèle = changement de dim)
    index = get_pinecone_index()
    desc = index.describe_index_stats()
    expected = settings.EMBEDDING_DIMENSIONS
    # describe_index_stats ne renvoie pas toujours la dimension ; on tente l'API admin si besoin
    dimension = getattr(desc, "dimension", None)
    if dimension is None:
        from pinecone import Pinecone

        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        dimension = pc.describe_index(settings.PINECONE_INDEX).dimension

    print(f"Index '{settings.PINECONE_INDEX}' : dimension={dimension}, attendu={expected}")
    if dimension != expected:
        print(
            f"\nERREUR : l'index a une dimension {dimension} mais le modèle "
            f"{settings.EMBEDDING_MODEL} produit {expected} dimensions.\n"
            f"Recréez l'index Pinecone (nom: {settings.PINECONE_INDEX}, dimension: {expected}, "
            f"metric: cosine) puis relancez ce script."
        )
        sys.exit(1)

    # 2. Re-indexer chaque vidéo ayant des segments
    async with async_session_factory() as db:
        result = await db.execute(
            select(Video).options(selectinload(Video.segments)).order_by(Video.createdAt)
        )
        videos = result.scalars().all()

    print(f"{len(videos)} vidéo(s) trouvée(s) en base.\n")
    total_chunks = 0
    skipped = 0

    for video in videos:
        segments = sorted(video.segments, key=lambda s: s.start)
        if not segments:
            print(f"  ⏭  {video.id} — aucun segment, ignorée.")
            skipped += 1
            continue

        # Suppression de l'ancien namespace (anciens vecteurs 2048 dims, etc.)
        await delete_video_vectors(video.id)

        payload = [
            {"text": s.text, "start": s.start, "duration": s.duration} for s in segments
        ]
        n = await index_transcript_segments(video.id, payload)
        total_chunks += n
        print(f"  ✓  {video.id} — {video.title[:50]}… → {n} chunks")

    print(f"\nTerminé : {total_chunks} chunks indexés, {skipped} vidéo(s) ignorée(s).")


if __name__ == "__main__":
    asyncio.run(main())
