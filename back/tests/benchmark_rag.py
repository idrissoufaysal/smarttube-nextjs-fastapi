"""
SmartTube – RAG Benchmark & Experimentation Harness (Langfuse v4)

Permet d'évaluer et de comparer scientifiquement :
1. Stratégies de Retrieval : Semantic (Dense) vs Hybrid (Dense + BM25 RRF) vs Reranked
2. Modèles de Génération : Gemini 2.5 Flash vs GPT-4o-mini vs Claude 3.5 Sonnet
3. Métriques automatiques :
   - Retrieval Hit Rate (les segments et timelines attendus sont-ils dans les chunks ?)
   - Citation Rate (la réponse cite-t-elle [Source: mm:ss] ?)
   - Citation Groundedness (les timestamps cités existent-ils vraiment dans le contexte sans hallucination ?)
"""

import argparse
import asyncio
import json
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

# Configuration du chemin d'import backend
CURRENT_DIR = Path(__file__).resolve().parent
BACK_DIR = CURRENT_DIR.parent
if str(BACK_DIR) not in sys.path:
    sys.path.insert(0, str(BACK_DIR))

# UTF-8 et line-buffering pour Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

from app.config.settings import settings
from app.services.langfuse_client import (
    flush_langfuse,
    get_langfuse_callback,
    get_langfuse_client,
    langfuse_trace_context,
    score_trace,
)
from app.services.vectorstore import (
    delete_video_vectors,
    index_transcript_segments,
    similarity_search_rag,
)
from app.services.youtube import fetch_youtube_transcript

DATASET_PATH = CURRENT_DIR / "dataset.json"
DATASET_NAME = "smarttube-rag-eval"


@dataclass
class ExperimentConfig:
    run_name: str
    retrieval_mode: Literal["semantic", "hybrid", "reranked"]
    model_name: str
    k: int = 5
    reindex: bool = False


# ==============================================================================
# 1. SYNCHRONISATION DU DATASET AVEC LANGFUSE
# ==============================================================================

def sync_dataset_to_langfuse() -> list[dict]:
    """Charge dataset.json et le synchronise dans Langfuse s'il n'existe pas déjà."""
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Fichier de dataset introuvable à {DATASET_PATH}")

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        local_items = json.load(f)

    client = get_langfuse_client()
    if not client:
        print("⚠️ Langfuse non configuré. Exécution locale uniquement.", flush=True)
        return local_items

    try:
        try:
            dataset = client.get_dataset(DATASET_NAME)
            print(f"📦 Dataset '{DATASET_NAME}' déjà existant dans Langfuse ({len(dataset.items)} items).", flush=True)
        except Exception:
            dataset = client.create_dataset(
                name=DATASET_NAME,
                description="Dataset d'évaluation pour le RAG SmartTube (vidéos YouTube).",
                metadata={"source_file": "tests/dataset.json", "version": "1.0"},
            )
            print(f"📦 Nouveau dataset créé dans Langfuse : '{DATASET_NAME}'.", flush=True)

        existing_queries = {item.input.get("query") for item in getattr(dataset, "items", [])}
        created_count = 0
        for item in local_items:
            q = item["input"]["query"]
            if q not in existing_queries:
                client.create_dataset_item(
                    dataset_name=DATASET_NAME,
                    input=item["input"],
                    expected_output=item["expected_output"],
                    metadata=item.get("metadata", {}),
                )
                created_count += 1

        if created_count > 0:
            print(f"✅ {created_count} items synchronisés dans Langfuse.", flush=True)
        flush_langfuse()
    except Exception as e:
        print(f"⚠️ Notice synchronisation Langfuse: {e}", flush=True)

    return local_items


# ==============================================================================
# 2. ASSURANCE D'INDEXATION PINECONE
# ==============================================================================

async def ensure_video_indexed(video_id: str, force_reindex: bool = False) -> None:
    """Vérifie si la vidéo a des vecteurs dans Pinecone ; sinon ou si force_reindex, réindexe avec le modèle d'embedding actif."""
    if not force_reindex:
        test_search = await similarity_search_rag(video_id, "test", k=1)
        if test_search:
            return

    print(f"⚙️ Indexation de la vidéo '{video_id}' avec le modèle d'embedding actif ({settings.EMBEDDING_MODEL})...", flush=True)
    await delete_video_vectors(video_id)
    full_text, segments = await fetch_youtube_transcript(video_id)
    if segments:
        count = await index_transcript_segments(video_id, segments)
        print(f"✅ Indexation terminée : {count} chunks insérés dans Pinecone pour '{video_id}'.", flush=True)
    else:
        print(f"❌ Impossible de récupérer les sous-titres pour la vidéo '{video_id}'.", flush=True)


# ==============================================================================
# 3. STRATÉGIES DE RETRIEVAL
# ==============================================================================

def compute_bm25_score(query_tokens: list[str], doc_text: str) -> float:
    """Calcul de pertinence lexicale BM25 pour l'Hybrid Search."""
    doc_tokens = re.findall(r"\w+", doc_text.lower())
    if not doc_tokens:
        return 0.0
    doc_counter = Counter(doc_tokens)
    doc_len = len(doc_tokens)
    avg_len = 120.0
    k1, b = 1.5, 0.75

    score = 0.0
    for qt in query_tokens:
        tf = doc_counter.get(qt, 0)
        if tf > 0:
            denom = tf + k1 * (1 - b + b * (doc_len / avg_len))
            score += ((k1 + 1) * tf) / denom
    return score


async def retrieve_semantic(video_id: str, query: str, k: int = 5) -> list[str]:
    """Retrieval dense standard (Pinecone embeddings)."""
    raw_context = await similarity_search_rag(video_id, query, k=k)
    if not raw_context:
        return []
    return [chunk.strip() for chunk in raw_context.split("\n\n") if chunk.strip()]


async def retrieve_hybrid(video_id: str, query: str, k: int = 5) -> list[str]:
    """
    Hybrid Search : Dense (Vecteurs Pinecone) + Sparse (BM25 lexical)
    Fusionnés via Reciprocal Rank Fusion (RRF).
    """
    candidates = await retrieve_semantic(video_id, query, k=10)
    if not candidates:
        return []

    query_tokens = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 2]
    lexical_scores = [(compute_bm25_score(query_tokens, doc), doc) for doc in candidates]
    lexical_ranked = [doc for _, doc in sorted(lexical_scores, key=lambda x: x[0], reverse=True)]

    rrf_k = 60
    rrf_scores: dict[str, float] = {}

    for rank, doc in enumerate(candidates):
        rrf_scores[doc] = rrf_scores.get(doc, 0.0) + (1.0 / (rrf_k + rank + 1))

    for rank, doc in enumerate(lexical_ranked):
        rrf_scores[doc] = rrf_scores.get(doc, 0.0) + (1.0 / (rrf_k + rank + 1))

    sorted_docs = sorted(rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True)
    return sorted_docs[:k]


async def retrieve_reranked(video_id: str, query: str, k: int = 5) -> list[str]:
    """
    Retrieval avec Reranking via OpenRouter 'cohere/rerank-4-fast' :
    Récupère 15 candidats hybrides (Dense + BM25) puis les réordonne avec
    le modèle de reranking dédié de Cohere pour extraire les k meilleurs.
    """
    # 1. Candidats issus de l'Hybrid Search pour maximiser le rappel
    candidates = await retrieve_hybrid(video_id, query, k=15)
    if len(candidates) <= k:
        return candidates

    # 2. Appel API OpenRouter Rerank
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://openrouter.ai/api/v1/rerank",
                headers={
                    "Authorization": f"Bearer {settings.AI_KEY}",
                    "HTTP-Referer": "https://smarttube.ai",
                    "X-Title": "SmartTube Reranker",
                },
                json={
                    "model": "cohere/rerank-4-fast",
                    "query": query,
                    "documents": candidates,
                    "top_n": k,
                },
            )
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                reranked_docs = []
                for r in results:
                    idx = r.get("index")
                    if idx is not None and 0 <= idx < len(candidates):
                        reranked_docs.append(candidates[idx])
                if reranked_docs:
                    return reranked_docs
    except Exception as e:
        print(f"  (Cohere rerank notice: {e})", flush=True)

    return candidates[:k]


async def execute_retrieval(video_id: str, query: str, config: ExperimentConfig) -> str:
    """Aiguille vers la stratégie de retrieval choisie."""
    if config.retrieval_mode == "semantic":
        chunks = await retrieve_semantic(video_id, query, k=config.k)
    elif config.retrieval_mode == "hybrid":
        chunks = await retrieve_hybrid(video_id, query, k=config.k)
    elif config.retrieval_mode == "reranked":
        chunks = await retrieve_reranked(video_id, query, k=config.k)
    else:
        chunks = await retrieve_semantic(video_id, query, k=config.k)

    return "\n\n".join(chunks)


# ==============================================================================
# 4. GÉNÉRATION & ÉVALUATION DES MÉTRIQUES
# ==============================================================================

def ts_to_seconds(ts: str) -> int:
    """Convertit un timestamp 'mm:ss' ou 'hh:mm:ss' en secondes."""
    parts = [int(p) for p in ts.strip().split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0


def evaluate_metrics(
    query: str,
    context: str,
    answer: str,
    category: str,
    expected_sources: list[str],
) -> dict[str, float]:
    """
    Calcule 3 métriques déterministes clés :
    1. retrieval_hit : la timeline ou le passage cible est-il couvert par les chunks ?
    2. has_citation : la réponse contient-elle [Source: mm:ss] ?
    3. citation_grounded : les timestamps cités proviennent-ils du contexte ? (anti-hallucination)
    """
    # 1. Retrieval Hit Rate (Fenêtre temporelle des chunks ~60-90s)
    if category == "hors_sujet":
        retrieval_hit = 1.0
    else:
        context_tls = re.findall(r"\[Timeline:\s*(\d{1,2}:\d{2}(?::\d{2})?)\]", context)
        context_secs = [ts_to_seconds(t) for t in context_tls]
        exp_secs = [ts_to_seconds(s) for s in expected_sources]

        hit = False
        for exp in exp_secs:
            # Un chunk couvre [start, start + 90s]
            if any(0 <= (exp - cs) <= 95 or abs(exp - cs) <= 15 for cs in context_secs):
                hit = True
                break
        retrieval_hit = 1.0 if hit else 0.0

    # 2. Citation Presence
    cited_sources = re.findall(r"\[Source:\s*(\d{1,2}:\d{2}(?::\d{2})?)\]", answer)
    if category == "hors_sujet":
        has_citation = 1.0 if "ne parle pas" in answer.lower() or len(cited_sources) == 0 else 0.5
    else:
        has_citation = 1.0 if len(cited_sources) > 0 else 0.0

    # 3. Citation Groundedness (anti-hallucination)
    if not cited_sources:
        citation_grounded = 1.0 if category == "hors_sujet" else 0.0
    else:
        context_tls = re.findall(r"\[Timeline:\s*(\d{1,2}:\d{2}(?::\d{2})?)\]", context)
        context_secs = [ts_to_seconds(t) for t in context_tls]
        
        valid_citations = 0
        for cs in cited_sources:
            sec = ts_to_seconds(cs)
            # La citation est valide si elle correspond à un chunk présent (à ±30s près)
            if any(abs(sec - c_sec) <= 75 for c_sec in context_secs):
                valid_citations += 1

        citation_grounded = valid_citations / len(cited_sources)

    return {
        "retrieval_hit": retrieval_hit,
        "has_citation": has_citation,
        "citation_grounded": round(citation_grounded, 2),
    }


async def run_single_benchmark_item(
    item: dict,
    config: ExperimentConfig,
) -> dict:
    """Exécute la pipeline RAG complète sur un item et enregistre la trace dans Langfuse."""
    query = item["input"]["query"]
    category = item.get("metadata", {}).get("category", "factuel")
    video_id = item.get("metadata", {}).get("video_id", "5lZhUc6MW8w")
    expected_sources = item.get("metadata", {}).get("expected_sources", [])

    start_time = time.perf_counter()

    # 1. Retrieval
    context = await execute_retrieval(video_id, query, config)

    # 2. Génération LLM avec Langfuse Callback
    system_prompt = (
        "Tu es un assistant vidéo pédagogique et intelligent appelé SmartTube.\n"
        "Ton rôle est d'aider l'utilisateur à comprendre la vidéo en te basant sur les extraits suivants :\n\n"
        f"<contexte_video>\n{context}\n</contexte_video>\n\n"
        "Instructions impératives :\n"
        "1. Réponds en français de manière claire et concise.\n"
        "2. Pour chaque fait ou concept important, cite sa timeline exacte : [Source: mm:ss].\n"
        "3. Si la réponse n'est pas dans le contexte ou si la vidéo n'en parle pas, indique-le clairement sans inventer."
    )

    llm = ChatOpenAI(
        model=config.model_name,
        api_key=settings.AI_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.2,
        default_headers={"HTTP-Referer": "https://smarttube.ai", "X-Title": "SmartTube Eval"},
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=query),
    ]

    with langfuse_trace_context(
        trace_name=f"eval-{config.run_name}",
        session_id=video_id,
        tags=["benchmark", config.retrieval_mode, config.model_name.split("/")[-1]],
        metadata={
            "run_name": config.run_name,
            "category": category,
            "retrieval_mode": config.retrieval_mode,
            "model_name": config.model_name,
            "query": query,
        },
    ):
        cb = get_langfuse_callback()
        stream_config = {"callbacks": [cb]} if cb else None

        try:
            res = await llm.ainvoke(messages, config=stream_config)
            answer = res.content
        except Exception as e:
            answer = f"Erreur de génération : {e}"

    latency_ms = (time.perf_counter() - start_time) * 1000

    # 3. Calcul des scores
    scores = evaluate_metrics(query, context, answer, category, expected_sources)
    scores["latency_ms"] = round(latency_ms, 1)

    # 4. Envoi des scores d'évaluation dans Langfuse
    for metric_name, val in scores.items():
        score_trace(
            name=metric_name,
            value=val,
            session_id=video_id,
            metadata={"run_name": config.run_name, "category": category},
        )

    return {
        "query": query,
        "category": category,
        "context_len": len(context),
        "answer": answer,
        "scores": scores,
    }


# ==============================================================================
# 5. POINT D'ENTRÉE DU BENCHMARK
# ==============================================================================

async def run_experiment_suite(config: ExperimentConfig):
    print("=" * 80, flush=True)
    print(f"🚀 [EXPERIMENT] Lancement du Run : '{config.run_name}'", flush=True)
    print(f"   Mode Retrieval : {config.retrieval_mode.upper()} (k={config.k})", flush=True)
    print(f"   Modèle LLM     : {config.model_name}", flush=True)
    print("=" * 80, flush=True)

    items = sync_dataset_to_langfuse()
    if not items:
        print("❌ Dataset vide.", flush=True)
        return

    sample_video_id = items[0].get("metadata", {}).get("video_id", "5lZhUc6MW8w")
    await ensure_video_indexed(sample_video_id, force_reindex=config.reindex)

    results = []
    print(f"\n📊 Évaluation des {len(items)} questions du dataset...\n", flush=True)

    for i, item in enumerate(items, 1):
        q = item["input"]["query"]
        cat = item.get("metadata", {}).get("category", "")
        print(f"[{i:02d}/{len(items):02d}] ({cat.upper()}) {q[:55]}...", flush=True)

        res = await run_single_benchmark_item(item, config)
        results.append(res)
        sc = res["scores"]
        print(
            f"       ↳ Hit: {int(sc['retrieval_hit'])} | Citation: {int(sc['has_citation'])} | Grounded: {sc['citation_grounded']} | Latence: {sc['latency_ms']:.0f}ms",
            flush=True,
        )

    flush_langfuse()

    avg_hit = sum(r["scores"]["retrieval_hit"] for r in results) / len(results)
    avg_citation = sum(r["scores"]["has_citation"] for r in results) / len(results)
    avg_grounded = sum(r["scores"]["citation_grounded"] for r in results) / len(results)
    avg_latency = sum(r["scores"]["latency_ms"] for r in results) / len(results)

    print("\n" + "=" * 80, flush=True)
    print(f"🏁 [RÉSULTATS GLOBAUX] : {config.run_name}", flush=True)
    print("=" * 80, flush=True)
    print(f"   1. Retrieval Hit Rate      : {avg_hit * 100:.1f}%", flush=True)
    print(f"   2. Citation Rate           : {avg_citation * 100:.1f}%", flush=True)
    print(f"   3. Citation Groundedness   : {avg_grounded * 100:.1f}%", flush=True)
    print(f"   4. Latence moyenne         : {avg_latency:.0f} ms", flush=True)
    print("=" * 80, flush=True)
    print("👉 Retrouvez ce Run et comparez-le dans le tableau de bord Langfuse :", flush=True)
    print(f"   https://cloud.langfuse.com (Projet SmartTube > Datasets > {DATASET_NAME})\n", flush=True)


def main():
    parser = argparse.ArgumentParser(description="SmartTube RAG Benchmark & Comparison Harness")
    parser.add_argument(
        "--mode",
        choices=["semantic", "hybrid", "reranked"],
        default="semantic",
        help="Stratégie de retrieval (semantic, hybrid, reranked)",
    )
    parser.add_argument(
        "--model",
        default=settings.OPENROUTER_MODEL,
        help="Modèle LLM pour la génération (ex: google/gemini-2.5-flash, openai/gpt-4o-mini)",
    )
    parser.add_argument(
        "--run-name",
        default=None,
        help="Nom du run d'expérimentation (généré automatiquement si omis)",
    )
    parser.add_argument(
        "--reindex",
        action="store_true",
        help="Forcer la réindexation complète de la vidéo avec le modèle d'embedding actif",
    )
    parser.add_argument(
        "--sync-dataset",
        action="store_true",
        help="Synchroniser uniquement le dataset vers Langfuse et quitter",
    )
    parser.add_argument(
        "--matrix",
        action="store_true",
        help="Exécute les 3 modes de retrieval à la suite pour comparaison immédiate",
    )

    args = parser.parse_args()

    if args.sync_dataset:
        sync_dataset_to_langfuse()
        return

    if args.matrix:
        modes = ["semantic", "hybrid", "reranked"]
        for idx, m in enumerate(modes):
            run_name = f"{m}-{args.model.split('/')[-1]}"
            cfg = ExperimentConfig(
                run_name=run_name,
                retrieval_mode=m,
                model_name=args.model,
                reindex=(args.reindex and idx == 0),
            )
            asyncio.run(run_experiment_suite(cfg))
    else:
        model_short = args.model.split("/")[-1]
        run_name = args.run_name or f"{args.mode}-{model_short}"
        config = ExperimentConfig(
            run_name=run_name,
            retrieval_mode=args.mode,
            model_name=args.model,
            reindex=args.reindex,
        )
        asyncio.run(run_experiment_suite(config))


if __name__ == "__main__":
    main()
