import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { z } from 'zod';
import { requestUser } from '../lib/requestUser';
import {
  connectJira,
  disconnectGoogle,
  disconnectJira,
  jiraCredentialsForUser,
  listConnectors,
  markGoogleConnected,
  updateJiraSettings,
} from '../services/connectors';
import { buildMcpClientConfigs } from '../services/mcpClientConfigs';
import { issueMcpToken, listMcpTokens, revokeMcpToken } from '../services/mcpTokens';
import {
  generateMomFromGoogleMeeting,
  listGoogleMeetings,
  scheduleGoogleMeeting,
  syncGoogleMeetingArtifacts,
} from '../services/googleMeet';
import {
  createIssue,
  listProjects,
  resolveIssue,
  searchRecentIssues,
} from '../services/jira';
import { getActiveOrgId } from '../services/orgs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

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

/**
 * IDE / MCP setup status for the signed-in user.
 * Auth for clients is a personal access token bound to the active org — no user id in client config.
 */
connectorsRouter.get('/connectors/mcp-setup', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const activeOrganizationId = await getActiveOrgId(user.id);
    const tokens = await listMcpTokens(user.id);
    const ready = Boolean(activeOrganizationId);
    const readyIssues: string[] = [];
    if (!activeOrganizationId) {
      readyIssues.push('Select an active organization in Gestalt (Organization page).');
    }

    res.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      activeOrganizationId,
      ready,
      readyIssues,
      tokens,
      mcpCwd: resolve(repoRoot, 'apps/mcp').replace(/\\/g, '/'),
      clients: [
        { id: 'cursor', name: 'Cursor' },
        { id: 'claude-code', name: 'Claude Code' },
        { id: 'generic', name: 'Other MCP hosts' },
        { id: 'custom', name: 'Custom MCP client' },
      ],
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load MCP setup' });
  }
});

/** Issue a new org-bound MCP token and return install configs for all supported clients. */
connectorsRouter.post('/connectors/mcp-tokens', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      name: z.string().min(1).max(64).optional(),
      expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
    })
    .safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: 'Invalid token options.' });
    return;
  }
  try {
    const issued = await issueMcpToken(user.id, body.data);
    const mcpCwd = resolve(repoRoot, 'apps/mcp').replace(/\\/g, '/');
    const configs = buildMcpClientConfigs({ token: issued.token, mcpCwd });
    res.status(201).json({
      token: issued.token,
      meta: issued.meta,
      ...configs,
      notice:
        'Copy or install now — the full token is shown only once. It grants access to this organization via any MCP client.',
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not create MCP token' });
  }
});

connectorsRouter.delete('/connectors/mcp-tokens/:id', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const meta = await revokeMcpToken(user.id, String(req.params.id));
    res.json({ meta });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not revoke token' });
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

/** After Better Auth Google OAuth returns, mark the Meet connector connected. */
connectorsRouter.post('/connectors/google/connect', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const google = await markGoogleConnected(user.id);
    res.json({ google });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not connect Google' });
  }
});

connectorsRouter.delete('/connectors/google', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const google = await disconnectGoogle(user.id);
    res.json({ google });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Could not disconnect Google' });
  }
});

connectorsRouter.get('/connectors/google/meetings', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const meetings = await listGoogleMeetings(user.id);
    res.json({ meetings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not list meetings' });
  }
});

connectorsRouter.post('/connectors/google/meetings', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      title: z.string().min(1).max(200),
      startsAt: z.string().min(8),
      endsAt: z.string().min(8),
      attendees: z.array(z.string().email()).max(50).default([]),
      description: z.string().max(8000).optional(),
      clientId: z.string().max(64).nullable().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide title, start, end, and valid attendee emails.' });
    return;
  }
  try {
    const meeting = await scheduleGoogleMeeting(user.id, {
      ...body.data,
      clientId: body.data.clientId ?? null,
    });
    res.status(201).json({ meeting });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not schedule meeting' });
  }
});

connectorsRouter.post('/connectors/google/meetings/:id/sync', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const meetingId = String(req.params.id || '').trim();
  if (!meetingId) {
    res.status(400).json({ error: 'Meeting id required.' });
    return;
  }
  try {
    const meeting = await syncGoogleMeetingArtifacts(user.id, meetingId);
    res.json({ meeting });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not sync artifacts' });
  }
});

connectorsRouter.post('/connectors/google/meetings/:id/mom', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const meetingId = String(req.params.id || '').trim();
  const body = z.object({ clientId: z.string().min(1).max(64) }).safeParse(req.body);
  if (!meetingId || !body.success) {
    res.status(400).json({ error: 'Meeting id and clientId are required.' });
    return;
  }
  try {
    const result = await generateMomFromGoogleMeeting(user.id, meetingId, body.data.clientId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not generate MoM' });
  }
});
