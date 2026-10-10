import type { Response } from 'express';
import type { SseEvent } from '@gestalt/shared';

const PING_MS = 15_000;

export interface SseStream {
  send: (event: SseEvent) => void;
  end: () => void;
  /** Aborted when the client disconnects or the stream ends. */
  signal: AbortSignal;
  readonly closed: boolean;
}

export function openSse(res: Response, abort = new AbortController()): SseStream {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  const ping = setInterval(() => {
    if (!closed) res.write(': ping\n\n');
  }, PING_MS);

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    abort.abort();
  };
  res.on('close', close);

  return {
    send(event) {
      if (closed) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    },
    end() {
      if (closed) return;
      close();
      res.end();
    },
    signal: abort.signal,
    get closed() {
      return closed;
    },
  };
}
