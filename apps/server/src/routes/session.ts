import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import {
  ComposeRequest,
  DEMO_PROMPTS,
  DismissRequest,
  MANIFESTS,
  PinRequest,
  ResolveRequest,
  isComponentId,
  type GhostLayout,
  type Intent,
  type SessionResponse,
  type SpecResponse,
} from '@gestalt/shared';
import { getDb } from '../db/client';
import { getDbState } from '../db/state';
import { keywordIntent } from '../fallback/keywordIntent';
import { log } from '../log';
import { ghostLayout } from '../services/auction';
import { applyPatch, compose, composeNow } from '../services/compose';
import { loadEntities } from '../services/entities';
import { OVERVIEW_INTENT, finalizeIntent, intentFrom } from '../services/intent';
import { createSession, current, getSession, type Session } from '../session';
import { openSse, type SseStream } from '../sse';

export const sessionRouter = Router();

const entities = () => loadEntities(getDbState() === 'up' ? getDb() : null);

function parseBody<T extends z.ZodType>(schema: T, req: Request, res: Response): z.infer<T> | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

function sessionOr404(req: Request, res: Response): Session | null {
  const session = getSession(String(req.params.id));
  if (!session) res.status(404).json({ error: 'Session not found' });
  return session;
}

/** Same shape and client as what is on screen: a refinement replaces it instead of stacking. */
function isRefinement(session: Session, intent: Intent): boolean {
  const prev = current(session)?.intent;
  return !!prev && prev.shape === intent.shape && prev.scope.clientId === intent.scope.clientId;
}

/** Streams intent, spec, one patch per deferred panel, then done. */
async function streamIntent(
  session: Session,
  stream: SseStream,
  intent: Intent,
  requestId: string,
) {
  // M2 runs on the keyword parser and rule-based copy only, so every composition is degraded.
  const degraded = true;
  stream.send({ type: 'intent', intent });
  stream.send({ type: 'status', stage: 'fetching' });
  stream.send({ type: 'status', stage: 'planning' });
  const { spec, deferred } = await compose(session, intent, {
    degraded,
    replaceTop: isRefinement(session, intent),
  });
  stream.send({ type: 'status', stage: 'composing' });
  stream.send({ type: 'spec', spec });

  if (deferred.length) stream.send({ type: 'status', stage: 'writing' });
  await Promise.all(
    deferred.map(async (job) => {
      try {
        const { props } = await job.run();
        applyPatch(spec, job.panelId, props, true);
        stream.send({ type: 'patch', panelId: job.panelId, status: 'ready', props });
      } catch (err) {
        log.warn('Deferred panel failed', { panelId: job.panelId, error: String(err) });
        applyPatch(spec, job.panelId, {}, false);
        stream.send({ type: 'patch', panelId: job.panelId, status: 'error', props: {} });
      }
    }),
  );
  stream.send({ type: 'done', requestId, degraded });
}

/** Opens the stream, superseding any in-flight request for the session. */
function beginStream(session: Session, res: Response): SseStream {
  session.inflight?.abort();
  const abort = new AbortController();
  session.inflight = abort;
  return openSse(res, abort);
}

async function runStream(stream: SseStream, work: () => Promise<void>) {
  try {
    await work();
  } catch (err) {
    log.error('Compose failed', { error: err instanceof Error ? err.message : String(err) });
    stream.send({ type: 'error', message: 'Could not compose the workspace.', recoverable: true });
  } finally {
    stream.end();
  }
}

sessionRouter.post('/session', async (_req, res, next) => {
  try {
    const session = createSession();
    const [ents, spec] = await Promise.all([
      entities(),
      composeNow(session, OVERVIEW_INTENT, { degraded: false, replaceTop: false }),
    ]);
    const body: SessionResponse = {
      sessionId: session.id,
      entities: { clients: ents.clients, projects: ents.projects },
      demoPrompts: [...DEMO_PROMPTS],
      spec,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

sessionRouter.post('/session/:id/compose', async (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const body = parseBody(ComposeRequest, req, res);
  if (!body) return;

  const stream = beginStream(session, res);
  await runStream(stream, async () => {
    stream.send({ type: 'status', stage: 'parsing' });
    const ents = await entities();
    const on = current(session)?.intent ?? null;
    const parsed = keywordIntent(body.text, {
      clients: ents.clients,
      current: on ? { shape: on.shape, scope: on.scope } : null,
      defaultClientId: ents.lowestHealthClientId,
    });
    const result = finalizeIntent(parsed, on?.scope ?? null, ents.clients);
    if (stream.closed) return;

    if (result.kind === 'clarify') {
      session.pendingClarify = result.interpretations;
      const ghosts: Record<string, GhostLayout> = Object.fromEntries(
        result.interpretations.map((i) => [i.id, ghostLayout(i.shape, MANIFESTS)]),
      );
      stream.send({ type: 'clarify', interpretations: result.interpretations, ghosts });
      stream.send({ type: 'done', requestId: body.requestId, degraded: true });
      return;
    }
    session.pendingClarify = null;
    await streamIntent(session, stream, result.intent, body.requestId);
  });
});

sessionRouter.post('/session/:id/resolve', async (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const body = parseBody(ResolveRequest, req, res);
  if (!body) return;
  const interpretation = session.pendingClarify?.find((i) => i.id === body.interpretationId);
  if (!interpretation) {
    res.status(409).json({ error: 'No pending clarification with that interpretation' });
    return;
  }

  const stream = beginStream(session, res);
  await runStream(stream, async () => {
    const ents = await entities();
    const intent = intentFrom(interpretation, current(session)?.intent.scope ?? null, ents.clients);
    session.pendingClarify = null;
    await streamIntent(session, stream, intent, body.requestId);
  });
});

sessionRouter.post('/session/:id/back', (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  session.inflight?.abort();
  if (session.stack.length > 1) session.stack.pop();
  const body: SpecResponse = { spec: current(session)! };
  res.json(body);
});

sessionRouter.post('/session/:id/home', async (req, res, next) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  session.inflight?.abort();
  try {
    const spec = await composeNow(session, OVERVIEW_INTENT, {
      degraded: false,
      replaceTop: isRefinement(session, OVERVIEW_INTENT),
    });
    res.json({ spec } satisfies SpecResponse);
  } catch (err) {
    next(err);
  }
});

async function recompose(session: Session, res: Response) {
  const on = current(session);
  const intent = on?.intent ?? OVERVIEW_INTENT;
  const spec = await composeNow(session, intent, {
    degraded: on?.degraded ?? false,
    replaceTop: true,
  });
  res.json({ spec } satisfies SpecResponse);
}

sessionRouter.post('/session/:id/pin', async (req, res, next) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const body = parseBody(PinRequest, req, res);
  if (!body) return;
  if (!isComponentId(body.componentId)) {
    res.status(400).json({ error: 'Unknown component' });
    return;
  }
  if (body.pinned) {
    session.pinned.add(body.componentId);
    session.dismissed.delete(body.componentId);
  } else {
    session.pinned.delete(body.componentId);
  }
  try {
    await recompose(session, res);
  } catch (err) {
    next(err);
  }
});

sessionRouter.post('/session/:id/dismiss', async (req, res, next) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const body = parseBody(DismissRequest, req, res);
  if (!body) return;
  if (!isComponentId(body.componentId)) {
    res.status(400).json({ error: 'Unknown component' });
    return;
  }
  session.dismissed.add(body.componentId);
  session.pinned.delete(body.componentId);
  try {
    await recompose(session, res);
  } catch (err) {
    next(err);
  }
});
