import { describe, expect, it } from 'vitest';
import { templateNeeds } from '@gestalt/shared';
import { applyNeedPlan, withPins } from '../src/services/needs';

describe('withPins', () => {
  it('returns the needs unchanged when nothing is pinned', () => {
    expect(withPins(templateNeeds('diagnose'), [])).toEqual(templateNeeds('diagnose'));
  });

  it('adds a priority-1.0 need for a pinned panel the shape does not need', () => {
    const needs = withPins(templateNeeds('triage'), ['talking_points']);
    expect(needs.find((n) => n.type === 'talking_points')).toMatchObject({
      priority: 1,
      source: 'user_pinned',
    });
  });

  it('raises an existing need to 1.0 without mutating the input', () => {
    const base = templateNeeds('prepare');
    const needs = withPins(base, ['usage_trend']);
    expect(needs.filter((n) => n.type === 'usage_trend')).toEqual([
      expect.objectContaining({ priority: 1, source: 'user_pinned' }),
    ]);
    expect(base.find((n) => n.type === 'usage_trend')!.priority).toBe(0.75);
  });
});

describe('applyNeedPlan (Section 10.3 bounds)', () => {
  it('clamps adjustments to ±0.25 and records the reason', () => {
    const needs = applyNeedPlan('prepare', {
      adjustments: [
        { type: 'usage_trend', priority: 1, reason: 'Usage fell 37%.' },
        { type: 'available_actions', priority: 0, reason: 'Nothing to do.' },
      ],
      additions: [],
    });
    expect(needs.find((n) => n.type === 'usage_trend')).toMatchObject({
      priority: 1,
      source: 'llm_adjusted',
      reason: 'Usage fell 37%.',
    });
    expect(needs.find((n) => n.type === 'available_actions')!.priority).toBe(0.35);
  });

  it('ignores adjustments to needs outside the template', () => {
    const needs = applyNeedPlan('triage', {
      adjustments: [{ type: 'talking_points', priority: 0.9, reason: 'x' }],
      additions: [],
    });
    expect(needs.some((n) => n.type === 'talking_points')).toBe(false);
  });

  it('adds at most two new needs, capped at 0.7, and never duplicates template needs', () => {
    const needs = applyNeedPlan('triage', {
      adjustments: [],
      additions: [
        { type: 'usage_trend', priority: 0.7, reason: 'a' },
        { type: 'overdue_work', priority: 0.5, reason: 'already there' },
        { type: 'schedule', priority: 0.4, reason: 'b' },
      ],
    });
    expect(needs.filter((n) => n.source === 'llm_added').map((n) => n.type)).toEqual([
      'usage_trend',
    ]);
    expect(needs.filter((n) => n.type === 'overdue_work')).toHaveLength(1);
  });
});
