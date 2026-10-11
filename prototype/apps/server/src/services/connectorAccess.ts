import {
  applyClientPolicy,
  assertCapability,
  canAccessClient,
  capabilitiesFor,
  filterJiraIssuesForRole,
  resolveAccessRole,
  type AccessRole,
  type CapabilityFlag,
} from './accessPolicy';
import { clientIdsForOrg, getActiveOrgId, memberAccessRole } from './orgs';

export async function resolveUserAccess(userId: string): Promise<{
  organizationId: string | null;
  accessRole: AccessRole;
  allowedClientIds: readonly string[];
}> {
  const organizationId = await getActiveOrgId(userId);
  const accessRole = resolveAccessRole(
    organizationId ? await memberAccessRole(userId, organizationId) : null,
  );
  const orgClients = organizationId ? await clientIdsForOrg(organizationId) : [];
  const allowedClientIds = [...(applyClientPolicy(orgClients, accessRole) ?? [])];
  return { organizationId, accessRole, allowedClientIds };
}

export async function requireCapability(
  userId: string,
  flag: CapabilityFlag,
): Promise<
  | { ok: true; accessRole: AccessRole; allowedClientIds: readonly string[]; organizationId: string | null }
  | { ok: false; status: number; error: string }
> {
  const ctx = await resolveUserAccess(userId);
  const check = assertCapability(ctx.accessRole, flag);
  if (!check.ok) {
    return { ok: false, status: 403, error: check.message };
  }
  return { ok: true, ...ctx };
}

export { capabilitiesFor, canAccessClient, filterJiraIssuesForRole };
