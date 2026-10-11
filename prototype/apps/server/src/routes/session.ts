import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import {
  ComposeRequest,
  DEMO_PROMPTS,
  DismissRequest,
  MANIFESTS,
  PinRequest,
  ResolveRequest,
  computeDiff,
  isComponentId,
  jiraHeadline,
  jiraSummary,
  parseJiraRequest,
  parseSalesVizRequest,
  salesVizHeadline,
  salesVizSummary,
  type GhostLayout,
  type Intent,
  type SessionResponse,
  type SpecResponse,
  type UISpec,
} from '@gestalt/shared';
import { auth } from '../auth';
import { getDb } from '../db/client';
import { getDbState } from '../db/state';
import { log } from '../log';
import { ghostLayout } from '../services/auction';
import { SupersededError, commit, compose, composeNow, fillDeferred } from '../services/compose';
import { loadEntities } from '../services/entities';
import { OVERVIEW_INTENT, finalizeIntent, intentFrom, parseIntent } from '../services/intent';
import { requestUser } from '../lib/requestUser';
import { applyClientPolicy } from '../services/accessPolicy';
import { clientIdsForOrg, getActiveOrgId, memberAccessRole } from '../services/orgs';
import { loadPrefs, savePrefs } from '../services/prefs';
import {
  createSession,
  current,
  getSession,
  prefsSnapshot,
  release,
  resetPreferencesOnClientChange,
  supersede,
  type Session,
} from '../session';
import { openSse, type SseStream } from '../sse';

async function persistPrefs(session: Session): Promise<void> {
  if (!session.userId) return;
  await savePrefs(session.userId, prefsSnapshot(session));
}

export const sessionRouter = Router();

export const entitiesFor = (session: Session) =>
  loadEntities(getDbState() === 'up' ? getDb() : null, session.allowedClientIds);

/** @deprecated Prefer entitiesFor(session) so org scoping is preserved. */
export const entities = () => loadEntities(getDbState() === 'up' ? getDb() : null, null);

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

/** Opens the stream, superseding any in-flight request for the session (Section 9). */
function beginStream(session: Session, res: Response, requestId: string): SseStream {
  return openSse(res, supersede(session, requestId));
}

/** Runs a non-streaming recomposition; answers 409 instead of committing if superseded. */
async function exclusive(
  session: Session,
  res: Response,
  next: (err: unknown) => void,
  work: (signal: AbortSignal) => Promise<UISpec>,
) {
  const abort = supersede(session);
  try {
    const spec = await work(abort.signal);
    res.json({ spec } satisfies SpecResponse);
  } catch (err) {
    if (err instanceof SupersededError || abort.signal.aborted) {
      res.status(409).json({ error: 'Superseded' });
    } else next(err);
  } finally {
    release(session, abort);
  }
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
  await persistPrefs(session);
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

sessionRouter.post('/session', async (req, res, next) => {
  try {
    const user = await requestUser(req);

    // When Better Auth is configured, the workspace requires a signed-in member with an org.
    if (auth) {
      if (!user) {
        res.status(401).json({ error: 'Sign in required.', code: 'AUTH_REQUIRED' });
        return;
      }
      let organizationId: string | null = null;
      try {
        organizationId = await getActiveOrgId(user.id);
      } catch {
        organizationId = null;
      }
      if (!organizationId) {
        res.status(403).json({
          error: 'Create or join an organization to open the workspace.',
          code: 'NEED_ORG',
        });
        return;
      }
      const orgClientIds = await clientIdsForOrg(organizationId);
      const accessRole = (await memberAccessRole(user.id, organizationId)) ?? 'manager';
      const allowedClientIds = applyClientPolicy(orgClientIds, accessRole);
      const prefs = await loadPrefs(user.id);
      const session = createSession({
        userId: user.id,
        organizationId,
        accessRole,
        allowedClientIds,
        pinned: prefs.pinned,
        dismissed: prefs.dismissed,
      });
      const [ents, spec] = await Promise.all([
        entitiesFor(session),
        composeNow(session, OVERVIEW_INTENT, { degraded: false, replaceTop: false }),
      ]);
      const body: SessionResponse = {
        sessionId: session.id,
        entities: { clients: ents.clients, projects: ents.projects },
        demoPrompts: [...DEMO_PROMPTS],
        spec,
      };
      res.json(body);
      return;
    }

    // Auth disabled (local/tests): unrestricted demo portfolio.
    const session = createSession({
      userId: null,
      organizationId: null,
      accessRole: null,
      allowedClientIds: null,
    });
    const [ents, spec] = await Promise.all([
      entitiesFor(session),
      composeNow(session, OVERVIEW_INTENT, { degraded: false, replaceTop: false }),
    ]);
    res.json({
      sessionId: session.id,
      entities: { clients: ents.clients, projects: ents.projects },
      demoPrompts: [...DEMO_PROMPTS],
      spec,
    } satisfies SessionResponse);
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

    // Sales chart asks go through the same compose → needs → auction → registry path
    // as every other prompt; preferredViz stamps the chart format onto sales_pulse.
    const viz = parseSalesVizRequest(body.text);
    session.preferredViz = viz?.chart ?? null;
    session.jiraFocus = parseJiraRequest(body.text);
    if (viz) {
      session.jiraFocus = false;
      const intent: Intent = {
        shape: 'overview',
        scope: { clientId: null, projectId: null, timeRange: '30d' },
        confidence: 0.9,
        summary: salesVizSummary(viz.chart),
        headline: salesVizHeadline(viz.chart),
      };
      session.pendingClarification = null;
      await streamIntent(session, stream, intent, body.requestId, false);
      return;
    }
    if (session.jiraFocus) {
      const intent: Intent = {
        shape: 'overview',
        scope: { clientId: null, projectId: null, timeRange: '30d' },
        confidence: 0.9,
        summary: jiraSummary(),
        headline: jiraHeadline(),
      };
      session.pendingClarification = null;
      await streamIntent(session, stream, intent, body.requestId, false);
      return;
    }

    const ents = await entitiesFor(session);
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
    const ents = await entitiesFor(session);
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
  release(session, supersede(session));
  const shown = current(session);
  if (session.stack.length > 1) session.stack.pop();
  const restored = current(session)!;
  // The stored diff describes how that composition first arrived; Back needs the diff from the
  // composition being left. The stored spec itself stays untouched.
  res.json({
    spec: { ...restored, diff: shown === restored ? null : computeDiff(shown, restored) },
  } satisfies SpecResponse);
});

sessionRouter.post('/session/:id/home', async (req, res, next) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  session.pinned.clear();
  session.dismissed.clear();
  session.preferredViz = null;
  session.jiraFocus = false;
  session.pendingClarification = null;
  await persistPrefs(session);
  await exclusive(session, res, next, (signal) =>
    composeNow(session, OVERVIEW_INTENT, { degraded: false, replaceTop: false, signal }),
  );
});

/** Recomposes the current intent in place with the stored needs (no LLM planning call). */
function recompose(session: Session, res: Response, next: (err: unknown) => void) {
  return exclusive(session, res, next, (signal) => {
    const on = current(session);
    return composeNow(session, on?.intent ?? OVERVIEW_INTENT, {
      degraded: on?.degraded ?? false,
      reuseNeeds: on ? session.baseNeeds.get(on) : undefined,
      reuseCopyFrom: on ?? undefined,
      replaceTop: true,
      signal,
    });
  });
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
    // Unpin of a never-pinned id is how "Bring back" restores a dismissed panel without pinning it.
    session.dismissed.delete(body.componentId);
  }
  await persistPrefs(session);
  await recompose(session, res, next);
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
  await persistPrefs(session);
  await recompose(session, res, next);
});
