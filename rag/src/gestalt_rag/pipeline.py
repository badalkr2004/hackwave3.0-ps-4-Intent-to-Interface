from __future__ import annotations

import logging
from collections.abc import Iterator

from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from gestalt_rag.data_plane import fetch_live_context
from gestalt_rag.llm import get_chat_model, get_fallback_model, normalize_provider
from gestalt_rag.policy import tiers_for
from gestalt_rag.schemas import ChatRequest, ChatResponse, Citation
from gestalt_rag.store import retrieve

log = logging.getLogger("gestalt_rag")

SYSTEM_PROMPT = """You are Gestalt chat — a helpful workplace assistant (ChatGPT/Claude style).
Answer using the retrieved documents AND the live database snapshot.

Formatting (important — the UI renders Markdown + safe HTML):
- Use GitHub-flavored Markdown: **bold**, headings, bullet/numbered lists, and tables.
- For ticket/issue lists, prefer a Markdown table with columns like Key | Status | Priority | Summary | Link.
- Make Jira/browse URLs real markdown links: [KAN-5](https://…).
- When a compact disposable card helps (tickets, meetings, risks), you may emit a short HTML block:
  <div class="chat-card">…inner markdown-friendly HTML like <strong>, <ul>, <a>…</div>
- Keep cards small and optional; always include a normal prose answer above or below.
- Do NOT emit JSON UI specs, React, or dashboard component names.

Grounding rules:
- Prefer LIVE DATABASE SNAPSHOT for current meetings/MoM, usage, overdue tasks, clients, and sales.
- For engineering tickets: prefer "Atlassian Jira (live)" (real keys like PROJ-12).
  Demo story tickets (H-T*, T-*) are secondary — only if the user asks about demo data or live Jira is unavailable.
- Use RETRIEVED DOCUMENTS for narrative detail.
- Never invent ticket IDs, metrics, dates, or clients that are not in the provided context.
- Respect the user's access role; do not speculate about redacted/management data.
"""


def _source_id(doc: Document) -> str:
    meta = doc.metadata or {}
    if meta.get("ticket_id"):
        return f"jira:{meta['ticket_id']}"
    return str(meta.get("source_id") or meta.get("chunk_id") or "unknown")


def _title(doc: Document) -> str:
    return str((doc.metadata or {}).get("title") or _source_id(doc))


def _format_context(docs: list[Document]) -> str:
    lines: list[str] = []
    for i, doc in enumerate(docs, 1):
        meta = doc.metadata or {}
        lines.append(
            f"[{i}] id={_source_id(doc)} title={_title(doc)} "
            f"type={meta.get('source_type') or 'doc'} client={meta.get('client_id') or '-'}\n"
            f"{doc.page_content}"
        )
    return "\n\n".join(lines) if lines else "(no documents retrieved)"


def _citations(docs: list[Document], live: str | None) -> list[Citation]:
    seen: set[str] = set()
    out: list[Citation] = []
    if live:
        out.append(Citation(id="live:postgres", label="Live database snapshot"))
        seen.add("live:postgres")
    for d in docs:
        cid = _source_id(d)
        if cid in seen:
            continue
        seen.add(cid)
        out.append(Citation(id=cid, label=_title(d)))
        if len(out) >= 10:
            break
    return out


def _retrieve(req: ChatRequest) -> list[Document]:
    tiers = tiers_for(req.access_role)
    # Bias retrieval toward meetings/tickets/schema when the question smells operational.
    q = req.message.lower()
    bias = ""
    if any(k in q for k in ("meeting", "mom", "minutes", "prepare", "tomorrow")):
        bias = "meeting MoM minutes commitments agenda"
    elif any(k in q for k in ("ticket", "jira", "bug", "issue", "incident")):
        bias = "jira ticket bug engineering issue"
    elif any(k in q for k in ("usage", "drop", "dau", "seat")):
        bias = "usage metrics seats drop"
    elif any(k in q for k in ("overdue", "task", "blocked", "slipping")):
        bias = "overdue tasks commitments"
    elif any(k in q for k in ("schema", "table", "database", "sql", "column")):
        bias = "database schema tables columns SQL"
    query = f"{req.message}\n{bias}".strip()
    return retrieve(
        query,
        org_id=req.org_id,
        client_ids=req.client_ids,
        access_tiers=tiers,
    )


def _empty_reply(req: ChatRequest) -> str:
    clients = ", ".join(req.client_ids) if req.client_ids else "(none linked)"
    return (
        f"I couldn’t find indexed documents or live rows for this org under your access "
        f"({req.access_role.value}; clients: {clients}). "
        "Try a more specific question, switch organization, or ask a manager to reindex chatbot context."
    )


def _extractive_answer(req: ChatRequest, docs: list[Document], live: str | None) -> str:
    parts: list[str] = []
    if live:
        # Keep the most actionable live lines for offline fallback
        live_lines = [ln for ln in live.splitlines() if ln.startswith("- ")][:12]
        if live_lines:
            parts.append("From the live database:")
            parts.extend(live_lines)
            parts.append("")
    if docs:
        parts.append("From indexed documents:")
        for i, doc in enumerate(docs[:5], 1):
            snippet = " ".join(doc.page_content.split())
            if len(snippet) > 280:
                snippet = snippet[:277] + "…"
            parts.append(f"{i}. **{_title(doc)}** — {snippet}")
    if not parts:
        return _empty_reply(req)
    parts.append("")
    parts.append(f"(role: {req.access_role.value})")
    return "\n".join(parts)


def _history_messages(req: ChatRequest) -> list[BaseMessage]:
    msgs: list[BaseMessage] = []
    for turn in (req.history or [])[-8:]:
        role = (turn.role or "").lower()
        content = (turn.content or "").strip()
        if not content:
            continue
        if role == "assistant":
            msgs.append(AIMessage(content=content))
        else:
            msgs.append(HumanMessage(content=content))
    return msgs


def _build_messages(
    req: ChatRequest, docs: list[Document], live: str | None
) -> list[BaseMessage]:
    caps = ", ".join(req.capabilities) if req.capabilities else "standard"
    user_block = (
        f"Access role: {req.access_role.value}\n"
        f"Capabilities: {caps}\n"
        f"Org: {req.org_id}\n\n"
        f"=== LIVE DATABASE SNAPSHOT (schema + current rows) ===\n"
        f"{live or '(live snapshot unavailable — answer from retrieved docs only)'}\n\n"
        f"=== RETRIEVED DOCUMENTS ===\n"
        f"{_format_context(docs)}\n\n"
        f"User question:\n{req.message}"
    )
    return [
        SystemMessage(content=SYSTEM_PROMPT),
        *_history_messages(req),
        HumanMessage(content=user_block),
    ]


def _invoke_text(messages: list[BaseMessage]) -> str:
    model = get_chat_model()
    try:
        out = model.invoke(messages)
    except Exception as primary_err:
        log.warning("primary LLM failed: %s", primary_err)
        fallback = get_fallback_model()
        if fallback is None:
            raise
        out = fallback.invoke(messages)
    text = getattr(out, "content", None) or str(out)
    if isinstance(text, list):
        text = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in text
        )
    text = str(text).strip()
    if not text:
        raise RuntimeError("empty LLM reply")
    return text


def _stream_text(messages: list[BaseMessage]) -> Iterator[str]:
    models = [get_chat_model()]
    fb = get_fallback_model()
    if fb is not None:
        models.append(fb)

    last_err: Exception | None = None
    for model in models:
        acc = ""
        try:
            for chunk in model.stream(messages):
                piece = getattr(chunk, "content", None) or ""
                if isinstance(piece, list):
                    piece = "".join(
                        p.get("text", "") if isinstance(p, dict) else str(p) for p in piece
                    )
                if not piece:
                    continue
                acc += str(piece)
                yield acc
            if acc.strip():
                return
            raise RuntimeError("empty streamed reply")
        except Exception as err:
            last_err = err
            log.warning("LLM stream failed: %s", err)
            continue
    if last_err:
        raise last_err
    raise RuntimeError("no LLM available")


def _gather(req: ChatRequest) -> tuple[list[Document], str | None]:
    docs = _retrieve(req)
    live = fetch_live_context(req)
    return docs, live


def generate_chat(req: ChatRequest) -> ChatResponse:
    docs, live = _gather(req)
    cites = _citations(docs, live)
    if not docs and not live:
        return ChatResponse(reply=_empty_reply(req), citations=[], blocks=[])

    if not llm_configured():
        return ChatResponse(
            reply=_extractive_answer(req, docs, live), citations=cites, blocks=[]
        )

    try:
        reply = _invoke_text(_build_messages(req, docs, live))
        return ChatResponse(reply=reply, citations=cites, blocks=[])
    except Exception as err:
        log.warning("generation failed: %s", err)
        return ChatResponse(
            reply=_extractive_answer(req, docs, live), citations=cites, blocks=[]
        )


def stream_chat_events(req: ChatRequest) -> Iterator[tuple[str, dict]]:
    yield ("status", {"stage": "retrieving"})
    docs, live = _gather(req)
    cites = [c.model_dump(mode="json") for c in _citations(docs, live)]
    if not docs and not live:
        reply = _empty_reply(req)
        yield ("status", {"stage": "writing"})
        yield ("token", {"text": reply})
        yield (
            "result",
            {
                "reply": reply,
                "clarification_needed": None,
                "blocks": [],
                "citations": [],
                "intent": None,
            },
        )
        return

    yield ("status", {"stage": "writing"})
    messages = _build_messages(req, docs, live)

    if llm_configured():
        try:
            reply = ""
            for acc in _stream_text(messages):
                reply = acc
                yield ("token", {"text": reply})
            yield (
                "result",
                {
                    "reply": reply,
                    "clarification_needed": None,
                    "blocks": [],
                    "citations": cites,
                    "intent": None,
                },
            )
            return
        except Exception as err:
            log.warning("stream generation failed: %s", err)

    reply = _extractive_answer(req, docs, live)
    step = max(12, len(reply) // 20 or 12)
    for i in range(0, len(reply), step):
        yield ("token", {"text": reply[: i + step]})
    yield (
        "result",
        {
            "reply": reply,
            "clarification_needed": None,
            "blocks": [],
            "citations": cites,
            "intent": None,
        },
    )


def offline_seed_response(req: ChatRequest) -> ChatResponse:
    docs, live = _gather(req)
    if not docs and not live:
        return ChatResponse(reply=_empty_reply(req), citations=[], blocks=[])
    return ChatResponse(
        reply=_extractive_answer(req, docs, live),
        citations=_citations(docs, live),
        blocks=[],
    )


def llm_configured() -> bool:
    from gestalt_rag.config import get_settings

    s = get_settings()
    provider = normalize_provider(s.llm_provider)
    if provider == "google_genai":
        return bool(s.google_api_key)
    if provider == "groq":
        return bool(s.groq_api_key)
    if provider in ("anthropic", "openai"):
        return True
    return False
