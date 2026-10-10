import { randomUUID } from 'node:crypto';
import { MAX_STACK_DEPTH, type Interpretation, type Need, type UISpec } from '@gestalt/shared';

export interface Session {
  id: string;
  /** Compositions, newest last; the last one is on screen. */
  stack: UISpec[];
  pinned: Set<string>;
  dismissed: Set<string>;
  version: number;
  /** Needs each composition was planned with (before pins), reused by pin and dismiss. */
  baseNeeds: WeakMap<UISpec, Need[]>;
  /** The last clarify event's request, for /resolve. */
  pendingClarification: { text: string; interpretations: Interpretation[] } | null;
  /** The in-flight compose stream; a newer request aborts it. */
  inflight: { requestId: string; abort: AbortController } | null;
  lastSeen: number;
}

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const sessions = new Map<string, Session>();

export function createSession(): Session {
  sweep();
  const session: Session = {
    id: randomUUID(),
    stack: [],
    pinned: new Set(),
    dismissed: new Set(),
    version: 0,
    baseNeeds: new WeakMap(),
    pendingClarification: null,
    inflight: null,
    lastSeen: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | null {
  const s = sessions.get(id) ?? null;
  if (s) s.lastSeen = Date.now();
  return s;
}

export function current(session: Session): UISpec | null {
  return session.stack[session.stack.length - 1] ?? null;
}

/** Pushes a new composition, or replaces the top one (pin and dismiss recompose in place). */
export function pushSpec(session: Session, spec: UISpec, replaceTop: boolean): void {
  if (replaceTop && session.stack.length > 0) session.stack[session.stack.length - 1] = spec;
  else session.stack.push(spec);
  while (session.stack.length > MAX_STACK_DEPTH + 1) session.stack.shift();
}

/** Pins and dismissals persist for the session but reset when the client in scope changes. */
export function resetPreferencesOnClientChange(
  session: Session,
  nextClientId: string | null,
): void {
  const prev = current(session)?.intent.scope.clientId ?? null;
  if (prev !== nextClientId) {
    session.pinned.clear();
    session.dismissed.clear();
  }
}

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.lastSeen < cutoff) sessions.delete(id);
}
