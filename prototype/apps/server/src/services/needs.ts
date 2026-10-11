import {
  MANIFESTS_BY_ID,
  MAX_LLM_ADDED_NEEDS,
  NEED_QUESTIONS,
  PRIORITY_ADJUST_MAX_DELTA,
  templateNeeds,
  type Need,
  type Shape,
} from '@gestalt/shared';
import { env } from '../env';
import { fixtureNeedPlan } from '../fallback/fixtures';
import { callStructured } from '../llm/call';
import { fallbackMode } from '../llm/models';
import { PLAN_SYSTEM } from '../llm/prompts';
import { NeedPlan, NeedPlanWire } from '../llm/schemas';
import { log } from '../log';
import type { Digest } from './digest';

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Applies a need plan to the shape template, enforcing the Section 10.3 bounds in code. */
export function applyNeedPlan(shape: Shape, plan: NeedPlan): Need[] {
  const needs = templateNeeds(shape);
  for (const adj of plan.adjustments) {
    const need = needs.find((n) => n.type === adj.type);
    if (!need) continue;
    const priority = round2(
      clamp(
        adj.priority,
        need.priority - PRIORITY_ADJUST_MAX_DELTA,
        need.priority + PRIORITY_ADJUST_MAX_DELTA,
      ),
    );
    if (priority === need.priority) continue;
    need.priority = clamp(priority, 0, 1);
    need.source = 'llm_adjusted';
    need.reason = adj.reason;
  }
  for (const add of plan.additions.slice(0, MAX_LLM_ADDED_NEEDS)) {
    if (needs.some((n) => n.type === add.type)) continue;
    needs.push({
      type: add.type,
      question: NEED_QUESTIONS[add.type],
      priority: round2(clamp(add.priority, 0, 0.7)),
      source: 'llm_added',
      reason: add.reason,
    });
  }
  return needs;
}

function planUserMessage(shape: Shape, digest: Digest): string {
  const template = templateNeeds(shape).map((n) => ({ type: n.type, priority: n.priority }));
  return [
    `Shape: ${shape}`,
    `Template needs: ${JSON.stringify(template)}`,
    `Need types you may use: ${JSON.stringify(Object.keys(NEED_QUESTIONS))}`,
    `Digest: ${JSON.stringify(digest)}`,
  ].join('\n');
}

/** Template, then LLM adjustments, then the demo fixture; template only if both are unavailable. */
export async function planNeeds(
  shape: Shape,
  digest: Digest | null,
  clientId: string | null,
  signal?: AbortSignal,
): Promise<{ needs: Need[]; degraded: boolean }> {
  if (shape === 'overview') return { needs: templateNeeds(shape), degraded: false };
  if (!fallbackMode() && digest) {
    const res = await callStructured({
      stage: 'plan',
      model: env.MODEL_FAST,
      system: PLAN_SYSTEM,
      user: planUserMessage(shape, digest),
      schema: NeedPlan,
      wireSchema: NeedPlanWire,
      temperature: 0,
      maxOutputTokens: 1200,
      timeoutMs: 6000,
      signal,
    });
    if (res.ok) return { needs: applyNeedPlan(shape, res.data), degraded: false };
    log.warn('Need planner failed; falling back', { error: res.error });
  }
  const fixture = fixtureNeedPlan(shape, clientId);
  return { needs: fixture ? applyNeedPlan(shape, fixture) : templateNeeds(shape), degraded: true };
}

/**
 * Adds a priority-1.0 need for each pinned component's primary need, so pinned panels keep their
 * slot even when the task no longer calls for them.
 */
export function withPins(base: readonly Need[], pinned: Iterable<string>): Need[] {
  const needs = base.map((n) => ({ ...n }));
  for (const id of pinned) {
    const primary = MANIFESTS_BY_ID[id]?.answers[0]?.need;
    if (!primary) continue;
    const existing = needs.find((n) => n.type === primary);
    if (existing) {
      existing.priority = 1;
      existing.source = 'user_pinned';
    } else {
      needs.push({
        type: primary,
        question: NEED_QUESTIONS[primary],
        priority: 1,
        source: 'user_pinned',
      });
    }
  }
  return needs;
}

/**
 * When the user asked for a sales chart format, promote sales_pulse so the auction
 * sizes it large — same need/auction path as every other panel.
 */
export function withSalesVizBoost(base: readonly Need[]): Need[] {
  const needs = base.map((n) => ({ ...n }));
  const sales = needs.find((n) => n.type === 'sales_pulse');
  if (sales) {
    sales.priority = 1;
    sales.source = 'llm_adjusted';
    sales.reason = 'Requested a sales / marketing chart format.';
  } else {
    needs.push({
      type: 'sales_pulse',
      question: NEED_QUESTIONS.sales_pulse,
      priority: 1,
      source: 'llm_added',
      reason: 'Requested a sales / marketing chart format.',
    });
  }
  // Free center-zone budget so sales_pulse can land at L.
  for (const n of needs) {
    if (n.type === 'usage_trend' || n.type === 'overdue_work') {
      n.priority = Math.min(n.priority, 0.35);
    }
  }
  return needs;
}

/** Promote jira_tickets when the user asked about Jira / tickets. */
export function withJiraBoost(base: readonly Need[]): Need[] {
  const needs = base.map((n) => ({ ...n }));
  const jira = needs.find((n) => n.type === 'jira_tickets');
  if (jira) {
    jira.priority = 1;
    jira.source = 'llm_adjusted';
    jira.reason = 'Requested Jira / ticket context.';
  } else {
    needs.push({
      type: 'jira_tickets',
      question: NEED_QUESTIONS.jira_tickets,
      priority: 1,
      source: 'llm_added',
      reason: 'Requested Jira / ticket context.',
    });
  }
  for (const n of needs) {
    if (n.type === 'usage_trend' || n.type === 'overdue_work' || n.type === 'sales_pulse') {
      n.priority = Math.min(n.priority, 0.4);
    }
  }
  return needs;
}
