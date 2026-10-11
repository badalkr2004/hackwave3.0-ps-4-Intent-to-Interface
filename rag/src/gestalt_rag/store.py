from functools import lru_cache

import chromadb
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from gestalt_rag.config import chroma_path, get_settings
from gestalt_rag.embeddings import get_embeddings
from gestalt_rag.schemas import IngestDocument


@lru_cache
def get_vector_store() -> Chroma:
    settings = get_settings()
    client = chromadb.PersistentClient(path=str(chroma_path(settings)))
    return Chroma(
        client=client,
        collection_name=settings.collection_name,
        embedding_function=get_embeddings(),
    )


def _meta(doc: IngestDocument) -> dict:
    tags = ",".join(doc.tags) if doc.tags else ""
    return {
        "source_id": doc.id,
        "source_type": doc.source_type,
        "org_id": doc.org_id,
        "client_id": doc.client_id or "",
        "date": doc.date or "",
        "ticket_id": doc.ticket_id or "",
        "tags": tags,
        "access_tier": doc.access_tier.value,
        "title": doc.title or doc.id,
    }


def ingest_documents(documents: list[IngestDocument]) -> tuple[int, int]:
    if not documents:
        return 0, 0
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    store = get_vector_store()
    chunks: list[Document] = []
    ids: list[str] = []
    for doc in documents:
        parts = splitter.split_text(doc.text)
        if not parts:
            parts = [doc.text]
        base = _meta(doc)
        for i, text in enumerate(parts):
            chunk_id = f"{doc.id}::c{i}"
            ids.append(chunk_id)
            chunks.append(
                Document(
                    page_content=text,
                    metadata={**base, "chunk_id": chunk_id},
                )
            )
    # Upsert by deleting existing ids for these docs then adding
    source_ids = {d.id for d in documents}
    try:
        existing = store.get(where={"source_id": {"$in": list(source_ids)}})
        old_ids = existing.get("ids") or []
        if old_ids:
            store.delete(ids=old_ids)
    except Exception:
        pass
    store.add_documents(chunks, ids=ids)
    return len(documents), len(chunks)


def retrieve(
    query: str,
    *,
    org_id: str,
    client_ids: list[str],
    access_tiers: list[str],
    k: int | None = None,
) -> list[Document]:
    settings = get_settings()
    store = get_vector_store()
    top_k = k or settings.top_k

    where: dict = {
        "$and": [
            {"org_id": org_id},
            {"access_tier": {"$in": access_tiers}},
        ]
    }
    if client_ids:
        where["$and"].append({"client_id": {"$in": [*client_ids, ""]}})

    try:
        return store.similarity_search(query, k=top_k, filter=where)
    except Exception:
        # Never drop org filter (isolation). Retry with org + tier only.
        try:
            return store.similarity_search(
                query,
                k=top_k,
                filter={
                    "$and": [
                        {"org_id": org_id},
                        {"access_tier": {"$in": access_tiers}},
                    ]
                },
            )
        except Exception:
            return []
