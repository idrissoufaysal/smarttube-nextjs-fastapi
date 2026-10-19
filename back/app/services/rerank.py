"""
Reranking via OpenRouter (POST /api/v1/rerank) avec cohere/rerank-4-fast.

Le reranker est un cross-encoder : il re-score chaque chunk candidat directement
contre la requête, avec une précision bien supérieure à la similarité cosinus seule.
Stratégie classique "retrieve wide, rerank narrow" :
    hybrid search → ~RERANK_CANDIDATES (15) chunks → rerank → RERANK_TOP_N (5) chunks.

En cas d'erreur API ou d'absence de clé OpenRouter, on retourne les documents
dans leur ordre d'arrivée (repli gracieux sur le seul RRF).
"""

import logging

import httpx
from langchain_core.documents import Document

from app.config.settings import settings

logger = logging.getLogger(__name__)

OPENROUTER_RERANK_URL = "https://openrouter.ai/api/v1/rerank"
REQUEST_TIMEOUT = 15.0


async def rerank_documents(
    query: str,
    documents: list[Document],
    top_n: int | None = None,
) -> list[Document]:
    """
    Re-classe `documents` par pertinence vis-à-vis de `query` via le rerank model
    d'OpenRouter et retourne les `top_n` meilleurs.
    Chaque Document retourné reçoit un metadata `rerank_score`.
    """
    if not documents:
        return []

    top_n = top_n or settings.RERANK_TOP_N
    top_n = min(top_n, len(documents))

    # Sans clé OpenRouter : on garde simplement l'ordre RRF
    if not settings.AI_KEY:
        logger.info("[Rerank] AI_KEY absente — repli sur l'ordre du hybrid search.")
        return documents[:top_n]

    # 2 documents ou moins : le reranking n'apporte rien d'utile
    if len(documents) <= 2:
        return documents[:top_n]

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                OPENROUTER_RERANK_URL,
                headers={
                    "Authorization": f"Bearer {settings.AI_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.RERANK_MODEL,
                    "query": query,
                    "documents": [doc.page_content for doc in documents],
                    "top_n": top_n,
                },
            )
            resp.raise_for_status()
            results = resp.json()["results"]

        reranked: list[Document] = []
        for item in results:
            doc = documents[item["index"]]
            doc.metadata["rerank_score"] = item.get("relevance_score")
            reranked.append(doc)
        return reranked

    except Exception as e:
        logger.warning(
            "[Rerank] Échec du reranking (%s) — repli sur l'ordre du hybrid search.", e
        )
        return documents[:top_n]
