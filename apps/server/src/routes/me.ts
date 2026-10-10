import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth';
import { loadPrefs } from '../services/prefs';

export const meRouter = Router();

meRouter.get('/me', async (req, res) => {
  if (!auth) {
    res.json({ user: null, authEnabled: false });
    return;
  }
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.json({ user: null, authEnabled: true });
    return;
  }
  const prefs = await loadPrefs(session.user.id);
  res.json({
    authEnabled: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    prefs,
  });
});
