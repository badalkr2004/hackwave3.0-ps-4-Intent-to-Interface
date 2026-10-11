import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { ACCESS_ROLES } from '../services/accessPolicy';
import { buildIndexDocuments, buildLiveContext } from '../services/ragLiveContext';
import { ragIngestFireAndForget } from '../services/ragClient';
import { clientIdsForOrg } from '../services/orgs';

export const ragToolsRouter = Router();

function requireRagKey(req: { header: (n: string) => string | undefined }, res: {
  status: (n: number) => { json: (b: unknown) => void };
}): boolean {
  if (!env.RAG_API_KEY) return true;
  if (req.header('x-rag-api-key') !== env.RAG_API_KEY) {
    res.status(401).json({ error: 'Invalid RAG API key' });
    return false;
  }
  return true;
}

const LiveBody = z.object({
  org_id: z.string().min(1),
  access_role: z.enum(ACCESS_ROLES).default('manager'),
  client_ids: z.array(z.string()).default([]),
  query: z.string().max(2000).optional(),
  /** Chat user's id — resolves their Jira connector for live Atlassian issues. */
  user_id: z.string().min(1).optional(),
});

/** Service-to-service: RAG sidecar pulls role-aware SQL snapshot + schema. */
ragToolsRouter.post('/rag/live-context', async (req, res, next) => {
  try {
    if (!requireRagKey(req, res)) return;
    const parsed = LiveBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid live-context body' });
      return;
    }
    const result = await buildLiveContext(parsed.data);
    if (!result.ok) {
      res.status(503).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const ReindexBody = z.object({
  org_id: z.string().min(1),
  client_ids: z.array(z.string()).optional(),
  user_id: z.string().min(1).optional(),
});

/** Upsert live meetings/tickets/MoM/Jira into the RAG Chroma index. */
ragToolsRouter.post('/rag/reindex', async (req, res, next) => {
  try {
    if (!requireRagKey(req, res)) return;
    const parsed = ReindexBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid reindex body' });
      return;
    }
    const clientIds =
      parsed.data.client_ids ?? (await clientIdsForOrg(parsed.data.org_id));
    const documents = await buildIndexDocuments(parsed.data.org_id, [...clientIds], {
      userId: parsed.data.user_id,
    });
    ragIngestFireAndForget(documents);
    res.json({ ok: true, queued: documents.length });
  } catch (err) {
    next(err);
  }
});
