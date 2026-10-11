from __future__ import annotations

import os
from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

from gestalt_rag.config import get_settings

# Aliases users often put in .env → LangChain init_chat_model provider ids
_PROVIDER_ALIASES = {
    "google": "google_genai",
    "gemini": "google_genai",
    "google-genai": "google_genai",
    "google_genai": "google_genai",
    "groq": "groq",
    "anthropic": "anthropic",
    "openai": "openai",
}


def normalize_provider(provider: str) -> str:
    key = (provider or "").strip().lower()
    return _PROVIDER_ALIASES.get(key, key)


def _ensure_provider_env(provider: str) -> None:
    settings = get_settings()
    norm = normalize_provider(provider)
    if norm == "google_genai" and settings.google_api_key:
        os.environ.setdefault("GOOGLE_API_KEY", settings.google_api_key)
    if norm == "groq" and settings.groq_api_key:
        os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)


def clear_model_cache() -> None:
    get_chat_model.cache_clear()


@lru_cache
def get_chat_model() -> BaseChatModel:
    settings = get_settings()
    provider = normalize_provider(settings.llm_provider)
    _ensure_provider_env(provider)
    return init_chat_model(
        settings.llm_model,
        model_provider=provider,
        temperature=0.4,
    )


def get_fallback_model() -> BaseChatModel | None:
    settings = get_settings()
    if not settings.llm_fallback_provider or not settings.llm_fallback_model:
        return None
    provider = normalize_provider(settings.llm_fallback_provider)
    _ensure_provider_env(provider)
    return init_chat_model(
        settings.llm_fallback_model,
        model_provider=provider,
        temperature=0.4,
    )
