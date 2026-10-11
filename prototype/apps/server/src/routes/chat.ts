import { Router } from 'express';
import { z } from 'zod';
import { requestUser } from '../lib/requestUser';
import {
  applyClientPolicy,
  capabilitiesFor,
  resolveAccessRole,
} from '../services/accessPolicy';
import {
  clientIdsForOrg,
  getActiveOrgId,
  memberAccessRole,
  requireMember,
} from '../services/orgs';
import {
  ragChat,
  ragChatStreamTo,
  ragHealth,
  ragIngestFireAndForget,
  type RagChatBody,
} from '../services/ragClient';
import { buildIndexDocuments } from '../services/ragLiveContext';

export const chatRouter = Router();

chatRouter.get('/chat/health', async (_req, res) => {
  const health = await ragHealth();
  res.status(health.available ? 200 : 503).json(health);
});

const ChatBody = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .max(20)
    .optional(),
});

async function chatContext(req: Parameters<typeof requestUser>[0]): Promise<
  | { ok: true; body: RagChatBody }
  | { ok: false; status: number; error: string; code?: string }
> {
  const user = await requestUser(req);
  if (!user) return { ok: false, status: 401, error: 'Sign in required for chat.' };
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Invalid chat body' };
  }
  const organizationId = await getActiveOrgId(user.id);
  if (!organizationId) {
    return {
      ok: false,
      status: 403,
      error: 'Create or join an organization first.',
      code: 'NEED_ORG',
    };
  }
  await requireMember(user.id, organizationId);
  const accessRole = resolveAccessRole(await memberAccessRole(user.id, organizationId));
  const orgClients = await clientIdsForOrg(organizationId);
  const clientIds = [...(applyClientPolicy(orgClients, accessRole) ?? [])];
  const caps = capabilitiesFor(accessRole);
  const capabilityFlags = [
    caps.sales ? 'sales' : '',
    caps.jiraLive || caps.engineeringTickets ? 'engineering' : '',
    caps.managementNotes ? 'management' : '',
    caps.writeConnectors ? 'write' : '',
    caps.googleCalendar ? 'calendar' : '',
  ].filter(Boolean);

  return {
    ok: true,
    body: {
      message: parsed.data.message,
      history: parsed.data.history,
      org_id: organizationId,
      access_role: accessRole,
      client_ids: clientIds,
      capabilities: capabilityFlags,
      user_id: user.id,
    },
  };
}

chatRouter.post('/chat', async (req, res, next) => {
  try {
    const ctx = await chatContext(req);
    if (!ctx.ok) {
      res.status(ctx.status).json({ error: ctx.error, code: ctx.code });
      return;
    }
    const result = await ragChat(ctx.body);
    if (!result.ok) {
      res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message,
      });
      return;
    }
    res.json({ ok: true, ...((result.data as object) ?? {}) });
  } catch (err) {
    next(err);
  }
});

chatRouter.post('/chat/stream', async (req, res, next) => {
  try {
    const ctx = await chatContext(req);
    if (!ctx.ok) {
      res.status(ctx.status).json({ error: ctx.error, message: ctx.error, code: ctx.code });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const streamed = await ragChatStreamTo(ctx.body, (chunk) => {
      res.write(chunk);
    });

    if (!streamed.ok) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: streamed.message, code: streamed.code })}\n\n`,
      );
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) next(err);
    else res.end();
  }
});

const IngestBody = z.object({
  documents: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
});

chatRouter.post('/chat/ingest', async (req, res, next) => {
  try {
    const user = await requestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sign in required.' });
      return;
    }
    const organizationId = await getActiveOrgId(user.id);
    if (!organizationId) {
      res.status(403).json({ error: 'Need an organization.' });
      return;
    }
    await requireMember(user.id, organizationId, 'admin');
    const accessRole = resolveAccessRole(await memberAccessRole(user.id, organizationId));
    if (accessRole !== 'manager') {
      res.status(403).json({ error: 'Only managers can push documents to the chatbot index.' });
      return;
    }
    const parsed = IngestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid ingest body' });
      return;
    }
    ragIngestFireAndForget(parsed.data.documents);
    res.json({ ok: true, queued: parsed.data.documents.length });
  } catch (err) {
    next(err);
  }
});

/** Push live meetings, MoM, tickets, and schema docs into the RAG index for the active org. */
chatRouter.post('/chat/reindex', async (req, res, next) => {
  try {
    const user = await requestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sign in required.' });
      return;
    }
    const organizationId = await getActiveOrgId(user.id);
    if (!organizationId) {
      res.status(403).json({ error: 'Need an organization.' });
      return;
    }
    await requireMember(user.id, organizationId);
    const accessRole = resolveAccessRole(await memberAccessRole(user.id, organizationId));
    if (accessRole !== 'manager') {
      res.status(403).json({ error: 'Only managers can reindex chatbot context.' });
      return;
    }
    const clientIds = await clientIdsForOrg(organizationId);
    const documents = await buildIndexDocuments(organizationId, clientIds, {
      userId: user.id,
    });
    ragIngestFireAndForget(documents);
    res.json({ ok: true, queued: documents.length });
  } catch (err) {
    next(err);
  }
});
