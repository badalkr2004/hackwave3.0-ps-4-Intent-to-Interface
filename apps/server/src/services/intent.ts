import {
  CLARIFY_MIN_CONFIDENCE,
  CLARIFY_MIN_GAP,
  type ClientRef,
  type Intent,
  type Interpretation,
  type IntentParseResult,
  type PartialScope,
  type ProjectRef,
  type Scope,
} from '@gestalt/shared';
import { env } from '../env';
import { fixtureIntent } from '../fallback/fixtures';
import { keywordIntent } from '../fallback/keywordIntent';
import { toISODate } from '../lib/dates';
import { callStructured } from '../llm/call';
import { fallbackMode } from '../llm/models';
import { INTENT_SYSTEM } from '../llm/prompts';
import { LlmIntent, LlmIntentWire } from '../llm/schemas';
import { log } from '../log';

export type FinalizeResult =
  { kind: 'intent'; intent: Intent } | { kind: 'clarify'; interpretations: Interpretation[] };

const RANGE_TEXT = { '7d': '7 days', '30d': '30 days', '90d': '90 days' } as const;

/** Omitted fields carry over from the current scope; explicit nulls clear them. */
export function mergeScope(current: Scope | null, next: PartialScope): Scope {
  return {
    clientId: next.clientId !== undefined ? next.clientId : (current?.clientId ?? null),
    projectId: next.projectId !== undefined ? next.projectId : (current?.projectId ?? null),
    timeRange: next.timeRange ?? current?.timeRange ?? '30d',
  };
}

export function describeIntent(
  shape: Intent['shape'],
  scope: Scope,
  clients: readonly ClientRef[],
): Pick<Intent, 'summary' | 'headline'> {
  const client = clients.find((c) => c.id === scope.clientId)?.name ?? null;
  switch (shape) {
    case 'prepare':
      return client
        ? {
            summary: `Preparing for your meeting with ${client}.`,
            headline: `Preparing for ${client}`,
          }
        : { summary: 'Preparing for your next meeting.', headline: 'Preparing for a meeting' };
    case 'diagnose':
      return {
        summary: `Investigating why ${client ? `${client}'s` : 'portfolio'} usage changed over the last ${RANGE_TEXT[scope.timeRange]}.`,
        headline: client ? `Investigating ${client} usage drop` : 'Investigating usage drop',
      };
    case 'triage':
      return {
        summary: `Reviewing overdue work${client ? ` for ${client}` : ''}.`,
        headline: 'Reviewing overdue work',
      };
    case 'overview':
      return { summary: 'Here is your portfolio at a glance.', headline: 'Overview' };
  }
}

export function intentFrom(
  interpretation: Interpretation,
  current: Scope | null,
  clients: readonly ClientRef[],
  defaultClientId: string | null = null,
): Intent {
  const scope = mergeScope(current, interpretation.scope);
  // Client-centric shapes need a client; fall back to the most at-risk one.
  if (
    !scope.clientId &&
    (interpretation.shape === 'prepare' || interpretation.shape === 'diagnose')
  ) {
    scope.clientId = defaultClientId;
  }
  return {
    shape: interpretation.shape,
    scope,
    confidence: interpretation.confidence,
    ...describeIntent(interpretation.shape, scope, clients),
  };
}

/** Clarify when the top reading is weak or too close to the runner-up (Section 10.2). */
export function finalizeIntent(
  parsed: IntentParseResult,
  current: Scope | null,
  clients: readonly ClientRef[],
  defaultClientId: string | null = null,
): FinalizeResult {
  const sorted = [...parsed.interpretations].sort((a, b) => b.confidence - a.confidence);
  const [top, second] = sorted;
  if (!top) throw new Error('Intent parse returned no interpretations');
  if (
    top.confidence < CLARIFY_MIN_CONFIDENCE ||
    (second && top.confidence - second.confidence < CLARIFY_MIN_GAP)
  ) {
    return { kind: 'clarify', interpretations: sorted };
  }
  return { kind: 'intent', intent: intentFrom(top, current, clients, defaultClientId) };
}

export interface ParseContext {
  clients: readonly ClientRef[];
  projects: readonly ProjectRef[];
  current: Intent | null;
  defaultClientId: string | null;
  today: Date;
}

export type IntentSource = 'llm' | 'fixture' | 'keyword';

/**
 * Section 10.2 post-processing: drop readings with unknown ids, sort by confidence, assign ids.
 * Returns null when nothing usable is left.
 */
export function postProcessIntent(
  out: LlmIntent,
  ctx: Pick<ParseContext, 'clients' | 'projects'>,
): IntentParseResult | null {
  const clientIds = new Set(ctx.clients.map((c) => c.id));
  const projectIds = new Set(ctx.projects.map((p) => p.id));
  const known = (id: string | null | undefined, ids: Set<string>) => id == null || ids.has(id);
  const interpretations = out.interpretations
    .filter((i) => known(i.scope.clientId, clientIds) && known(i.scope.projectId, projectIds))
    .sort((a, b) => b.confidence - a.confidence)
    .map((i, n) => {
      const scope: PartialScope = {};
      if (i.scope.clientId !== undefined) scope.clientId = i.scope.clientId;
      if (i.scope.projectId !== undefined) scope.projectId = i.scope.projectId;
      if (i.scope.timeRange !== undefined) scope.timeRange = i.scope.timeRange;
      return { ...i, scope, id: `i${n + 1}` };
    });
  return interpretations.length ? { interpretations, isPivot: out.isPivot } : null;
}

function intentUserMessage(text: string, ctx: ParseContext): string {
  const current = ctx.current
    ? JSON.stringify({
        shape: ctx.current.shape,
        scope: ctx.current.scope,
        headline: ctx.current.headline,
      })
    : 'none';
  return [
    `Today: ${toISODate(ctx.today)}`,
    `Clients: ${JSON.stringify(ctx.clients)}`,
    `Projects: ${JSON.stringify(ctx.projects)}`,
    `Current task: ${current}`,
    `Request: ${JSON.stringify(text)}`,
  ].join('\n');
}

/** LLM, then the demo fixture for this exact prompt, then the keyword parser. */
export async function parseIntent(
  text: string,
  ctx: ParseContext,
  signal?: AbortSignal,
): Promise<{ parsed: IntentParseResult; source: IntentSource }> {
  if (!fallbackMode() && text.trim()) {
    const res = await callStructured({
      stage: 'intent',
      model: env.MODEL_FAST,
      system: INTENT_SYSTEM,
      user: intentUserMessage(text, ctx),
      schema: LlmIntent,
      wireSchema: LlmIntentWire,
      temperature: 0,
      maxOutputTokens: 800,
      timeoutMs: 6000,
      signal,
    });
    const parsed = res.ok ? postProcessIntent(res.data, ctx) : null;
    if (parsed) return { parsed, source: 'llm' };
    log.warn('Intent LLM call failed; falling back', {
      error: res.ok ? 'no usable interpretations' : res.error,
    });
  }
  const fixture = fixtureIntent(text);
  const fromFixture = fixture ? postProcessIntent(fixture, ctx) : null;
  if (fromFixture) return { parsed: fromFixture, source: 'fixture' };
  return {
    parsed: keywordIntent(text, {
      clients: ctx.clients,
      current: ctx.current ? { shape: ctx.current.shape, scope: ctx.current.scope } : null,
      defaultClientId: ctx.defaultClientId,
    }),
    source: 'keyword',
  };
}

export const OVERVIEW_INTENT: Intent = {
  shape: 'overview',
  scope: { clientId: null, projectId: null, timeRange: '30d' },
  confidence: 1,
  summary: 'Here is your portfolio at a glance.',
  headline: 'Overview',
};
