import {
  DraftEmailResponse,
  ExecuteActionResponse,
  HealthResponse,
  SessionResponse,
  SpecResponse,
  type ActionId,
  type EmailKind,
  type UISpec,
} from '@gestalt/shared';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return HealthResponse.parse(await res.json());
}

async function postJson(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function createSession(): Promise<SessionResponse> {
  return SessionResponse.parse(await postJson('/api/session'));
}

const specCall = async (url: string, body?: unknown): Promise<UISpec> =>
  SpecResponse.parse(await postJson(url, body)).spec;

export const sessionUrl = (id: string, action: string) =>
  `/api/session/${encodeURIComponent(id)}/${action}`;

export const goBack = (id: string) => specCall(sessionUrl(id, 'back'));
export const goHome = (id: string) => specCall(sessionUrl(id, 'home'));
export const setPinned = (id: string, componentId: string, pinned: boolean) =>
  specCall(sessionUrl(id, 'pin'), { componentId, pinned });
export const dismissPanel = (id: string, componentId: string) =>
  specCall(sessionUrl(id, 'dismiss'), { componentId });

export async function draftEmail(sessionId: string, kind: EmailKind): Promise<DraftEmailResponse> {
  return DraftEmailResponse.parse(await postJson('/api/actions/draft-email', { sessionId, kind }));
}

export async function executeAction(
  sessionId: string,
  actionId: ActionId,
  params?: Record<string, string>,
): Promise<ExecuteActionResponse> {
  return ExecuteActionResponse.parse(
    await postJson('/api/actions/execute', { sessionId, actionId, ...(params ? { params } : {}) }),
  );
}
