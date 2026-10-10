import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth';
import { env } from '../env';
import { loadPrefs } from '../services/prefs';
import { getActiveOrgId, listOrgsForUser } from '../services/orgs';

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
    });
    return;
  }
  const prefs = await loadPrefs(session.user.id);
  let orgs: Awaited<ReturnType<typeof listOrgsForUser>> = [];
  let activeOrganizationId: string | null = null;
  try {
    orgs = await listOrgsForUser(session.user.id);
    activeOrganizationId = await getActiveOrgId(session.user.id);
  } catch {
    // Auth can be on before org migration has been applied.
  }
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
  });
});
