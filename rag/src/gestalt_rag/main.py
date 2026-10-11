from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from queue import Empty, Queue

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from gestalt_rag.config import get_settings
from gestalt_rag.llm import normalize_provider
from gestalt_rag.pipeline import generate_chat, llm_configured, offline_seed_response, stream_chat_events
from gestalt_rag.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    IngestRequest,
    IngestResponse,
)
from gestalt_rag.data_plane import request_reindex
from gestalt_rag.seed import ensure_seeded
from gestalt_rag.store import ingest_documents

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("gestalt_rag")
_executor = ThreadPoolExecutor(max_workers=2)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        n = ensure_seeded()
        if n:
            log.info("Seeded %s demo documents into Chroma", n)
    except Exception as err:
        log.warning("Seed on startup failed (service still up): %s", err)
    # Best-effort: pull live meetings/tickets from Express into Chroma
    for org, clients in (
        ("org_northwind", ["acme", "globex", "initech", "umbrella"]),
        ("org_helios", ["vertex", "oakmont", "pulse"]),
    ):
        try:
            request_reindex(org, clients)
        except Exception as err:
            log.warning("Startup reindex %s skipped: %s", org, err)
    yield


app = FastAPI(title="Gestalt RAG Chat", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(x_rag_api_key: str | None = Header(default=None)) -> None:
    expected = get_settings().rag_api_key
    if not expected:
        return
    if x_rag_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid RAG API key")


def _run_chat(body: ChatRequest) -> ChatResponse:
    if not llm_configured():
        return offline_seed_response(body)
    try:
        return generate_chat(body)
    except Exception as err:
        log.exception("chat failed: %s", err)
        return offline_seed_response(body)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    s = get_settings()
    return HealthResponse(
        embedding_model=s.embedding_model,
        llm_provider=normalize_provider(s.llm_provider),
        llm_model=s.llm_model,
    )


@app.post("/ingest", response_model=IngestResponse, dependencies=[Depends(require_api_key)])
def ingest(body: IngestRequest) -> IngestResponse:
    docs, chunks = ingest_documents(body.documents)
    return IngestResponse(ingested=docs, chunk_count=chunks)


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(require_api_key)])
def chat(body: ChatRequest) -> ChatResponse:
    return _run_chat(body)


async def _stream_chat(body: ChatRequest) -> AsyncIterator[str]:
    def sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    loop = asyncio.get_running_loop()
    q: Queue[tuple[str, dict] | None] = Queue()

    def worker() -> None:
        try:
            for event, data in stream_chat_events(body):
                q.put((event, data))
        except Exception as err:
            log.exception("stream worker failed: %s", err)
            q.put(("error", {"message": "Chatbot service: an error occurred."}))
        finally:
            q.put(None)

    fut = loop.run_in_executor(_executor, worker)
    try:
        while True:
            try:
                item = q.get_nowait()
            except Empty:
                if fut.done():
                    break
                await asyncio.sleep(0.02)
                continue
            if item is None:
                break
            event, data = item
            yield sse(event, data)
        await fut
    except Exception as err:
        log.exception("stream failed: %s", err)
        yield sse("error", {"message": "Chatbot service: an error occurred."})


@app.post("/chat/stream", dependencies=[Depends(require_api_key)])
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_chat(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def run() -> None:
    import uvicorn

    s = get_settings()
    uvicorn.run(
        "gestalt_rag.main:app",
        host=s.host,
        port=s.port,
        reload=False,
    )
