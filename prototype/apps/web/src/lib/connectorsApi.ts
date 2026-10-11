export type JiraConnector = {
  id: 'jira';
  connected: boolean;
  baseUrl?: string;
  email?: string;
  projectKey?: string;
  displayName?: string;
  connectedAt?: string;
  hasStoredToken: boolean;
  usingServerToken: boolean;
};

export type ConnectorCatalogItem = {
  id: 'jira';
  name: string;
  description: string;
  connected: boolean;
  available: boolean;
};

export type JiraIssue = {
  key: string;
  id: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string | null;
  issueType: string;
  assignee: string | null;
  updated: string;
  created: string;
  url: string;
};

export type JiraProject = { key: string; name: string; id: string };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export function fetchConnectors() {
  return json<{
    catalog: ConnectorCatalogItem[];
    jira: JiraConnector;
    defaults: {
      hasServerToken: boolean;
      baseUrl: string;
      email: string;
      projectKey: string;
    };
  }>('/api/connectors');
}

export function connectJira(body: {
  baseUrl: string;
  email: string;
  projectKey?: string;
  apiToken?: string;
}) {
  return json<{ jira: JiraConnector }>('/api/connectors/jira', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function disconnectJira() {
  return json<{ jira: JiraConnector }>('/api/connectors/jira', { method: 'DELETE' });
}

export function patchJiraSettings(body: { projectKey?: string | null }) {
  return json<{ jira: JiraConnector }>('/api/connectors/jira', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchJiraIssues(limit = 15) {
  return json<{ issues: JiraIssue[]; projectKey: string | null }>(
    `/api/connectors/jira/issues?limit=${limit}`,
  );
}

export function fetchJiraProjects() {
  return json<{ projects: JiraProject[] }>('/api/connectors/jira/projects');
}

export function createJiraIssue(body: {
  summary: string;
  description?: string;
  projectKey?: string;
  issueType?: string;
}) {
  return json<{ issue: JiraIssue }>('/api/connectors/jira/issues', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function resolveJiraIssue(key: string) {
  return json<{ key: string; status: string }>(
    `/api/connectors/jira/issues/${encodeURIComponent(key)}/resolve`,
    { method: 'POST', body: '{}' },
  );
}
