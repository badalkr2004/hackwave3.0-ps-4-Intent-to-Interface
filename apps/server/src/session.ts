import { randomUUID } from 'node:crypto';
import { MAX_STACK_DEPTH, type Interpretation, type UISpec } from '@gestalt/shared';

export interface Session {
  id: string;
  /** Compositions, newest last; the last one is on screen. */
  stack: UISpec[];
  pinned: Set<string>;
  dismissed: Set<string>;
  version: number;
  /** Interpretations offered by the last clarify event, for /resolve. */
  pendingClarify: Interpretation[] | null;
  /** Aborts the in-flight compose stream when a newer request arrives. */
  inflight: AbortController | null;
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
    pendingClarify: null,
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

/** Pushes a new composition, or replaces the top when the task stays the same (a refinement). */
export function pushSpec(session: Session, spec: UISpec, replaceTop: boolean): void {
  if (replaceTop && session.stack.length > 0) session.stack[session.stack.length - 1] = spec;
  else session.stack.push(spec);
  while (session.stack.length > MAX_STACK_DEPTH + 1) session.stack.shift();
}

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.lastSeen < cutoff) sessions.delete(id);
}
