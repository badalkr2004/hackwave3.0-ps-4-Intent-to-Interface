import type {
  ClientRef,
  Interpretation,
  IntentParseResult,
  PartialScope,
  Scope,
  Shape,
  TimeRange,
} from '@gestalt/shared';

export interface KeywordContext {
  clients: readonly ClientRef[];
  /** Scope and shape of the composition on screen, if any. */
  current: { shape: Shape; scope: Scope } | null;
  /** Lowest-health client, used when a client is required but none is named or carried over. */
  defaultClientId: string | null;
}

const OVERVIEW = /^\s*$|\b(dashboard|home|reset|overview)\b/i;
const SHAPE_PATTERNS: [Exclude<Shape, 'overview'>, RegExp][] = [
  ['prepare', /\b(meeting|prepare|prep|call|qbr|review with|presentation)\b/i],
  ['diagnose', /\b(drop|dropped|decline|fell|down|decrease|why|investigate|churn|usage)\b/i],
  ['triage', /\b(overdue|late|behind|slipping|blocked|deadline|delayed)\b/i],
];
const ALL_SCOPE = /\b(all|every|everything|across|portfolio)\b/i;
const CONFIDENCE = 0.7;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'");
}

export function matchClient(text: string, clients: readonly ClientRef[]): ClientRef | null {
  const t = normalize(text);
  for (const c of clients) {
    const names = [c.name, ...c.aliases].map(normalize);
    if (
      names.some(
        (n) =>
          n.length >= 3 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t),
      )
    ) {
      return c;
    }
  }
  return null;
}

function timeRangeOf(text: string): TimeRange | undefined {
  if (/\b(7 days|week|7d)\b/i.test(text)) return '7d';
  if (/\b(90 days|quarter|3 months|90d)\b/i.test(text)) return '90d';
  if (/\b(30 days|month|30d)\b/i.test(text)) return '30d';
  return undefined;
}

function label(shape: Shape, client: string | null): string {
  switch (shape) {
    case 'prepare':
      return client ? `Prepare for the ${client} meeting` : 'Prepare for a meeting';
    case 'diagnose':
      return client ? `Investigate ${client} usage` : 'Investigate a usage change';
    case 'triage':
      return client ? `Review overdue work for ${client}` : 'Review overdue work';
    case 'overview':
      return 'Portfolio overview';
  }
}

/** Deterministic intent parser used when the LLM is unavailable (Section 10.7). */
export function keywordIntent(text: string, ctx: KeywordContext): IntentParseResult {
  const matched = SHAPE_PATTERNS.filter(([, re]) => re.test(text)).map(([shape]) => shape);
  const client = matchClient(text, ctx.clients);
  const timeRange = timeRangeOf(text);
  const clientName = (id: string | null | undefined) =>
    ctx.clients.find((c) => c.id === id)?.name ?? null;

  const scopeFor = (shape: Shape): PartialScope => {
    const scope: PartialScope = timeRange ? { timeRange } : {};
    if (shape === 'overview') return { ...scope, clientId: null, projectId: null };
    if (client) return { ...scope, clientId: client.id, projectId: null };
    if (shape === 'triage' && ALL_SCOPE.test(text))
      return { ...scope, clientId: null, projectId: null };
    if (shape === 'triage') return scope;
    // prepare and diagnose need a client: carry over the current one, else the most at-risk one.
    if (ctx.current?.scope.clientId) return scope;
    return { ...scope, clientId: ctx.defaultClientId };
  };

  const interpretation = (shape: Shape, confidence: number, rationale: string): Interpretation => {
    const scope = scopeFor(shape);
    const clientId = scope.clientId === undefined ? ctx.current?.scope.clientId : scope.clientId;
    return {
      id: '',
      label: label(shape, shape === 'overview' ? null : clientName(clientId)),
      shape,
      scope,
      confidence,
      rationale,
    };
  };

  let interpretations: Interpretation[];
  if (matched.length === 0 && (OVERVIEW.test(text) || !client)) {
    interpretations = [
      interpretation('overview', CONFIDENCE, 'No task keywords; showing the overview.'),
    ];
  } else if (matched.length === 0) {
    // SPEC-NOTE: Section 10.7 has no rule for a client with no task keywords ("look into Acme").
    // Treat it as ambiguous between the two client-centric shapes so the user picks.
    interpretations = [
      interpretation('prepare', 0.5, `Mentions ${client!.name} but not what to do.`),
      interpretation('diagnose', 0.45, `Mentions ${client!.name} but not what to do.`),
    ];
  } else if (matched.length === 1) {
    interpretations = [interpretation(matched[0]!, CONFIDENCE, `Matched ${matched[0]} keywords.`)];
  } else {
    interpretations = [
      interpretation(matched[0]!, 0.5, `Matched ${matched[0]} and ${matched[1]} keywords.`),
      interpretation(matched[1]!, 0.45, `Matched ${matched[0]} and ${matched[1]} keywords.`),
    ];
  }

  const top = interpretations[0]!;
  return {
    interpretations: interpretations.map((i, n) => ({ ...i, id: `i${n + 1}` })),
    isPivot: ctx.current !== null && top.shape !== ctx.current.shape,
  };
}
