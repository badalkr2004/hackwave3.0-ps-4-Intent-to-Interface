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
import { log } from '../log';
import { ghostLayout } from '../services/auction';
import { commit, compose, composeNow, fillDeferred } from '../services/compose';
import { loadEntities } from '../services/entities';
import { OVERVIEW_INTENT, finalizeIntent, intentFrom, parseIntent } from '../services/intent';
import {
  createSession,
  current,
  getSession,
  resetPreferencesOnClientChange,
  type Session,
} from '../session';
import { openSse, type SseStream } from '../sse';

export const sessionRouter = Router();

export const entities = () => loadEntities(getDbState() === 'up' ? getDb() : null);

export function parseBody<T extends z.ZodType>(
  schema: T,
  req: Request,
  res: Response,
): z.infer<T> | null {
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

/** Opens the stream, superseding any in-flight request for the session. */
function beginStream(session: Session, res: Response, requestId: string): SseStream {
  session.inflight?.abort.abort();
  const abort = new AbortController();
  session.inflight = { requestId, abort };
  return openSse(res, abort);
}

async function runStream(session: Session, stream: SseStream, work: () => Promise<void>) {
  try {
    await work();
  } catch (err) {
    if (!stream.signal.aborted) {
      log.error('Compose failed', { error: err instanceof Error ? err.message : String(err) });
      stream.send({
        type: 'error',
        message: 'Could not compose the workspace.',
        recoverable: true,
      });
    }
  } finally {
    if (session.inflight?.abort.signal === stream.signal) session.inflight = null;
    stream.end();
  }
}

/** intent -> fetching -> planning -> composing -> spec -> writing -> patch* -> done (Section 11.2). */
async function streamIntent(
  session: Session,
  stream: SseStream,
  intent: Intent,
  requestId: string,
  degraded: boolean,
) {
  stream.send({ type: 'intent', intent });
  resetPreferencesOnClientChange(session, intent.scope.clientId);
  const c = await compose(session, intent, {
    degraded,
    signal: stream.signal,
    onStage: (stage) => stream.send({ type: 'status', stage }),
  });
  if (stream.signal.aborted) return; // superseded or disconnected: never push a partial spec
  commit(session, c, false);
  stream.send({ type: 'spec', spec: c.spec });

  if (c.deferred.length) stream.send({ type: 'status', stage: 'writing' });
  await fillDeferred(c.spec, c.deferred, (panelId, ok, props) =>
    stream.send({ type: 'patch', panelId, status: ok ? 'ready' : 'error', props }),
  );
  stream.send({ type: 'done', requestId, degraded: c.spec.degraded });
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

  const stream = beginStream(session, res, body.requestId);
  await runStream(session, stream, async () => {
    stream.send({ type: 'status', stage: 'parsing' });
    const ents = await entities();
    const on = current(session)?.intent ?? null;
    const { parsed, source } = await parseIntent(
      body.text,
      {
        clients: ents.clients,
        projects: ents.projects,
        current: on,
        defaultClientId: ents.lowestHealthClientId,
        today: new Date(),
      },
      stream.signal,
    );
    if (stream.signal.aborted) return;
    const degraded = source !== 'llm' && body.text.trim() !== '';
    const result = finalizeIntent(
      parsed,
      on?.scope ?? null,
      ents.clients,
      ents.lowestHealthClientId,
    );

    if (result.kind === 'clarify') {
      session.pendingClarification = { text: body.text, interpretations: result.interpretations };
      const ghosts: Record<string, GhostLayout> = Object.fromEntries(
        result.interpretations.map((i) => [i.id, ghostLayout(i.shape, MANIFESTS)]),
      );
      stream.send({ type: 'clarify', interpretations: result.interpretations, ghosts });
      stream.send({ type: 'done', requestId: body.requestId, degraded });
      return;
    }
    session.pendingClarification = null;
    await streamIntent(session, stream, result.intent, body.requestId, degraded);
  });
});

sessionRouter.post('/session/:id/resolve', async (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const body = parseBody(ResolveRequest, req, res);
  if (!body) return;
  const interpretation = session.pendingClarification?.interpretations.find(
    (i) => i.id === body.interpretationId,
  );
  if (!interpretation) {
    res.status(409).json({ error: 'No pending clarification with that interpretation' });
    return;
  }

  const stream = beginStream(session, res, body.requestId);
  await runStream(session, stream, async () => {
    const ents = await entities();
    const intent = intentFrom(
      interpretation,
      current(session)?.intent.scope ?? null,
      ents.clients,
      ents.lowestHealthClientId,
    );
    session.pendingClarification = null;
    await streamIntent(session, stream, intent, body.requestId, false);
  });
});

sessionRouter.post('/session/:id/back', (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  session.inflight?.abort.abort();
  if (session.stack.length > 1) session.stack.pop();
  res.json({ spec: current(session)! } satisfies SpecResponse);
});

sessionRouter.post('/session/:id/home', async (req, res, next) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  session.inflight?.abort.abort();
  session.pinned.clear();
  session.dismissed.clear();
  session.pendingClarification = null;
  try {
    const spec = await composeNow(session, OVERVIEW_INTENT, { degraded: false, replaceTop: false });
    res.json({ spec } satisfies SpecResponse);
  } catch (err) {
    next(err);
  }
});

/** Recomposes the current intent in place with the stored needs (no LLM planning call). */
async function recompose(session: Session, res: Response) {
  const on = current(session);
  const intent = on?.intent ?? OVERVIEW_INTENT;
  const spec = await composeNow(session, intent, {
    degraded: on?.degraded ?? false,
    reuseNeeds: on ? session.baseNeeds.get(on) : undefined,
    reuseCopyFrom: on ?? undefined,
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
