import { Router } from 'express';
import { z } from 'zod';
import { requestUser } from '../lib/requestUser';
import { buildAnalyticsReport } from '../services/analytics';
import { listAudit } from '../services/audit';
import { extractMomText } from '../services/momExtract';
import { listActionItems, rollSla, updateActionItem } from '../services/orgActions';
import {
  createInvite,
  createOrg,
  getActiveOrgId,
  ingestMom,
  joinWithCode,
  listClientsForOrg,
  listMembers,
  listMom,
  listOrgsForUser,
  setActiveOrg,
} from '../services/orgs';

export const orgsRouter = Router();

async function requireUser(
  req: Parameters<typeof requestUser>[0],
  res: { status: (n: number) => { json: (b: unknown) => void } },
) {
  const user = await requestUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }
  return user;
}

orgsRouter.get('/orgs', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const orgs = await listOrgsForUser(user.id);
    const activeOrganizationId = await getActiveOrgId(user.id);
    res.json({ orgs, activeOrganizationId });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list organizations' });
  }
});

orgsRouter.post('/orgs', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z.object({ name: z.string().min(2).max(80) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide an organization name.' });
    return;
  }
  try {
    const org = await createOrg(user.id, body.data.name);
    res.status(201).json({ org });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not create organization' });
  }
});

orgsRouter.post('/orgs/join', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z.object({ code: z.string().min(4).max(32) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Provide an invite code.' });
    return;
  }
  try {
    const org = await joinWithCode(user.id, body.data.code);
    res.json({ org });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not join' });
  }
});

orgsRouter.post('/orgs/active', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z.object({ organizationId: z.string().min(1).nullable() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid organization.' });
    return;
  }
  try {
    await setActiveOrg(user.id, body.data.organizationId);
    res.json({ ok: true, activeOrganizationId: body.data.organizationId });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not switch organization' });
  }
});

orgsRouter.get('/orgs/:orgId/members', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const members = await listMembers(String(req.params.orgId), user.id);
    res.json({ members });
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Forbidden' });
  }
});

orgsRouter.post('/orgs/:orgId/invites', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({ role: z.enum(['admin', 'member']).default('member') })
    .safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: 'Invalid invite.' });
    return;
  }
  try {
    const invite = await createInvite(user.id, String(req.params.orgId), body.data.role);
    res.status(201).json({ invite });
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Could not create invite' });
  }
});

orgsRouter.get('/orgs/:orgId/clients', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const clients = await listClientsForOrg(String(req.params.orgId), user.id);
    res.json({ clients });
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Forbidden' });
  }
});

orgsRouter.get('/orgs/:orgId/mom', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const items = await listMom(String(req.params.orgId), user.id);
    res.json({ items });
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Forbidden' });
  }
});

orgsRouter.post('/orgs/:orgId/mom', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      clientId: z.string().min(1),
      rawText: z.string().min(40).max(80_000),
      title: z.string().max(120).optional(),
      heldAt: z.string().optional(),
      source: z.string().max(40).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: 'Paste minutes (40+ characters) and pick a client.',
      details: body.error.flatten(),
    });
    return;
  }
  try {
    const mom = await ingestMom({
      organizationId: String(req.params.orgId),
      userId: user.id,
      clientId: body.data.clientId,
      rawText: body.data.rawText,
      title: body.data.title,
      heldAt: body.data.heldAt,
      source: body.data.source,
    });
    res.status(201).json({ mom });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not save minutes' });
  }
});

orgsRouter.post('/orgs/:orgId/mom/upload', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      clientId: z.string().min(1),
      filename: z.string().min(1).max(200),
      contentBase64: z.string().min(1).max(700_000),
      mime: z.string().max(120).optional(),
      title: z.string().max(120).optional(),
      heldAt: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Upload a .txt, .md, .vtt, .html, or .docx file with a client.' });
    return;
  }
  try {
    const bytes = Uint8Array.from(Buffer.from(body.data.contentBase64, 'base64'));
    if (bytes.byteLength > 500_000) throw new Error('File too large (500KB limit).');
    const { text, kind } = await extractMomText({
      filename: body.data.filename,
      mime: body.data.mime,
      bytes,
    });
    const mom = await ingestMom({
      organizationId: String(req.params.orgId),
      userId: user.id,
      clientId: body.data.clientId,
      rawText: text,
      title: body.data.title,
      heldAt: body.data.heldAt,
      source: `upload:${kind}`,
    });
    res.status(201).json({ mom, extractedChars: text.length, kind });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not import file' });
  }
});

orgsRouter.get('/orgs/:orgId/action-items', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const status = z
    .enum(['open', 'done', 'missed', 'all'])
    .catch('all')
    .parse(req.query.status);
  try {
    const items = await listActionItems(String(req.params.orgId), user.id, { status });
    res.json({ items });
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Forbidden' });
  }
});

orgsRouter.patch('/orgs/:orgId/action-items/:itemId', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const body = z
    .object({
      status: z.enum(['open', 'done', 'missed']).optional(),
      owner: z.string().max(80).nullable().optional(),
      due: z.string().max(32).nullable().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid action item update.' });
    return;
  }
  try {
    const item = await updateActionItem(
      String(req.params.orgId),
      user.id,
      String(req.params.itemId),
      body.data,
    );
    res.json({ item });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not update' });
  }
});

orgsRouter.post('/orgs/:orgId/action-items/roll-sla', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const result = await rollSla(String(req.params.orgId), user.id);
    res.json(result);
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Forbidden' });
  }
});

orgsRouter.get('/orgs/:orgId/audit', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const { requireMember } = await import('../services/orgs');
    await requireMember(user.id, String(req.params.orgId));
    const items = await listAudit(String(req.params.orgId));
    res.json({ items });
  } catch (e) {
    res.status(403).json({ error: e instanceof Error ? e.message : 'Forbidden' });
  }
});

orgsRouter.get('/orgs/:orgId/analytics', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rangeRaw = String(req.query.range ?? '90d');
  const range: '30d' | '90d' | 'ytd' =
    rangeRaw === '30d' || rangeRaw === 'ytd' ? rangeRaw : '90d';
  const clientId =
    typeof req.query.clientId === 'string' && req.query.clientId.trim()
      ? req.query.clientId.trim()
      : null;
  try {
    const report = await buildAnalyticsReport(String(req.params.orgId), user.id, {
      range,
      clientId,
    });
    res.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    res.status(msg.includes('not in this organization') ? 400 : 403).json({ error: msg });
  }
});
