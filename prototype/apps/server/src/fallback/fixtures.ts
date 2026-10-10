import { z } from 'zod';
import { EmailDraft, HypothesesOut, LlmIntent, NeedPlan, TalkingPointsOut } from '../llm/schemas';
import copyJson from './fixtures/copy.json';
import emailsJson from './fixtures/emails.json';
import intentsJson from './fixtures/intents.json';
import needPlansJson from './fixtures/needPlans.json';

// Prepared outputs for the demo prompts (Section 10.7), validated at load so a bad edit fails fast.
// SPEC-NOTE: intents are keyed by normalized prompt text as specified; need plans, copy and emails are
// keyed by shape/component/kind plus client, because pivots, resolves and pins reach them without text.

const intents = z.record(z.string(), LlmIntent).parse(intentsJson);
const needPlans = z.record(z.string(), NeedPlan).parse(needPlansJson);
const copy = z
  .object({ 'talking_points:acme': TalkingPointsOut, 'hypothesis_list:acme': HypothesesOut })
  .partial()
  .parse(copyJson);
const emails = z.record(z.string(), EmailDraft).parse(emailsJson);

/** Lowercase, trimmed, punctuation removed. */
export function normalizePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const fixtureIntent = (text: string): LlmIntent | null =>
  intents[normalizePrompt(text)] ?? null;

export const fixtureNeedPlan = (shape: string, clientId: string | null): NeedPlan | null =>
  needPlans[`${shape}:${clientId ?? 'all'}`] ?? null;

export const fixtureTalkingPoints = (clientId: string | null): TalkingPointsOut | null =>
  clientId === 'acme' ? (copy['talking_points:acme'] ?? null) : null;

export const fixtureHypotheses = (clientId: string | null): HypothesesOut | null =>
  clientId === 'acme' ? (copy['hypothesis_list:acme'] ?? null) : null;

export const fixtureEmail = (kind: string, clientId: string | null): EmailDraft | null =>
  emails[`${kind}:${clientId ?? 'all'}`] ?? null;
