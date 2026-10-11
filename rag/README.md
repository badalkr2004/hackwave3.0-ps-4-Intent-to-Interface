# Gestalt RAG (chat sidecar)

Standalone FastAPI + LangChain service. Lives **outside** the Bun monorepo (`prototype/`) so workspace packages stay untouched.

If this process is down, Gestalt IntentBar / auction / dashboard keep working. Express treats chat as optional.

## Setup (`uv`)

```bash
cd rag
uv sync
cp .env.example .env   # add GOOGLE_API_KEY and/or GROQ_API_KEY
uv run gestalt-rag
# or: uv run uvicorn gestalt_rag.main:app --host 127.0.0.1 --port 8765
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/ingest` | Index documents |
| POST | `/chat` | Conversational answer grounded in retrieve + live SQL |
| POST | `/chat/stream` | SSE token stream of the same |

## Context sources

1. **Chroma seed** (`seed/*.json`) — MoM, tickets, usage/sales narratives, plus `schema_catalog.json` (table/column map).
2. **Live data plane** — with `PROTOTYPE_API_URL` set, each chat call POSTs to Express `POST /api/rag/live-context` for role-scoped rows (meetings, MoM, tickets, usage, overdue tasks, sales) and schema notes.
3. **Reindex** — Express `POST /api/rag/reindex` or browser `POST /api/chat/reindex` upserts live meetings/tickets/MoM into Chroma.

## Embeddings / store

- Preferred: `sentence-transformers/all-MiniLM-L6-v2` via `langchain-huggingface`
- Fallback (used automatically if torch/sklearn is blocked, e.g. Windows App Control): Chroma `ONNXMiniLM_L6_V2` (same model family)
- Vector DB: Chroma persistent under `data/chroma/` (gitignored)
- Without LLM keys, `/chat` still returns extractive prose from retrieve + live snapshot

## Isolation

Prototype Express proxies chat with short timeouts. Missing `RAG_SERVICE_URL` or a dead process never breaks compose/session.
