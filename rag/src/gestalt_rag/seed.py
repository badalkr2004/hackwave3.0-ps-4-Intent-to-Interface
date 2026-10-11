from __future__ import annotations

import json
import logging

from gestalt_rag.config import ROOT
from gestalt_rag.schemas import AccessTier, IngestDocument
from gestalt_rag.store import ingest_documents

log = logging.getLogger("gestalt_rag")

SEED_DIR = ROOT / "seed"


def _docs_from_files() -> list[IngestDocument]:
    docs: list[IngestDocument] = []
    if not SEED_DIR.exists():
        return docs
    for path in sorted(SEED_DIR.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        for item in raw:
            docs.append(IngestDocument.model_validate(item))
    return docs


def _fallback_docs() -> list[IngestDocument]:
    return [
        IngestDocument(
            id="mom:acme-war-room",
            title="Acme export war-room minutes",
            text="Meeting with Acme about CSV export timeouts. Hotfix prioritized before Q4 BR.",
            source_type="mom",
            org_id="org_northwind",
            client_id="acme",
            date="2026-10-08",
            tags=["meeting", "export"],
            access_tier=AccessTier.public,
        )
    ]


def ensure_seeded() -> int:
    """Upsert all seed JSON files so both Northwind and Helios demos work after restart."""
    docs = _docs_from_files() or _fallback_docs()
    if not docs:
        return 0
    ingested, chunks = ingest_documents(docs)
    log.info("Seed upsert: %s documents (%s chunks)", ingested, chunks)
    return ingested
