import type { PanelProps } from '@gestalt/shared';
import { env } from '../env';
import { fixtureEmail, fixtureHypotheses, fixtureTalkingPoints } from '../fallback/fixtures';
import { callStructured } from '../llm/call';
import { fallbackMode } from '../llm/models';
import { EMAIL_SYSTEM, HYPOTHESES_SYSTEM, TALKING_POINTS_SYSTEM } from '../llm/prompts';
import {
  EmailDraft,
  EmailDraftWire,
  HypothesesOut,
  HypothesesWire,
  TalkingPointsOut,
  TalkingPointsWire,
} from '../llm/schemas';
import { log } from '../log';
import { evidenceRefs, ruleHypotheses, ruleTalkingPoints } from './copyFallback';
import { digestIds, type Digest } from './digest';

const MIN_POINTS = 3;
const MIN_HYPOTHESES = 2;

export type CopyId = 'talking_points' | 'hypothesis_list';
export interface CopyResult<K extends CopyId> {
  props: PanelProps<K>;
  degraded: boolean;
}

/** Drops evidence ids not in the digest, then items left with none. Null if below the minimum. */
export function guardTalkingPoints(
  out: TalkingPointsOut,
  d: Digest,
): PanelProps<'talking_points'> | null {
  const ids = digestIds(d);
  const points = out.points
    .map((p) => ({
      ...p,
      evidence: evidenceRefs(
        d,
        p.evidence.filter((id) => ids.has(id)),
      ),
    }))
    .filter((p) => p.evidence.length > 0);
  return points.length >= MIN_POINTS ? { points, generatedWithoutAi: false } : null;
}

export function guardHypotheses(
  out: HypothesesOut,
  d: Digest,
): PanelProps<'hypothesis_list'> | null {
  const ids = digestIds(d);
  const hypotheses = out.hypotheses
    .map((h) => ({
      ...h,
      evidence: evidenceRefs(
        d,
        h.evidence.filter((id) => ids.has(id)),
      ),
    }))
    .filter((h) => h.evidence.length > 0);
  return hypotheses.length >= MIN_HYPOTHESES ? { hypotheses, generatedWithoutAi: false } : null;
}

const factsMessage = (d: Digest, extra?: string) =>
  [`Facts (digest JSON):`, JSON.stringify(d), ...(extra ? [extra] : [])].join('\n');

async function writeTalkingPoints(d: Digest, signal?: AbortSignal) {
  if (fallbackMode()) return null;
  const res = await callStructured({
    stage: 'copy',
    model: env.MODEL_WRITE,
    system: TALKING_POINTS_SYSTEM,
    user: factsMessage(d),
    schema: TalkingPointsOut,
    wireSchema: TalkingPointsWire,
    temperature: 0.4,
    maxOutputTokens: 2000,
    timeoutMs: 15000,
    signal,
  });
  if (!res.ok) log.warn('Talking points LLM call failed', { error: res.error });
  return res.ok ? guardTalkingPoints(res.data, d) : null;
}

async function writeHypotheses(d: Digest, signal?: AbortSignal) {
  if (fallbackMode()) return null;
  const res = await callStructured({
    stage: 'copy',
    model: env.MODEL_WRITE,
    system: HYPOTHESES_SYSTEM,
    user: factsMessage(d),
    schema: HypothesesOut,
    wireSchema: HypothesesWire,
    temperature: 0.4,
    maxOutputTokens: 2000,
    timeoutMs: 15000,
    signal,
  });
  if (!res.ok) log.warn('Hypotheses LLM call failed', { error: res.error });
  return res.ok ? guardHypotheses(res.data, d) : null;
}

/** LLM copy, then the demo fixture (guarded the same way), then rule-based copy from the digest. */
export async function generateCopy<K extends CopyId>(
  id: K,
  digest: Digest,
  clientId: string | null,
  signal?: AbortSignal,
): Promise<CopyResult<K> | null> {
  if (signal?.aborted) return null;
  if (id === 'talking_points') {
    const live = await writeTalkingPoints(digest, signal);
    if (signal?.aborted) return null;
    if (live) return { props: live, degraded: false } as CopyResult<K>;
    const fixture = fixtureTalkingPoints(clientId);
    const guarded = fixture ? guardTalkingPoints(fixture, digest) : null;
    const props = guarded ?? ruleTalkingPoints(digest);
    return props ? ({ props, degraded: true } as CopyResult<K>) : null;
  }
  const live = await writeHypotheses(digest, signal);
  if (signal?.aborted) return null;
  if (live) return { props: live, degraded: false } as CopyResult<K>;
  const fixture = fixtureHypotheses(clientId);
  const guarded = fixture ? guardHypotheses(fixture, digest) : null;
  const props = guarded ?? ruleHypotheses(digest);
  return props ? ({ props, degraded: true } as CopyResult<K>) : null;
}

export type EmailKind = 'pre_meeting' | 'customer_update';

function ruleEmail(kind: EmailKind, d: Digest): EmailDraft {
  const client = d.scope.client;
  const greeting = `Hi ${client?.contactName?.split(' ')[0] ?? 'there'},`;
  const issues = d.tickets.filter((t) => t.priority === 'high').map((t) => `- ${t.title}`);
  const promises = d.commitments
    .filter((c) => c.status !== 'done')
    .map((c) => `- ${c.text} (${c.status})`);
  const lines =
    kind === 'pre_meeting'
      ? [
          greeting,
          '',
          `Ahead of ${d.meeting?.title ?? 'our meeting'}, here is what I would like to cover:`,
          ...(issues.length ? ['', 'Open issues:', ...issues] : []),
          ...(promises.length ? ['', 'Open commitments from our last meeting:', ...promises] : []),
          '',
          'Let me know if you want to add anything to the agenda.',
        ]
      : [
          greeting,
          '',
          'A quick update on the issues your team has reported:',
          ...(issues.length ? issues : ['- We are reviewing your open tickets.']),
          '',
          'I will follow up with a firm date as soon as the fix is scheduled.',
        ];
  return {
    subject:
      kind === 'pre_meeting'
        ? `Ahead of ${d.meeting?.title ?? 'our meeting'}`
        : 'Update on your open issues',
    body: [...lines, '', 'Best,', 'Your account team'].join('\n'),
  };
}

export async function draftEmail(
  kind: EmailKind,
  digest: Digest,
  clientId: string | null,
  signal?: AbortSignal,
): Promise<EmailDraft & { degraded: boolean }> {
  if (!fallbackMode()) {
    const res = await callStructured({
      stage: 'copy',
      model: env.MODEL_WRITE,
      system: EMAIL_SYSTEM,
      user: factsMessage(
        digest,
        `Email kind: ${kind === 'pre_meeting' ? 'pre-meeting note before the upcoming meeting' : 'status update to the customer about their open issues'}`,
      ),
      schema: EmailDraft,
      wireSchema: EmailDraftWire,
      temperature: 0.4,
      maxOutputTokens: 1200,
      timeoutMs: 15000,
      signal,
    });
    if (res.ok) return { ...res.data, degraded: false };
    log.warn('Email draft LLM call failed', { error: res.error });
  }
  return { ...(fixtureEmail(kind, clientId) ?? ruleEmail(kind, digest)), degraded: true };
}
