"""Gestalt RAG chat sidecar — optional FastAPI service outside the Bun monorepo."""

from gestalt_rag.main import run


def main() -> None:
    run()


__all__ = ["main", "run"]
