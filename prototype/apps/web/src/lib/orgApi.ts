export type AccessRole = 'manager' | 'developer' | 'intern';

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  accessRole?: AccessRole;
};

export type MomItem = {
  id: string;
  title: string;
  heldAt: string;
  clientId: string | null;
  summary: string | null;
  decisions: string[];
  actionItems: {
    id: string;
    text: string;
    owner: string | null;
    due: string | null;
    status: string;
  }[];
  attendees: string[];
  createdAt: string;
};

export type ActionItem = {
  id: string;
  text: string;
  owner: string | null;
  due: string | null;
  status: 'open' | 'done' | 'missed';
  sla: string;
  clientId: string | null;
  meetingMinutesId: string | null;
};

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

export async function fetchMe(): Promise<{
  authEnabled: boolean;
  googleOAuth?: boolean;
  user: { id: string; name: string; email: string } | null;
  orgs: OrgSummary[];
  activeOrganizationId: string | null;
  accessRole?: AccessRole | null;
}> {
  return json('/api/me');
}

export async function fetchOrgs() {
  return json<{ orgs: OrgSummary[]; activeOrganizationId: string | null }>('/api/orgs');
}

export async function createOrganization(name: string) {
  return json<{ org: OrgSummary }>('/api/orgs', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function joinOrganization(code: string) {
  return json<{ org: OrgSummary }>('/api/orgs/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function setActiveOrganization(organizationId: string | null) {
  return json<{ ok: true; activeOrganizationId: string | null }>('/api/orgs/active', {
    method: 'POST',
    body: JSON.stringify({ organizationId }),
  });
}

export async function createInvite(orgId: string, role: 'admin' | 'member' = 'member') {
  return json<{ invite: { id: string; code: string; expiresAt: string; role: string } }>(
    `/api/orgs/${encodeURIComponent(orgId)}/invites`,
    { method: 'POST', body: JSON.stringify({ role }) },
  );
}

export async function fetchClients(orgId: string) {
  return json<{ clients: { id: string; name: string; health: number }[] }>(
    `/api/orgs/${encodeURIComponent(orgId)}/clients`,
  );
}

export async function fetchMom(orgId: string) {
  return json<{ items: MomItem[] }>(`/api/orgs/${encodeURIComponent(orgId)}/mom`);
}

export async function pasteMom(
  orgId: string,
  body: { clientId: string; rawText: string; title?: string; heldAt?: string },
) {
  return json<{
    mom: {
      id: string;
      meetingId: string;
      title: string;
      commitmentsCreated: number;
      summary: string;
      clientName: string;
    };
  }>(`/api/orgs/${encodeURIComponent(orgId)}/mom`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadMom(
  orgId: string,
  body: {
    clientId: string;
    filename: string;
    contentBase64: string;
    mime?: string;
    title?: string;
  },
) {
  return json<{
    mom: { id: string; title: string; commitmentsCreated: number; clientName: string };
    kind: string;
  }>(`/api/orgs/${encodeURIComponent(orgId)}/mom/upload`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchActionItems(orgId: string, status: 'open' | 'done' | 'missed' | 'all' = 'all') {
  return json<{ items: ActionItem[] }>(
    `/api/orgs/${encodeURIComponent(orgId)}/action-items?status=${status}`,
  );
}

export async function patchActionItem(
  orgId: string,
  itemId: string,
  patch: { status?: 'open' | 'done' | 'missed'; owner?: string | null; due?: string | null },
) {
  return json<{ item: ActionItem }>(
    `/api/orgs/${encodeURIComponent(orgId)}/action-items/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function rollActionSla(orgId: string) {
  return json<{ updated: number }>(
    `/api/orgs/${encodeURIComponent(orgId)}/action-items/roll-sla`,
    { method: 'POST', body: '{}' },
  );
}

export async function fetchAudit(orgId: string) {
  return json<{ items: AuditItem[] }>(`/api/orgs/${encodeURIComponent(orgId)}/audit`);
}

export type AnalyticsRange = '30d' | '90d' | 'ytd';

export type AnalyticsReport = {
  organizationId: string;
  range: AnalyticsRange;
  clientId: string | null;
  insight: string;
  kpis: {
    pipelineValue: number;
    weightedForecast: number;
    winRate: number;
    openDeals: number;
    campaignSpend: number;
    attributedRevenue: number;
    leads: number;
  };
  byStage: { stage: string; count: number; amount: number }[];
  byChannel: { channel: string; spend: number; leads: number; revenue: number }[];
  byClient: { clientId: string; clientName: string; pipeline: number; won: number }[];
  trend: { week: string; pipeline: number; leads: number; spend: number }[];
  winLoss: { reason: string; count: number; amount: number }[];
  funnel: { step: string; count: number }[];
  opportunities: {
    id: string;
    clientId: string;
    clientName: string;
    name: string;
    stage: string;
    amount: number;
    probability: number;
    owner: string | null;
    expectedClose: string | null;
    sourceChannel: string;
    lostReason: string | null;
  }[];
  campaigns: {
    id: string;
    name: string;
    channel: string;
    status: string;
    spend: number;
    leads: number;
    mqls: number;
    opportunities: number;
    revenueAttributed: number;
    clientId: string | null;
  }[];
};

export async function fetchAnalytics(
  orgId: string,
  opts: { range?: AnalyticsRange; clientId?: string | null } = {},
) {
  const q = new URLSearchParams();
  if (opts.range) q.set('range', opts.range);
  if (opts.clientId) q.set('clientId', opts.clientId);
  const qs = q.toString();
  return json<AnalyticsReport>(
    `/api/orgs/${encodeURIComponent(orgId)}/analytics${qs ? `?${qs}` : ''}`,
  );
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const b64 = result.includes(',') ? result.split(',')[1]! : result;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
