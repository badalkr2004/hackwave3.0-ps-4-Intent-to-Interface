from __future__ import annotations

import logging
import urllib.error
import urllib.request

from gestalt_rag.config import get_settings
from gestalt_rag.schemas import ChatRequest

log = logging.getLogger("gestalt_rag")


def fetch_live_context(req: ChatRequest) -> str | None:
    """Pull role-aware SQL snapshot + schema notes from the Express data plane."""
    settings = get_settings()
    base = (settings.prototype_api_url or "").rstrip("/")
    if not base:
        return None

    import json

    body = json.dumps(
        {
            "org_id": req.org_id,
            "access_role": req.access_role.value,
            "client_ids": req.client_ids,
            "query": req.message,
            "user_id": req.user_id,
        }
    ).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.rag_api_key:
        headers["X-Rag-Api-Key"] = settings.rag_api_key

    request = urllib.request.Request(
        f"{base}/api/rag/live-context",
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.prototype_timeout_s) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        log.warning("live-context HTTP %s: %s", err.code, err.read()[:200])
        return None
    except Exception as err:
        log.warning("live-context failed: %s", err)
        return None

    if not payload.get("ok"):
        return None
    text = payload.get("text")
    return str(text) if text else None


def request_reindex(org_id: str, client_ids: list[str], user_id: str | None = None) -> None:
    """Best-effort: ask Express to upsert live meetings/tickets/Jira into Chroma."""
    settings = get_settings()
    base = (settings.prototype_api_url or "").rstrip("/")
    if not base:
        return
    import json

    payload: dict = {"org_id": org_id, "client_ids": client_ids}
    if user_id:
        payload["user_id"] = user_id
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.rag_api_key:
        headers["X-Rag-Api-Key"] = settings.rag_api_key
    request = urllib.request.Request(
        f"{base}/api/rag/reindex",
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.prototype_timeout_s) as res:
            res.read()
    except Exception as err:
        log.warning("reindex request failed: %s", err)
