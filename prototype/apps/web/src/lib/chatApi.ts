export type ChatHealth = {
  ok: boolean;
  available: boolean;
  code?: 'rag_disabled' | 'rag_unavailable';
  message?: string;
  service?: string;
};

export type ChatBlock = {
  type: string;
  props: Record<string, unknown>;
  why?: string;
  sources?: string[];
};

export type ChatResult = {
  ok: boolean;
  reply?: string;
  clarification_needed?: string | null;
  blocks?: ChatBlock[];
  citations?: { id: string; label: string }[];
  intent?: string | null;
  code?: string;
  message?: string;
  error?: string;
};

export type ChatStreamHandlers = {
  onStatus?: (stage: string, intent?: string | null) => void;
  onToken?: (text: string) => void;
  onResult?: (result: ChatResult) => void;
  onError?: (message: string) => void;
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

function errorMessage(body: ChatResult, fallback = 'Chatbot service: an error occurred.'): string {
  return body.message ?? body.error ?? body.code ?? fallback;
}

export async function fetchChatHealth(): Promise<ChatHealth> {
  try {
    const res = await fetch('/api/chat/health', { credentials: 'include' });
    const body = await parseJson<ChatHealth>(res);
    if (!res.ok) {
      return {
        ok: false,
        available: false,
        code: body.code ?? 'rag_unavailable',
        message: body.message ?? 'Chatbot service: an error occurred.',
      };
    }
    return { ...body, available: body.available ?? body.ok };
  } catch {
    return {
      ok: false,
      available: false,
      code: 'rag_unavailable',
      message: 'Chatbot service: an error occurred.',
    };
  }
}

function parseSseChunk(
  buffer: string,
  onEvent: (event: string, data: string) => void,
): string {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) onEvent(event, dataLines.join('\n'));
  }
  return rest;
}

export async function sendChat(
  message: string,
  history: { role: string; content: string }[],
): Promise<ChatResult> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    const body = await parseJson<ChatResult>(res);
    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(body),
        code: body.code,
      };
    }
    return { ...body, ok: true };
  } catch {
    return { ok: false, message: 'Chatbot service: an error occurred.' };
  }
}

/** Streams chat via SSE; falls back to non-stream POST if stream fails. */
export async function streamChat(
  message: string,
  history: { role: string; content: string }[],
  handlers: ChatStreamHandlers,
): Promise<void> {
  let lastToken = '';
  let gotResult = false;

  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message, history }),
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, (event, data) => {
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            if (event === 'status') {
              handlers.onStatus?.(String(parsed.stage ?? ''), (parsed.intent as string) ?? null);
            } else if (event === 'token') {
              lastToken = String(parsed.text ?? '');
              handlers.onToken?.(lastToken);
            } else if (event === 'result') {
              gotResult = true;
              handlers.onResult?.({
                ok: true,
                reply: parsed.reply as string | undefined,
                clarification_needed: parsed.clarification_needed as string | null | undefined,
                blocks: parsed.blocks as ChatBlock[] | undefined,
                citations: parsed.citations as ChatResult['citations'],
                intent: parsed.intent as string | null | undefined,
              });
            }
            // Ignore mid-stream error events — fall back to POST below
          } catch {
            /* ignore malformed event */
          }
        });
      }

      if (gotResult) return;
      if (lastToken.trim()) {
        handlers.onResult?.({ ok: true, reply: lastToken });
        return;
      }
    }
  } catch {
    /* fall through to POST */
  }

  handlers.onStatus?.('writing');
  const fallback = await sendChat(message, history);
  if (!fallback.ok) {
    handlers.onError?.(errorMessage(fallback));
    return;
  }
  const reply = fallback.reply ?? '';
  if (reply) handlers.onToken?.(reply);
  handlers.onResult?.(fallback);
}
