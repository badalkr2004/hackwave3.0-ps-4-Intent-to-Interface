import { Router } from 'express';
import { z } from 'zod';
import { requestUser } from '../lib/requestUser';
import {
  connectJira,
  disconnectJira,
  jiraCredentialsForUser,
  listConnectors,
  updateJiraSettings,
} from '../services/connectors';
import {
  createIssue,
  listProjects,
  resolveIssue,
  searchRecentIssues,
} from '../services/jira';

export const connectorsRouter = Router();

async function requireUser(
  req: Parameters<typeof requestUser>[0],
  res: { status: (n: number) => { json: (b: unknown) => void } },
) {
  const user = await requestUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required.', code: 'AUTH_REQUIRED' });
    return null;
  }
  return user;
}

connectorsRouter.get('/connectors', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    res.json(await listConnectors(user.id));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load connectors' });
  }
});

connectorsRouter.post('/connectors/jira', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      baseUrl: z.string().min(8).max(200),
      email: z.string().email(),
      projectKey: z.string().max(32).optional(),
      apiToken: z.string().min(8).max(500).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide site URL and Atlassian email.' });
    return;
  }
  try {
    const jira = await connectJira(user.id, body.data);
    res.status(201).json({ jira });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not connect Jira' });
  }
});

connectorsRouter.delete('/connectors/jira', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const jira = await disconnectJira(user.id);
    res.json({ jira });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Could not disconnect' });
  }
});

connectorsRouter.patch('/connectors/jira', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({ projectKey: z.string().max(32).nullable().optional() })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid settings.' });
    return;
  }
  try {
    const jira = await updateJiraSettings(user.id, body.data);
    res.json({ jira });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not update Jira' });
  }
});

connectorsRouter.get('/connectors/jira/issues', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const { creds, projectKey } = await jiraCredentialsForUser(user.id);
    const maxResults = Math.min(Number(req.query.limit) || 15, 50);
    const project = typeof req.query.projectKey === 'string' ? req.query.projectKey : projectKey;
    const issues = await searchRecentIssues(creds, { projectKey: project, maxResults });
    res.json({ issues, projectKey: project ?? null });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not load issues' });
  }
});

connectorsRouter.get('/connectors/jira/projects', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const { creds } = await jiraCredentialsForUser(user.id);
    const projects = await listProjects(creds);
    res.json({ projects });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not load projects' });
  }
});

connectorsRouter.post('/connectors/jira/issues', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      summary: z.string().min(1).max(255),
      description: z.string().max(8000).optional(),
      projectKey: z.string().min(1).max(32).optional(),
      issueType: z.string().max(64).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide a summary for the new issue.' });
    return;
  }
  try {
    const { creds, projectKey } = await jiraCredentialsForUser(user.id);
    const key = body.data.projectKey || projectKey;
    if (!key) {
      res.status(400).json({ error: 'Set a default project key on the Connectors page, or pass one.' });
      return;
    }
    const issue = await createIssue(creds, {
      projectKey: key,
      summary: body.data.summary,
      description: body.data.description,
      issueType: body.data.issueType,
    });
    res.status(201).json({ issue });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not create issue' });
  }
});

connectorsRouter.post('/connectors/jira/issues/:key/resolve', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const key = String(req.params.key || '').trim();
  if (!key) {
    res.status(400).json({ error: 'Issue key required.' });
    return;
  }
  try {
    const { creds } = await jiraCredentialsForUser(user.id);
    const result = await resolveIssue(creds, key);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not resolve issue' });
  }
});
