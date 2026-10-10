import { Router } from 'express';
import {
  DraftEmailRequest,
  ExecuteActionRequest,
  type ActionId,
  type DraftEmailResponse,
  type ExecuteActionResponse,
} from '@gestalt/shared';
import { getDb } from '../db/client';
import { getDbState } from '../db/state';
import { startOfDay } from '../lib/dates';
import { draftEmail } from '../services/copy';
import { loadScopeData } from '../services/data';
import { buildDigest } from '../services/digest';
import { current, getSession } from '../session';
import { entities, parseBody } from './session';

export const actionsRouter = Router();

actionsRouter.post('/actions/draft-email', async (req, res, next) => {
  const body = parseBody(DraftEmailRequest, req, res);
  if (!body) return;
  const session = getSession(body.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const db = getDbState() === 'up' ? getDb() : null;
  const scope = current(session)?.intent.scope;
  if (!db || !scope?.clientId) {
    res.status(409).json({ error: 'Drafting an email needs a client in scope and a database' });
    return;
  }
  try {
    const data = await loadScopeData(db, scope, startOfDay(new Date()));
    const draft = await draftEmail(body.kind, await buildDigest(data.ctx), scope.clientId);
    res.json({ subject: draft.subject, body: draft.body } satisfies DraftEmailResponse);
  } catch (err) {
    next(err);
  }
});

const fill = (template: string, params: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? k);

const MESSAGES: Record<
  Exclude<ActionId, 'draft_pre_meeting_email' | 'draft_customer_update'>,
  string
> = {
  add_followup_task: 'Follow-up task added to {client} onboarding.',
  reschedule_meeting: 'Meeting reschedule request drafted.',
  notify_engineering: 'Message to #eng-export prepared.',
  nudge_owner: 'Nudge sent to {owner}.',
  reassign_task: 'Reassignment proposed: {task} to {person}.',
  escalate: 'Escalation note created.',
};

const activity: { at: number; sessionId: string; message: string }[] = [];

/** Mocked actions (Section 11.4): nothing leaves the machine. */
actionsRouter.post('/actions/execute', async (req, res) => {
  const body = parseBody(ExecuteActionRequest, req, res);
  if (!body) return;
  const session = getSession(body.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (body.actionId === 'draft_pre_meeting_email' || body.actionId === 'draft_customer_update') {
    res.status(400).json({ error: 'Use /api/actions/draft-email for email drafts' });
    return;
  }
  const clientId = current(session)?.intent.scope.clientId;
  const client = (await entities()).clients.find((c) => c.id === clientId)?.name ?? 'the client';
  const message = fill(MESSAGES[body.actionId], { client, ...body.params });
  if (body.actionId === 'add_followup_task') {
    activity.push({ at: Date.now(), sessionId: session.id, message });
    if (activity.length > 200) activity.shift();
  }
  res.json({ ok: true, message } satisfies ExecuteActionResponse);
});
