import { describe, expect, it, vi } from 'vitest';
import type { SseEvent } from '@gestalt/shared';
import { createSseParser, readEvents } from '../src/lib/sse';

const frame = (e: SseEvent) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

describe('SSE parser', () => {
  it('buffers events split across chunk boundaries', () => {
    const out: string[] = [];
    const p = createSseParser((d) => out.push(d));
    const text =
      frame({ type: 'status', stage: 'parsing' }) + frame({ type: 'status', stage: 'fetching' });
    for (const ch of text) p.feed(ch);
    expect(out.map((d) => (JSON.parse(d) as { stage: string }).stage)).toEqual([
      'parsing',
      'fetching',
    ]);
  });

  it('ignores ping comments and handles CRLF', () => {
    const out: string[] = [];
    const p = createSseParser((d) => out.push(d));
    p.feed(': ping\r\n\r\ndata: {"a":1}\r\n\r\n');
    expect(out).toEqual(['{"a":1}']);
  });

  it('splits a multi-byte character across chunks without corrupting it', async () => {
    const bytes = new TextEncoder().encode(
      frame({ type: 'error', message: 'Usage −38%', recoverable: true }),
    );
    const cut = bytes.indexOf(0xe2) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, cut));
        c.enqueue(bytes.slice(cut));
        c.close();
      },
    });
    const events: SseEvent[] = [];
    await readEvents(body, { onEvent: (e) => events.push(e), isCurrent: () => true });
    expect(events).toEqual([{ type: 'error', message: 'Usage −38%', recoverable: true }]);
  });

  it('skips events that fail schema validation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const events: SseEvent[] = [];
    await readEvents(
      streamOf([
        'data: {"type":"nope"}\n\n',
        'data: not json\n\n',
        frame({ type: 'status', stage: 'planning' }),
      ]),
      {
        onEvent: (e) => events.push(e),
        isCurrent: () => true,
      },
    );
    expect(events).toEqual([{ type: 'status', stage: 'planning' }]);
    warn.mockRestore();
  });

  it('drops events once the request is no longer current', async () => {
    let current = true;
    const events: SseEvent[] = [];
    await readEvents(
      streamOf([
        frame({ type: 'status', stage: 'parsing' }),
        frame({ type: 'status', stage: 'fetching' }),
      ]),
      {
        onEvent: (e) => {
          events.push(e);
          current = false;
        },
        isCurrent: () => current,
      },
    );
    expect(events).toHaveLength(1);
  });
});
