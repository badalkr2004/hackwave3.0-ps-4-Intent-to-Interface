from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_provider: str = "google_genai"
    llm_model: str = "gemini-2.0-flash"
    llm_fallback_provider: str | None = None
    llm_fallback_model: str | None = None

    google_api_key: str | None = None
    groq_api_key: str | None = None

    rag_api_key: str | None = None
    # Express prototype (live SQL snapshot + reindex). Empty = vector-only chat.
    prototype_api_url: str | None = "http://127.0.0.1:8787"
    prototype_timeout_s: float = 12.0
    host: str = "127.0.0.1"
    port: int = 8765
    chroma_dir: str = "data/chroma"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    collection_name: str = "gestalt_docs"
    top_k: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()


def chroma_path(settings: Settings | None = None) -> Path:
    s = settings or get_settings()
    path = Path(s.chroma_dir)
    if not path.is_absolute():
        path = ROOT / path
    path.mkdir(parents=True, exist_ok=True)
    return path
