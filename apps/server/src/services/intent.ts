import {
  CLARIFY_MIN_CONFIDENCE,
  CLARIFY_MIN_GAP,
  type ClientRef,
  type Intent,
  type Interpretation,
  type IntentParseResult,
  type PartialScope,
  type Scope,
} from '@gestalt/shared';

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
): Intent {
  const scope = mergeScope(current, interpretation.scope);
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
  return { kind: 'intent', intent: intentFrom(top, current, clients) };
}

export const OVERVIEW_INTENT: Intent = {
  shape: 'overview',
  scope: { clientId: null, projectId: null, timeRange: '30d' },
  confidence: 1,
  summary: 'Here is your portfolio at a glance.',
  headline: 'Overview',
};
