import { env } from '../env';

export type JiraCredentials = {
  baseUrl: string;
  email: string;
  apiToken: string;
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

export type JiraProject = {
  key: string;
  name: string;
  id: string;
};

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http')) return `https://${trimmed}`;
  return trimmed;
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

async function jiraFetch<T>(
  creds: JiraCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader(creds.email, creds.apiToken),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.slice(0, 240);
    try {
      const parsed = JSON.parse(text) as {
        errorMessages?: string[];
        errorMessage?: string;
        message?: string;
      };
      detail =
        parsed.errorMessages?.join('; ') ||
        parsed.errorMessage ||
        parsed.message ||
        detail;
    } catch {
      /* keep slice */
    }
    throw new Error(detail || `Jira request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function mapIssue(
  baseUrl: string,
  issue: {
    id: string;
    key: string;
    fields?: {
      summary?: string;
      status?: { name?: string; statusCategory?: { key?: string; name?: string } };
      priority?: { name?: string } | null;
      issuetype?: { name?: string };
      assignee?: { displayName?: string } | null;
      updated?: string;
      created?: string;
    };
  },
): JiraIssue {
  const fields = issue.fields ?? {};
  const base = normalizeBaseUrl(baseUrl);
  return {
    id: issue.id,
    key: issue.key,
    summary: fields.summary ?? '(no summary)',
    status: fields.status?.name ?? 'Unknown',
    statusCategory: fields.status?.statusCategory?.key ?? 'undefined',
    priority: fields.priority?.name ?? null,
    issueType: fields.issuetype?.name ?? 'Task',
    assignee: fields.assignee?.displayName ?? null,
    updated: fields.updated ?? '',
    created: fields.created ?? '',
    url: `${base}/browse/${issue.key}`,
  };
}

const ISSUE_FIELDS = ['summary', 'status', 'priority', 'issuetype', 'assignee', 'updated', 'created'];

export async function verifyJira(creds: JiraCredentials): Promise<{ displayName: string; accountId: string }> {
  const me = await jiraFetch<{ displayName?: string; accountId?: string }>(creds, '/rest/api/3/myself');
  return {
    displayName: me.displayName ?? creds.email,
    accountId: me.accountId ?? '',
  };
}

export async function listProjects(creds: JiraCredentials): Promise<JiraProject[]> {
  type ProjectRow = { id: string; key: string; name: string };
  let list: ProjectRow[] = [];
  try {
    const page = await jiraFetch<{ values?: ProjectRow[] }>(
      creds,
      '/rest/api/3/project/search?maxResults=50',
    );
    list = page.values ?? [];
  } catch {
    const flat = await jiraFetch<ProjectRow[]>(creds, '/rest/api/3/project');
    list = Array.isArray(flat) ? flat : [];
  }
  return list.map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

export async function searchRecentIssues(
  creds: JiraCredentials,
  opts?: { projectKey?: string; maxResults?: number },
): Promise<JiraIssue[]> {
  const maxResults = opts?.maxResults ?? 15;
  const project = opts?.projectKey?.trim();
  const jql = project
    ? `project = "${project.replace(/"/g, '\\"')}" ORDER BY updated DESC`
    : 'ORDER BY updated DESC';

  type SearchPayload = {
    issues?: Array<Parameters<typeof mapIssue>[1]>;
  };

  let payload: SearchPayload;
  try {
    payload = await jiraFetch<SearchPayload>(creds, '/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({ jql, maxResults, fields: ISSUE_FIELDS }),
    });
  } catch {
    const q = new URLSearchParams({
      jql,
      maxResults: String(maxResults),
      fields: ISSUE_FIELDS.join(','),
    });
    payload = await jiraFetch<SearchPayload>(creds, `/rest/api/3/search?${q}`);
  }

  return (payload.issues ?? []).map((issue) => mapIssue(creds.baseUrl, issue));
}

function adfDescription(text: string) {
  return {
    type: 'doc' as const,
    version: 1 as const,
    content: [
      {
        type: 'paragraph' as const,
        content: text.trim()
          ? [{ type: 'text' as const, text: text.trim() }]
          : [],
      },
    ],
  };
}

export async function createIssue(
  creds: JiraCredentials,
  input: { projectKey: string; summary: string; description?: string; issueType?: string },
): Promise<JiraIssue> {
  const created = await jiraFetch<{ id: string; key: string }>(creds, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        project: { key: input.projectKey },
        summary: input.summary.trim(),
        issuetype: { name: input.issueType?.trim() || 'Task' },
        ...(input.description?.trim()
          ? { description: adfDescription(input.description) }
          : {}),
      },
    }),
  });

  const full = await jiraFetch<Parameters<typeof mapIssue>[1]>(
    creds,
    `/rest/api/3/issue/${encodeURIComponent(created.key)}?fields=${ISSUE_FIELDS.join(',')}`,
  );
  return mapIssue(creds.baseUrl, full);
}

export async function resolveIssue(
  creds: JiraCredentials,
  issueKey: string,
): Promise<{ key: string; status: string }> {
  const transitions = await jiraFetch<{
    transitions: Array<{ id: string; name: string; to?: { name?: string; statusCategory?: { key?: string } } }>;
  }>(creds, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`);

  const done =
    transitions.transitions.find((t) => t.to?.statusCategory?.key === 'done') ??
    transitions.transitions.find((t) => /done|resolv|clos/i.test(t.name)) ??
    transitions.transitions.find((t) => /done|resolv|clos/i.test(t.to?.name ?? ''));

  if (!done) {
    throw new Error('No Done/Resolved transition is available for this issue.');
  }

  await jiraFetch(creds, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: done.id } }),
  });

  return { key: issueKey, status: done.to?.name ?? done.name };
}

/** Resolve credentials: user override token, else env JIRA_API_KEY. */
export function resolveCredentials(input: {
  baseUrl: string;
  email: string;
  apiToken?: string | null;
}): JiraCredentials {
  const apiToken = (input.apiToken?.trim() || env.JIRA_API_KEY || '').trim();
  if (!apiToken) {
    throw new Error('No Jira API token. Paste one when connecting, or set JIRA_API_KEY on the server.');
  }
  const baseUrl = normalizeBaseUrl(input.baseUrl || env.JIRA_BASE_URL || '');
  if (!baseUrl) throw new Error('Jira site URL is required (e.g. https://your-team.atlassian.net).');
  const email = (input.email || env.JIRA_EMAIL || '').trim();
  if (!email) throw new Error('Atlassian account email is required.');
  return { baseUrl, email, apiToken };
}

export function envJiraDefaults() {
  return {
    hasServerToken: Boolean(env.JIRA_API_KEY),
    baseUrl: env.JIRA_BASE_URL ?? '',
    email: env.JIRA_EMAIL ?? '',
    projectKey: env.JIRA_PROJECT_KEY ?? '',
  };
}

/** Full env credentials when site + email + token are all configured (demo / server default). */
export function tryEnvCredentials(): { creds: JiraCredentials; projectKey?: string } | null {
  if (!env.JIRA_API_KEY || !env.JIRA_BASE_URL || !env.JIRA_EMAIL) return null;
  try {
    return {
      creds: resolveCredentials({
        baseUrl: env.JIRA_BASE_URL,
        email: env.JIRA_EMAIL,
        apiToken: env.JIRA_API_KEY,
      }),
      projectKey: env.JIRA_PROJECT_KEY,
    };
  } catch {
    return null;
  }
}
