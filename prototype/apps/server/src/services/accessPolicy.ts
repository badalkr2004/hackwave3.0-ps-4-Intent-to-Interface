import type { ComponentId, Need, NeedType } from '@gestalt/shared';

export type AccessRole = 'manager' | 'developer' | 'intern';

export const ACCESS_ROLES = ['manager', 'developer', 'intern'] as const;

export type DataCapabilities = {
  sales: boolean;
  engineeringTickets: boolean;
  managementNotes: boolean;
  writeConnectors: boolean;
  /** Ticket tags a developer may see; null = no tag filter. */
  ticketTagAllowlist: readonly string[] | null;
  /** Extra client allow-list intersection; null = no extra filter. */
  clientAllowlist: readonly string[] | null;
  /** Panel component ids excluded from auction/load for this role. */
  excludedPanels: readonly ComponentId[];
  /** Need types to zero out / remove before auction. */
  excludedNeeds: readonly NeedType[];
};

const DEV_TAGS = ['bug', 'technical', 'backend', 'api', 'sso', 'engineering'] as const;

const POLICY: Record<AccessRole, DataCapabilities> = {
  manager: {
    sales: true,
    engineeringTickets: true,
    managementNotes: true,
    writeConnectors: true,
    ticketTagAllowlist: null,
    clientAllowlist: null,
    excludedPanels: [],
    excludedNeeds: [],
  },
  developer: {
    sales: false,
    engineeringTickets: true,
    managementNotes: false,
    writeConnectors: false,
    ticketTagAllowlist: DEV_TAGS,
    clientAllowlist: null,
    excludedPanels: ['sales_pulse', 'portfolio_health'],
    excludedNeeds: ['sales_pulse', 'portfolio_health'],
  },
  intern: {
    sales: false,
    engineeringTickets: false,
    managementNotes: false,
    writeConnectors: false,
    ticketTagAllowlist: null,
    // Demo: interns only see Acme in Northwind.
    clientAllowlist: ['acme'],
    excludedPanels: ['sales_pulse', 'portfolio_health', 'workload_bars', 'blocker_chain'],
    excludedNeeds: ['sales_pulse', 'portfolio_health', 'capacity', 'blockers'],
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
  if (role === 'intern') {
    // Interns see low-noise public issues only (no high-confidential engineering depth).
    const eng = tags.some((t) => DEV_TAGS.includes(t as (typeof DEV_TAGS)[number]));
    return !eng;
  }
  if (!caps.ticketTagAllowlist) return true;
  const allow = new Set(caps.ticketTagAllowlist.map((t) => t.toLowerCase()));
  return tags.some((t) => allow.has(t.toLowerCase()));
}
