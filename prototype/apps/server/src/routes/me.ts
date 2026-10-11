import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth';
import { env } from '../env';
import {
  applyClientPolicy,
  capabilitiesFor,
  resolveAccessRole,
  scopeLabelForRole,
  type AccessRole,
} from '../services/accessPolicy';
import { loadPrefs } from '../services/prefs';
import { clientIdsForOrg, getActiveOrgId, listOrgsForUser } from '../services/orgs';

export const meRouter = Router();

meRouter.get('/me', async (req, res) => {
  const googleOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (!auth) {
    res.json({
      user: null,
      authEnabled: false,
      googleOAuth: false,
      orgs: [],
      activeOrganizationId: null,
      accessRole: null,
      capabilities: null,
      scopeLabel: null,
      allowedClientIds: [],
    });
    return;
  }
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.json({
      user: null,
      authEnabled: true,
      googleOAuth,
      orgs: [],
      activeOrganizationId: null,
      accessRole: null,
      capabilities: null,
      scopeLabel: null,
      allowedClientIds: [],
    });
    return;
  }
  const prefs = await loadPrefs(session.user.id);
  let orgs: Awaited<ReturnType<typeof listOrgsForUser>> = [];
  let activeOrganizationId: string | null = null;
  let allowedClientIds: string[] = [];
  try {
    orgs = await listOrgsForUser(session.user.id);
    activeOrganizationId = await getActiveOrgId(session.user.id);
    if (activeOrganizationId) {
      const orgClients = await clientIdsForOrg(activeOrganizationId);
      const active = orgs.find((o) => o.id === activeOrganizationId);
      const role = resolveAccessRole(active?.accessRole);
      allowedClientIds = [...(applyClientPolicy(orgClients, role) ?? [])];
    }
  } catch {
    // Auth can be on before org migration has been applied.
  }
  const active = orgs.find((o) => o.id === activeOrganizationId) ?? null;
  const accessRole = (active?.accessRole ?? null) as AccessRole | null;
  const caps = accessRole ? capabilitiesFor(accessRole) : null;
  res.json({
    authEnabled: true,
    googleOAuth,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    prefs,
    orgs,
    activeOrganizationId,
    accessRole,
    allowedClientIds,
    scopeLabel: accessRole ? scopeLabelForRole(accessRole, allowedClientIds) : null,
    capabilities: caps
      ? {
          sales: caps.sales,
          jiraLive: caps.jiraLive,
          googleCalendar: caps.googleCalendar,
          readConnectors: caps.readConnectors,
          writeConnectors: caps.writeConnectors,
          managementNotes: caps.managementNotes,
        }
      : null,
  });
});
