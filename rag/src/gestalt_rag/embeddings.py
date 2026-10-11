from __future__ import annotations

import logging
from functools import lru_cache

from langchain_core.embeddings import Embeddings

from gestalt_rag.config import get_settings

log = logging.getLogger("gestalt_rag")


class _OnnxMiniLmEmbeddings(Embeddings):
    """Chroma's ONNX all-MiniLM-L6-v2 — no torch/sklearn (works under Windows App Control)."""

    def __init__(self) -> None:
        from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2

        self._ef = ONNXMiniLM_L6_V2()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._ef(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._ef([text])[0]


def _try_sentence_transformers(model_name: str) -> Embeddings | None:
    try:
        from langchain_huggingface import HuggingFaceEmbeddings

        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    except Exception as err:
        log.warning("sentence-transformers unavailable (%s); using ONNX MiniLM", err)
        return None


@lru_cache
def get_embeddings() -> Embeddings:
    settings = get_settings()
    # Prefer local ST when the host allows it; otherwise ONNX MiniLM (same family).
    st = _try_sentence_transformers(settings.embedding_model)
    if st is not None:
        # Probe once — Windows Application Control can import the package then fail on DLL.
        try:
            st.embed_query("ping")
            log.info("Using HuggingFaceEmbeddings: %s", settings.embedding_model)
            return st
        except Exception as err:
            log.warning("HuggingFaceEmbeddings probe failed (%s); using ONNX MiniLM", err)
    log.info("Using Chroma ONNXMiniLM_L6_V2 embeddings")
    return _OnnxMiniLmEmbeddings()
