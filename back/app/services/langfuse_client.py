"""
Langfuse – Observabilité, traçabilité et évaluation des workflows LLM.

Ce module centralise la configuration de Langfuse v4 en suivant les meilleures pratiques :
- `langfuse_trace_context()` : Context manager pour propager `trace_name`, `session_id`, `user_id`, `tags`, `metadata`.
- `get_langfuse_callback()` : Retourne le `CallbackHandler` LangChain qui hérite automatiquement du contexte actif.
- `get_langfuse_client()` : Retourne le client natif `Langfuse` pour créer des spans, scores et traces manuelles.
- `flush_langfuse()` : Vide les événements asynchrones en mémoire vers Langfuse (lifespan shutdown, background tasks).
- `score_trace()` : Enregistre des scores d'évaluation ou du feedback utilisateur.

Si les clés Langfuse ne sont pas configurées, tout s'exécute en mode sécurisé (no-op).
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager, nullcontext
from typing import Any

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Initialisation des variables d'environnement Langfuse v4
if settings.LANGFUSE_PUBLIC_KEY:
    os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
if settings.LANGFUSE_SECRET_KEY:
    os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
if settings.langfuse_host:
    os.environ["LANGFUSE_HOST"] = settings.langfuse_host

_langfuse_client: Any | None = None
_langfuse_initialized = False


def is_langfuse_configured() -> bool:
    """Vérifie si les clés d'API Langfuse sont renseignées."""
    return bool(settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY)


def get_langfuse_client() -> Any | None:
    """
    Retourne une instance singleton du client SDK natif Langfuse.
    """
    global _langfuse_client, _langfuse_initialized

    if not is_langfuse_configured():
        if not _langfuse_initialized:
            logger.info(
                "[Langfuse] Clés non configurées — traçabilité désactivée. "
                "Ajoutez LANGFUSE_PUBLIC_KEY et LANGFUSE_SECRET_KEY dans .env pour l'activer."
            )
            _langfuse_initialized = True
        return None

    if _langfuse_client is not None:
        return _langfuse_client

    try:
        from langfuse import Langfuse

        _langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.langfuse_host,
        )
        _langfuse_initialized = True
        logger.info("[Langfuse] Client initialisé avec succès sur %s", settings.langfuse_host)
        return _langfuse_client
    except ImportError:
        logger.warning("[Langfuse] Package 'langfuse' non installé. Traçabilité désactivée.")
        return None
    except Exception as exc:
        logger.warning("[Langfuse] Erreur initialisation client : %s", exc)
        return None


def langfuse_trace_context(
    *,
    trace_name: str | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
):
    """
    Context manager pour propager les attributs de trace dans Langfuse v4.
    Tous les appels LangChain / LLM imbriqués hériteront de ce contexte.
    """
    if not is_langfuse_configured():
        return nullcontext()

    try:
        from langfuse import propagate_attributes

        return propagate_attributes(
            trace_name=trace_name,
            session_id=session_id,
            user_id=str(user_id) if user_id else None,
            tags=tags or [],
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.warning("[Langfuse] Erreur propagate_attributes : %s", exc)
        return nullcontext()


def get_langfuse_callback(
    *,
    session_id: str | None = None,
    user_id: str | None = None,
    trace_name: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Any | None:
    """
    Retourne un CallbackHandler LangChain configuré pour Langfuse v4.
    """
    if not is_langfuse_configured():
        return None

    # S'assurer que le client Langfuse singleton est initialisé
    get_langfuse_client()

    try:
        from langfuse.langchain import CallbackHandler

        handler = CallbackHandler(public_key=settings.LANGFUSE_PUBLIC_KEY)
        return handler
    except ImportError:
        logger.warning("[Langfuse] Package 'langfuse' non installé. Traçabilité désactivée.")
        return None
    except Exception as exc:
        logger.warning("[Langfuse] Erreur initialisation callback : %s", exc)
        return None


def flush_langfuse() -> None:
    """
    Force l'envoi immédiat de toutes les traces en attente vers Langfuse.
    """
    client = get_langfuse_client()
    if client is not None:
        try:
            client.flush()
        except Exception as exc:
            logger.warning("[Langfuse] Erreur lors du flush : %s", exc)


def score_trace(
    name: str,
    value: float | int | bool,
    *,
    session_id: str | None = None,
    trace_id: str | None = None,
    user_id: str | None = None,
    data_type: str = "NUMERIC",
    comment: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """
    Enregistre un score ou une métrique d'évaluation dans Langfuse.
    """
    client = get_langfuse_client()
    if client is None:
        return

    try:
        score_kwargs: dict[str, Any] = {
            "name": name,
            "value": value,
            "data_type": data_type,
        }
        if trace_id:
            score_kwargs["trace_id"] = trace_id
        if session_id:
            score_kwargs["session_id"] = session_id
        if user_id:
            score_kwargs["user_id"] = str(user_id)
        if comment:
            score_kwargs["comment"] = comment
        if metadata:
            score_kwargs["metadata"] = metadata

        if hasattr(client, "create_score"):
            client.create_score(**score_kwargs)
        elif hasattr(client, "score"):
            client.score(**score_kwargs)
        logger.info("[Langfuse] Score '%s' (%s) enregistré pour session='%s'", name, value, session_id)
    except Exception as exc:
        logger.warning("[Langfuse] Erreur lors de l'enregistrement du score : %s", exc)
