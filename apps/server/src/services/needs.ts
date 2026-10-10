import {
  MANIFESTS_BY_ID,
  NEED_QUESTIONS,
  templateNeeds,
  type Need,
  type Shape,
} from '@gestalt/shared';

/**
 * Template needs for the shape, plus a priority-1.0 need for each pinned component's primary need,
 * so pinned panels keep their slot even when the task no longer calls for them.
 */
export function planNeeds(shape: Shape, pinned: Iterable<string>): Need[] {
  const needs = templateNeeds(shape);
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
