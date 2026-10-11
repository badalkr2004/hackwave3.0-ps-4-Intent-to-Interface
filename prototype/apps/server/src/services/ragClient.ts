import { env } from '../env';
import { log } from '../log';

const HEALTH_TIMEOUT_MS = 5_000;
const CHAT_TIMEOUT_MS = 90_000;
/** How long to wait for SSE response headers (body may stream longer). */
const STREAM_CONNECT_TIMEOUT_MS = 30_000;

export type RagHealth = {
  ok: boolean;
  available: boolean;
  code?: 'rag_disabled' | 'rag_unavailable';
  message?: string;
  service?: string;
};

export type RagChatBody = {
  message: string;
  history?: { role: string; content: string }[];
  org_id: string;
  access_role: string;
  client_ids: string[];
  capabilities: string[];
  /** Signed-in user — used so RAG can pull that user's live Jira connector. */
  user_id?: string;
};

async function fetchRag(
  path: string,
  init?: RequestInit & { timeoutMs?: number; /** Clear abort after headers so SSE body can continue. */ streamBody?: boolean },
): Promise<Response> {
  const base = env.RAG_SERVICE_URL;
  if (!base) throw new Error('RAG_DISABLED');
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  if (env.RAG_API_KEY) headers.set('X-Rag-Api-Key', env.RAG_API_KEY);
  const { timeoutMs, streamBody, ...rest } = init ?? {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs ?? HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, { ...rest, headers, signal: ctrl.signal });
    // Headers arrived — stop aborting so long SSE bodies are not cut off.
    if (streamBody) clearTimeout(timer);
    return res;
  } finally {
    if (!streamBody) clearTimeout(timer);
  }
}

export async function ragHealth(): Promise<RagHealth> {
  if (!env.RAG_SERVICE_URL) {
    return {
      ok: false,
      available: false,
      code: 'rag_disabled',
      message: 'Chatbot service is not configured.',
    };
  }
  try {
    const res = await fetchRag('/health', { method: 'GET', timeoutMs: HEALTH_TIMEOUT_MS });
    if (!res.ok) {
      return {
        ok: false,
        available: false,
        code: 'rag_unavailable',
        message: 'Chatbot service: an error occurred.',
      };
    }
    const body = (await res.json()) as { service?: string };
    return { ok: true, available: true, service: body.service ?? 'gestalt-rag' };
  } catch (err) {
    log.warn('RAG health failed', { error: err instanceof Error ? err.message : String(err) });
    return {
      ok: false,
      available: false,
      code: 'rag_unavailable',
      message: 'Chatbot service: an error occurred.',
    };
  }
}

export async function ragChat(body: RagChatBody): Promise<
  | { ok: true; data: unknown }
  | { ok: false; code: 'rag_disabled' | 'rag_unavailable'; message: string; status: number }
> {
  if (!env.RAG_SERVICE_URL) {
    return {
      ok: false,
      code: 'rag_disabled',
      message: 'Chatbot service is not configured.',
      status: 503,
    };
  }
  try {
    const res = await fetchRag('/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: CHAT_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        ok: false,
        code: 'rag_unavailable',
        message: 'Chatbot service: an error occurred.',
        status: 503,
      };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    log.warn('RAG chat failed', { error: err instanceof Error ? err.message : String(err) });
    return {
      ok: false,
      code: 'rag_unavailable',
      message: 'Chatbot service: an error occurred.',
      status: 503,
    };
  }
}

/** Proxies RAG SSE stream. Caller must end the response. Returns false if RAG is down. */
export async function ragChatStreamTo(
  body: RagChatBody,
  write: (chunk: string) => void,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!env.RAG_SERVICE_URL) {
    return {
      ok: false,
      code: 'rag_disabled',
      message: 'Chatbot service is not configured.',
    };
  }
  try {
    const res = await fetchRag('/chat/stream', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: STREAM_CONNECT_TIMEOUT_MS,
      streamBody: true,
      headers: { Accept: 'text/event-stream' },
    });
    if (!res.ok || !res.body) {
      return {
        ok: false,
        code: 'rag_unavailable',
        message: 'Chatbot service: an error occurred.',
      };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      write(decoder.decode(value, { stream: true }));
    }
    return { ok: true };
  } catch (err) {
    log.warn('RAG stream failed', { error: err instanceof Error ? err.message : String(err) });
    return {
      ok: false,
      code: 'rag_unavailable',
      message: 'Chatbot service: an error occurred.',
    };
  }
}

export function ragIngestFireAndForget(documents: unknown[]): void {
  if (!env.RAG_SERVICE_URL || documents.length === 0) return;
  void (async () => {
    try {
      const res = await fetchRag('/ingest', {
        method: 'POST',
        body: JSON.stringify({ documents }),
        timeoutMs: CHAT_TIMEOUT_MS,
      });
      if (!res.ok) log.warn('RAG ingest non-OK', { status: res.status });
    } catch (err) {
      log.warn('RAG ingest skipped', { error: err instanceof Error ? err.message : String(err) });
    }
  })();
}
