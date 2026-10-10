import { z } from 'zod';
import { Confidence, NeedType, Shape, TalkingPointType, TimeRange } from '@gestalt/shared';

// Strict schemas re-validate every LLM result. The `Wire` variants drop length and count bounds for
// providers that reject those JSON-schema keywords; code enforces the bounds afterwards.

const LlmScope = z.object({
  clientId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  timeRange: TimeRange.optional(),
});

const interpretation = (bounded: boolean) =>
  z.object({
    label: bounded ? z.string().max(80) : z.string(),
    shape: Shape,
    scope: LlmScope,
    confidence: bounded ? z.number().min(0).max(1) : z.number(),
    rationale: bounded ? z.string().max(200) : z.string(),
  });

/** Intent parser output; ids are assigned in code (i1, i2, ...). */
export const LlmIntent = z.object({
  interpretations: z.array(interpretation(true)).min(1).max(3),
  isPivot: z.boolean(),
});
export type LlmIntent = z.infer<typeof LlmIntent>;
export const LlmIntentWire = z.object({
  interpretations: z.array(interpretation(false)),
  isPivot: z.boolean(),
});

const planItem = (maxPriority: number, bounded: boolean) =>
  z.object({
    type: NeedType,
    priority: bounded ? z.number().min(0).max(maxPriority) : z.number(),
    reason: bounded ? z.string().max(140) : z.string(),
  });

export const NeedPlan = z.object({
  adjustments: z.array(planItem(1, true)).max(8),
  additions: z.array(planItem(0.7, true)).max(2),
});
export type NeedPlan = z.infer<typeof NeedPlan>;
export const NeedPlanWire = z.object({
  adjustments: z.array(planItem(1, false)),
  additions: z.array(planItem(1, false)),
});

const point = (bounded: boolean) =>
  z.object({
    type: TalkingPointType,
    headline: bounded ? z.string().max(90) : z.string(),
    detail: bounded ? z.string().max(240) : z.string(),
    evidence: bounded ? z.array(z.string()).max(3) : z.array(z.string()),
  });

export const TalkingPointsOut = z.object({ points: z.array(point(true)).min(3).max(6) });
export type TalkingPointsOut = z.infer<typeof TalkingPointsOut>;
export const TalkingPointsWire = z.object({ points: z.array(point(false)) });

const hypothesis = (bounded: boolean) =>
  z.object({
    title: bounded ? z.string().max(90) : z.string(),
    confidence: Confidence,
    explanation: bounded ? z.string().max(260) : z.string(),
    evidence: bounded ? z.array(z.string()).min(1).max(4) : z.array(z.string()),
    howToConfirm: bounded ? z.string().max(160) : z.string(),
  });

export const HypothesesOut = z.object({ hypotheses: z.array(hypothesis(true)).min(2).max(4) });
export type HypothesesOut = z.infer<typeof HypothesesOut>;
export const HypothesesWire = z.object({ hypotheses: z.array(hypothesis(false)) });

export const EmailDraft = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(1500),
});
export type EmailDraft = z.infer<typeof EmailDraft>;
export const EmailDraftWire = z.object({ subject: z.string(), body: z.string() });
