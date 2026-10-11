import { z } from 'zod';

// SPEC-NOTE: Zod 4 requires an explicit key schema for z.record(); `z.record(X)` from the spec is
// written here as `z.record(z.string(), X)`. Records keyed by an enum are exhaustive in Zod 4.

export const Shape = z.enum(['overview', 'prepare', 'diagnose', 'triage']);
export type Shape = z.infer<typeof Shape>;

export const NeedType = z.enum([
  'portfolio_health',
  'schedule',
  'relationship_status',
  'recent_communication',
  'open_issues',
  'prior_commitments',
  'talking_points',
  'usage_trend',
  'anomaly_localization',
  'change_correlation',
  'root_cause_hypotheses',
  'overdue_work',
  'blockers',
  'capacity',
  'available_actions',
  'sales_pulse',
  'jira_tickets',
]);
export type NeedType = z.infer<typeof NeedType>;

export const TimeRange = z.enum(['7d', '30d', '90d']);
export type TimeRange = z.infer<typeof TimeRange>;

export const Scope = z.object({
  clientId: z.string().nullable(),
  projectId: z.string().nullable(),
  timeRange: TimeRange,
});
export type Scope = z.infer<typeof Scope>;

// Parser output: omitted scope field = carry over from previous intent; explicit null = clear it.
export const PartialScope = Scope.partial();
export type PartialScope = z.infer<typeof PartialScope>;

export const Interpretation = z.object({
  id: z.string(),
  label: z.string().max(80),
  shape: Shape,
  scope: PartialScope,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(200),
});
export type Interpretation = z.infer<typeof Interpretation>;

export const IntentParseResult = z.object({
  interpretations: z.array(Interpretation).min(1).max(3),
  isPivot: z.boolean(),
});
export type IntentParseResult = z.infer<typeof IntentParseResult>;

export const Intent = z.object({
  shape: Shape,
  scope: Scope,
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  headline: z.string(),
});
export type Intent = z.infer<typeof Intent>;

export const Need = z.object({
  type: NeedType,
  question: z.string(),
  priority: z.number().min(0).max(1),
  source: z.enum(['template', 'llm_adjusted', 'llm_added', 'user_pinned']),
  reason: z.string().optional(),
});
export type Need = z.infer<typeof Need>;

export const Size = z.enum(['S', 'M', 'L']);
export type Size = z.infer<typeof Size>;
export const Zone = z.enum(['left', 'center', 'right']);
export type Zone = z.infer<typeof Zone>;

export const Placement = z.object({ zone: Zone, order: z.number() });
export type Placement = z.infer<typeof Placement>;

export const ComponentManifest = z.object({
  id: z.string(),
  title: z.string(),
  question: z.string(),
  answers: z.array(z.object({ need: NeedType, fit: z.number().min(0).max(1) })),
  sizes: z.array(Size).min(1),
  placement: z.record(Shape, Placement),
  deferred: z.boolean(),
});
export type ComponentManifest = z.infer<typeof ComponentManifest>;

export const Receipt = z.object({
  panelId: z.string(),
  componentId: z.string(),
  need: NeedType,
  alsoServes: z.array(NeedType),
  priority: z.number(),
  fit: z.number(),
  signal: z.number(),
  score: z.number(),
  size: Size,
  evidence: z.array(z.string()),
  reason: z.string(),
});
export type Receipt = z.infer<typeof Receipt>;

export const ExclusionReason = z.enum([
  'low_score',
  'no_data',
  'no_space',
  'not_relevant',
  'dismissed',
  'role_access',
]);
export type ExclusionReason = z.infer<typeof ExclusionReason>;

export const Exclusion = z.object({
  componentId: z.string(),
  title: z.string(),
  reason: ExclusionReason,
  detail: z.string(),
  score: z.number().optional(),
});
export type Exclusion = z.infer<typeof Exclusion>;

export const PanelStatus = z.enum(['ready', 'loading', 'error']);
export type PanelStatus = z.infer<typeof PanelStatus>;

export const Panel = z.object({
  id: z.string(),
  componentId: z.string(),
  need: NeedType,
  question: z.string(),
  size: Size,
  zone: Zone,
  order: z.number(),
  status: PanelStatus,
  pinned: z.boolean(),
  props: z.record(z.string(), z.unknown()),
});
export type Panel = z.infer<typeof Panel>;

export const Diff = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  kept: z.array(z.string()),
  moved: z.array(z.string()),
});
export type Diff = z.infer<typeof Diff>;

export const UISpec = z.object({
  id: z.string(),
  version: z.number(),
  intent: Intent,
  needs: z.array(Need),
  panels: z.array(Panel),
  receipts: z.array(Receipt),
  excluded: z.array(Exclusion),
  diff: Diff.nullable(),
  degraded: z.boolean(),
});
export type UISpec = z.infer<typeof UISpec>;

const GhostSlot = z.object({ componentId: z.string(), size: Size });
export const GhostLayout = z.object({
  left: z.array(GhostSlot),
  center: z.array(GhostSlot),
  right: z.array(GhostSlot),
});
export type GhostLayout = z.infer<typeof GhostLayout>;

export const StatusStage = z.enum(['parsing', 'fetching', 'planning', 'composing', 'writing']);
export type StatusStage = z.infer<typeof StatusStage>;

export const SseEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), stage: StatusStage }),
  z.object({
    type: z.literal('clarify'),
    interpretations: z.array(Interpretation),
    ghosts: z.record(z.string(), GhostLayout),
  }),
  z.object({ type: z.literal('intent'), intent: Intent }),
  z.object({ type: z.literal('spec'), spec: UISpec }),
  z.object({
    type: z.literal('patch'),
    panelId: z.string(),
    status: z.enum(['ready', 'error']),
    props: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal('done'), requestId: z.string(), degraded: z.boolean() }),
  z.object({ type: z.literal('error'), message: z.string(), recoverable: z.boolean() }),
]);
export type SseEvent = z.infer<typeof SseEvent>;

export const ClientRef = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
});
export type ClientRef = z.infer<typeof ClientRef>;

export const ProjectRef = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string().nullable(),
});
export type ProjectRef = z.infer<typeof ProjectRef>;

export const HealthResponse = z.object({
  ok: z.literal(true),
  llm: z.enum(['live', 'fallback']),
  models: z.object({
    fast: z.string(),
    write: z.string(),
    fastFallback: z.string().optional(),
    writeFallback: z.string().optional(),
  }),
  db: z.enum(['up', 'down']),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
