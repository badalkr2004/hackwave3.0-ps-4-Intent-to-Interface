import type { ComponentId, Need, NeedType } from '@gestalt/shared';

export type AccessRole = 'manager' | 'developer' | 'intern';

export const ACCESS_ROLES = ['manager', 'developer', 'intern'] as const;

/** When a membership row has no accessRole, prefer least privilege (not manager). */
export const DEFAULT_ACCESS_ROLE: AccessRole = 'intern';

/** Coerce DB/null role; unknown strings fall back to intern. */
export function resolveAccessRole(role: string | null | undefined): AccessRole {
  if (role === 'manager' || role === 'developer' || role === 'intern') return role;
  return DEFAULT_ACCESS_ROLE;
}

/** How story Postgres tickets are filtered for a role. */
export type StoryTicketsMode = 'all' | 'eng_tags' | 'non_eng' | 'none';

export type DataCapabilities = {
  sales: boolean;
  engineeringTickets: boolean;
  managementNotes: boolean;
  /** Live Atlassian Jira in panels / chat / strips. */
  jiraLive: boolean;
  /** Google Calendar list + schedule UI. */
  googleCalendar: boolean;
  /** Read connector status / list issues & meetings. */
  readConnectors: boolean;
  /** Connect/disconnect, schedule Meet, create/resolve Jira. */
  writeConnectors: boolean;
  storyTicketsMode: StoryTicketsMode;
  /** Ticket tags a developer may see; null = no tag filter (manager). */
  ticketTagAllowlist: readonly string[] | null;
  /** Extra client allow-list intersection; null = no extra filter. */
  clientAllowlist: readonly string[] | null;
  /** Panel component ids excluded from auction/load for this role. */
  excludedPanels: readonly ComponentId[];
  /** Need types to zero out / remove before auction. */
  excludedNeeds: readonly NeedType[];
};

export const DEV_TAGS = ['bug', 'technical', 'backend', 'api', 'sso', 'engineering'] as const;

const POLICY: Record<AccessRole, DataCapabilities> = {
  manager: {
    sales: true,
    engineeringTickets: true,
    managementNotes: true,
    jiraLive: true,
    googleCalendar: true,
    readConnectors: true,
    writeConnectors: true,
    storyTicketsMode: 'all',
    ticketTagAllowlist: null,
    clientAllowlist: null,
    excludedPanels: [],
    excludedNeeds: [],
  },
  developer: {
    sales: false,
    engineeringTickets: true,
    managementNotes: false,
    jiraLive: true,
    googleCalendar: true,
    readConnectors: true,
    writeConnectors: false,
    storyTicketsMode: 'eng_tags',
    ticketTagAllowlist: DEV_TAGS,
    clientAllowlist: null,
    excludedPanels: ['sales_pulse', 'portfolio_health'],
    excludedNeeds: ['sales_pulse', 'portfolio_health'],
  },
  intern: {
    sales: false,
    engineeringTickets: false,
    managementNotes: false,
    jiraLive: false,
    googleCalendar: true,
    readConnectors: false,
    writeConnectors: false,
    storyTicketsMode: 'non_eng',
    ticketTagAllowlist: null,
    // Demo: interns only see Acme in Northwind.
    clientAllowlist: ['acme'],
    excludedPanels: [
      'sales_pulse',
      'portfolio_health',
      'workload_bars',
      'blocker_chain',
      'jira_tickets',
      'open_issues',
    ],
    excludedNeeds: [
      'sales_pulse',
      'portfolio_health',
      'capacity',
      'blockers',
      'jira_tickets',
      'open_issues',
    ],
  },
};

export function capabilitiesFor(role: AccessRole | null | undefined): DataCapabilities {
  return POLICY[role ?? 'manager'];
}

/** Intersect org clients with role client allow-list. */
export function applyClientPolicy(
  orgClientIds: readonly string[] | null,
  role: AccessRole | null | undefined,
): readonly string[] | null {
  if (orgClientIds === null) return null;
  const caps = capabilitiesFor(role);
  if (!caps.clientAllowlist) return orgClientIds;
  const allow = new Set(caps.clientAllowlist);
  return orgClientIds.filter((id) => allow.has(id));
}

export function canAccessClient(
  clientId: string | null | undefined,
  role: AccessRole | null | undefined,
  allowedClientIds: readonly string[] | null,
): boolean {
  if (!clientId) {
    // Unscoped rows: manager + developer only (not intern).
    const caps = capabilitiesFor(role);
    return caps.clientAllowlist == null;
  }
  if (allowedClientIds === null) return true;
  return allowedClientIds.includes(clientId);
}

export type CapabilityFlag = keyof Pick<
  DataCapabilities,
  | 'sales'
  | 'engineeringTickets'
  | 'managementNotes'
  | 'jiraLive'
  | 'googleCalendar'
  | 'readConnectors'
  | 'writeConnectors'
>;

export function assertCapability(
  role: AccessRole | null | undefined,
  flag: CapabilityFlag,
): { ok: true } | { ok: false; message: string } {
  const caps = capabilitiesFor(role);
  if (caps[flag]) return { ok: true };
  return {
    ok: false,
    message: `Your access role (${role ?? 'manager'}) cannot perform this action (${flag}).`,
  };
}

export function filterNeedsForRole(needs: Need[], role: AccessRole | null | undefined): Need[] {
  const caps = capabilitiesFor(role);
  if (caps.excludedNeeds.length === 0) return needs;
  const ban = new Set(caps.excludedNeeds);
  return needs.filter((n) => !ban.has(n.type));
}

export function isPanelAllowed(componentId: ComponentId, role: AccessRole | null | undefined): boolean {
  const caps = capabilitiesFor(role);
  return !caps.excludedPanels.includes(componentId);
}

export function ticketMatchesRole(
  tags: readonly string[],
  role: AccessRole | null | undefined,
): boolean {
  const caps = capabilitiesFor(role);
  const mode = caps.storyTicketsMode;
  if (mode === 'none') return false;
  if (mode === 'all') return true;
  const eng = tags.some((t) => DEV_TAGS.includes(t.toLowerCase() as (typeof DEV_TAGS)[number]));
  if (mode === 'eng_tags') {
    if (!caps.ticketTagAllowlist) return eng;
    const allow = new Set(caps.ticketTagAllowlist.map((t) => t.toLowerCase()));
    return tags.some((t) => allow.has(t.toLowerCase()));
  }
  // non_eng
  return !eng;
}

export type JiraIssueLike = {
  issueType?: string;
  priority?: string | null;
  summary?: string;
};

/** Filter live Jira issues for the role (intern: none; developer: eng-ish types). */
export function filterJiraIssuesForRole<T extends JiraIssueLike>(
  issues: T[],
  role: AccessRole | null | undefined,
): T[] {
  const caps = capabilitiesFor(role);
  if (!caps.jiraLive) return [];
  if (role === 'manager' || role == null) return issues;
  // Developer: drop sales/support-shaped types; keep engineering defaults (Bug/Task/Story/…).
  return issues.filter((i) => {
    const t = (i.issueType ?? 'task').toLowerCase();
    return !/(sales|support|customer|billing|inquiry)/.test(t);
  });
}

/** Short label for UI scope chip. */
export function scopeLabelForRole(
  role: AccessRole | null | undefined,
  clientIds: readonly string[],
): string {
  const caps = capabilitiesFor(role);
  const clients =
    caps.clientAllowlist?.length === 1
      ? `Clients: ${caps.clientAllowlist[0]}`
      : clientIds.length > 0
        ? `Portfolio · ${clientIds.length} clients`
        : 'Portfolio';
  const bits = [clients];
  if (!caps.sales) bits.push('no sales');
  if (!caps.jiraLive) bits.push('no Jira');
  else if (caps.storyTicketsMode === 'eng_tags') bits.push('eng focus');
  return bits.join(' · ');
}
