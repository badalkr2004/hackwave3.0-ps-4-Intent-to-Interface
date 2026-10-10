import { SseEvent } from '@gestalt/shared';

/**
 * Incremental parser for a `text/event-stream` body. Feed it decoded text in arbitrary chunks;
 * it emits the `data` payload of each complete event. Comment lines (pings) are ignored.
 */
export function createSseParser(onData: (data: string) => void) {
  let buffer = '';
  return {
    feed(chunk: string) {
      buffer += chunk.replace(/\r\n?/g, '\n');
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data) onData(data);
        sep = buffer.indexOf('\n\n');
      }
    },
  };
}

/** Parses one event payload; invalid JSON or schema mismatches are logged and skipped. */
export function parseEvent(data: string): SseEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    console.warn('Skipping malformed SSE event');
    return null;
  }
  const parsed = SseEvent.safeParse(json);
  if (!parsed.success) {
    console.warn('Skipping invalid SSE event', parsed.error.issues.slice(0, 2));
    return null;
  }
  return parsed.data;
}

export interface StreamOptions {
  signal: AbortSignal;
  onEvent: (event: SseEvent) => void;
  /** Events are dropped once this returns false (a newer request superseded this one). */
  isCurrent: () => boolean;
}

/** POSTs JSON and streams the SSE response, delivering validated events while still current. */
export async function postStream(url: string, body: unknown, opts: StreamOptions): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  await readEvents(res.body, opts);
}

export async function readEvents(
  body: ReadableStream<Uint8Array>,
  opts: Pick<StreamOptions, 'onEvent' | 'isCurrent'>,
): Promise<void> {
  const parser = createSseParser((data) => {
    if (!opts.isCurrent()) return;
    const event = parseEvent(data);
    if (event) opts.onEvent(event);
  });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
