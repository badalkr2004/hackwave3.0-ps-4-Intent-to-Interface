import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionResponse, SpecResponse } from '@gestalt/shared';
import { auth } from '../src/auth';
import { createApp } from '../src/app';
import { setDbState } from '../src/db/state';
import { env } from '../src/env';
import { createSession, release, supersede } from '../src/session';

describe('supersede (Section 9)', () => {
  it('aborts the previous request and tracks the newest', () => {
    const s = createSession();
    const first = supersede(s, 'r1');
    const second = supersede(s, 'r2');
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(s.inflight?.requestId).toBe('r2');
  });

  it('release only clears the request it owns', () => {
    const s = createSession();
    const first = supersede(s);
    const second = supersede(s);
    release(s, first);
    expect(s.inflight?.abort).toBe(second);
    release(s, second);
    expect(s.inflight).toBeNull();
  });
});

// Overview compositions only (no LLM calls); reads the configured schema, writes nothing.
// When Better Auth is on, /session requires a signed-in org member — skip anonymous route tests.
describe.skipIf(!env.DATABASE_URL || Boolean(auth))('session routes', { timeout: 30_000 }, () => {
  let baseUrl = '';
  let close: () => void = () => {};

  beforeAll(async () => {
    setDbState('up');
    const server = createApp().listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });

  afterAll(() => {
    close();
    setDbState('down');
  });

  const post = (path: string, body: unknown = {}) =>
    fetch(`${baseUrl}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('Back re-emits the stored spec with a diff from the composition being left', async () => {
    const session = SessionResponse.parse(await (await post('/session')).json());
    expect(session.spec.diff).toBeNull();
    const id = session.sessionId;
    const target = session.spec.panels.find((p) => p.componentId !== 'action_bar')!.componentId;

    const dismissed = SpecResponse.parse(
      await (await post(`/session/${id}/dismiss`, { componentId: target })).json(),
    );
    expect(dismissed.spec.diff?.removed).toEqual([target]);

    await post(`/session/${id}/home`);
    const back = SpecResponse.parse(await (await post(`/session/${id}/back`)).json());
    // Home cleared the dismissal, so going back to the stored dismissed overview removes it again.
    expect(back.spec.diff?.removed).toEqual([target]);
    expect(back.spec.panels.some((p) => p.id === target)).toBe(false);
  });

  it('unpin restores a dismissed panel without pinning it', async () => {
    const session = SessionResponse.parse(await (await post('/session')).json());
    const id = session.sessionId;
    const target = session.spec.panels.find((p) => p.componentId !== 'action_bar')!.componentId;
    await post(`/session/${id}/dismiss`, { componentId: target });
    const restored = SpecResponse.parse(
      await (await post(`/session/${id}/pin`, { componentId: target, pinned: false })).json(),
    );
    const panel = restored.spec.panels.find((p) => p.id === target);
    expect(panel).toBeDefined();
    expect(panel?.pinned).toBe(false);
    expect(
      restored.spec.excluded.some((e) => e.componentId === target && e.reason === 'dismissed'),
    ).toBe(false);
  });
});
