"""
Perplexity Embeddings API (api.perplexity.ai) — modèle pplx-embed-v1-0.6b.

Points critiques de cette API (différents d'OpenAI) :
- Les vecteurs sont renvoyés **base64-encoded en int8** (encoding_format="base64_int8"
  par défaut), et non en tableau de floats comme OpenAI.
- Les vecteurs sont **non normalisés** : il faut comparer en similarité cosinus.
  On les normalise ici (L2) pour que le calcul reste correct quel que soit le
  metric de l'index Pinecone (cosine ou dotproduct).
- Limites : 512 textes par requête, 120K tokens cumulés par requête, 32K tokens par texte.
- Le modèle supporte Matryoshka : dimensions paramétrables de 128 à 1024.

Cette classe implémente l'interface `Embeddings` de LangChain pour être
utilisée telle quelle avec PineconeVectorStore / les appels manuels.
"""

import base64
import logging

import httpx
import numpy as np
from langchain_core.embeddings import Embeddings

from app.config.settings import settings

logger = logging.getLogger(__name__)

PERPLEXITY_EMBEDDINGS_URL = "https://api.perplexity.ai/v1/embeddings"
# Limites API : 512 textes / requête, 120K tokens cumulés. On reste large sous la limite.
MAX_TEXTS_PER_BATCH = 100
MAX_TOKENS_PER_BATCH = 100_000
REQUEST_TIMEOUT = 30.0


class PerplexityEmbeddings(Embeddings):
    """
    Embeddings compatibles LangChain via l'API Embeddings de Perplexity.
    Décode les vecteurs base64 int8 et les normalise (L2).
    """

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        dimensions: int | None = None,
    ):
        self.model = model or settings.EMBEDDING_MODEL
        self.api_key = api_key or settings.PERPLEXITY_API_KEY
        self.dimensions = dimensions or settings.EMBEDDING_DIMENSIONS
        if not self.api_key:
            raise ValueError(
                "PERPLEXITY_API_KEY manquant : impossible d'initialiser "
                f"PerplexityEmbeddings (modèle {self.model})."
            )

    # ------------------------------------------------------------------ #
    # Requêtes API
    # ------------------------------------------------------------------ #
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _payload(self, texts: list[str]) -> dict:
        return {
            "model": self.model,
            "input": [t if t.strip() else "…" for t in texts],
            # Matryoshka : 128-1024 pour pplx-embed-v1-0.6b
            "dimensions": self.dimensions,
            # On garde l'encodage int8 par défaut (payload plus léger) et on décode nous-mêmes
            "encoding_format": "base64_int8",
        }

    def _decode_embedding(self, b64_value: str) -> list[float]:
        """Décode un vecteur base64 int8 → liste de floats L2-normalisés."""
        vec = np.frombuffer(base64.b64decode(b64_value), dtype=np.int8).astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        if len(vec) != self.dimensions:
            logger.warning(
                "[PerplexityEmbeddings] Dimension inattendue : %s (attendu %s)",
                len(vec),
                self.dimensions,
            )
        return vec.tolist()

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """Heuristique ~4 caractères par token (marge de sécurité pour le français)."""
        return max(1, len(text) // 3)

    def _batches(self, texts: list[str]) -> list[list[str]]:
        """Découpe les textes en sous-lots sous les limites API (textes et tokens)."""
        batches: list[list[str]] = []
        current: list[str] = []
        current_tokens = 0
        for text in texts:
            t = self._estimate_tokens(text)
            if current and (
                len(current) >= MAX_TEXTS_PER_BATCH
                or current_tokens + t > MAX_TOKENS_PER_BATCH
            ):
                batches.append(current)
                current, current_tokens = [], 0
            current.append(text)
            current_tokens += t
        if current:
            batches.append(current)
        return batches

    def _embed_batch_sync(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for batch in self._batches(texts):
                resp = client.post(
                    PERPLEXITY_EMBEDDINGS_URL,
                    headers=self._headers(),
                    json=self._payload(batch),
                )
                resp.raise_for_status()
                data = resp.json()
                # L'API peut renvoyer les items dans n'importe quel ordre : on trie par index
                items = sorted(data["data"], key=lambda item: item["index"])
                results.extend(self._decode_embedding(item["embedding"]) for item in items)
        return results

    async def _embed_batch_async(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for batch in self._batches(texts):
                resp = await client.post(
                    PERPLEXITY_EMBEDDINGS_URL,
                    headers=self._headers(),
                    json=self._payload(batch),
                )
                resp.raise_for_status()
                data = resp.json()
                items = sorted(data["data"], key=lambda item: item["index"])
                results.extend(self._decode_embedding(item["embedding"]) for item in items)
        return results

    # ------------------------------------------------------------------ #
    # Interface LangChain Embeddings
    # ------------------------------------------------------------------ #
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed_batch_sync(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._embed_batch_sync([text])[0]

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed_batch_async(texts)

    async def aembed_query(self, text: str) -> list[float]:
        return (await self._embed_batch_async([text]))[0]
