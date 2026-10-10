import { describe, expect, it } from 'vitest';
import { templateNeeds } from '@gestalt/shared';
import { planNeeds } from '../src/services/needs';

describe('planNeeds', () => {
  it('returns the shape template when nothing is pinned', () => {
    expect(planNeeds('diagnose', [])).toEqual(templateNeeds('diagnose'));
  });

  it('adds a priority-1.0 need for a pinned panel the shape does not need', () => {
    const needs = planNeeds('triage', ['talking_points']);
    expect(needs.find((n) => n.type === 'talking_points')).toMatchObject({
      priority: 1,
      source: 'user_pinned',
    });
  });

  it('raises an existing need to 1.0 for a pinned panel', () => {
    const needs = planNeeds('prepare', ['usage_trend']);
    const usage = needs.filter((n) => n.type === 'usage_trend');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ priority: 1, source: 'user_pinned' });
  });

  it('does not mutate the shared template', () => {
    planNeeds('prepare', ['usage_trend']);
    expect(templateNeeds('prepare').find((n) => n.type === 'usage_trend')!.priority).toBe(0.75);
  });
});
