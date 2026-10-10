import { describe, expect, it } from 'vitest';
import type { Exclusion } from '@gestalt/shared';
import { SIZE_BREAKS } from '@gestalt/shared';
import { confidenceWord, groupedExclusions, needAdjustment, sizeBecause } from '../src/shell/why';

describe('why lens helpers', () => {
  it('explains size from the score breaks', () => {
    expect(sizeBecause('L')).toBe(`Large because score above ${SIZE_BREAKS.L.toFixed(2)}`);
    expect(sizeBecause('M')).toBe(`Medium because score above ${SIZE_BREAKS.M.toFixed(2)}`);
    expect(sizeBecause('S')).toBe(`Small because score below ${SIZE_BREAKS.M.toFixed(2)}`);
  });

  it('groups exclusions in the spec order and drops empty groups', () => {
    const items: Exclusion[] = [
      { componentId: 'a', title: 'A', reason: 'no_space', detail: 'full' },
      { componentId: 'b', title: 'B', reason: 'dismissed', detail: 'hid' },
      { componentId: 'c', title: 'C', reason: 'no_space', detail: 'also' },
    ];
    expect(groupedExclusions(items).map((g) => [g.reason, g.items.length])).toEqual([
      ['no_space', 2],
      ['dismissed', 1],
    ]);
  });

  it('surfaces the LLM reason only for adjusted or added needs', () => {
    const needs = [
      { type: 'usage_trend' as const, question: 'q', priority: 0.9, source: 'template' as const },
      {
        type: 'open_issues' as const,
        question: 'q',
        priority: 1,
        source: 'llm_adjusted' as const,
        reason: 'Raised because tickets piled up.',
      },
    ];
    expect(needAdjustment(needs, 'usage_trend')).toBeUndefined();
    expect(needAdjustment(needs, 'open_issues')).toBe('Raised because tickets piled up.');
  });

  it('labels the top interpretation Likely and the rest Possible', () => {
    const i = [
      { id: 'i1', confidence: 0.48 },
      { id: 'i2', confidence: 0.42 },
    ];
    expect(confidenceWord(i, 'i1')).toBe('Likely');
    expect(confidenceWord(i, 'i2')).toBe('Possible');
  });
});
