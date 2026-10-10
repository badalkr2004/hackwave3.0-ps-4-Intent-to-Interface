import { describe, expect, it } from 'vitest';
import { computeDiff, type Panel } from '@gestalt/shared';

const panel = (id: string, zone: Panel['zone'], size: Panel['size']): Panel => ({
  id,
  componentId: id,
  need: 'open_issues',
  question: id,
  size,
  zone,
  order: 1,
  status: 'ready',
  pinned: false,
  props: {},
});

describe('computeDiff', () => {
  it('returns null for the first composition', () => {
    expect(computeDiff(null, { panels: [panel('a', 'left', 'S')] })).toBeNull();
  });

  it('classifies added, removed, kept, and moved panels', () => {
    const prev = {
      panels: [panel('a', 'left', 'S'), panel('b', 'center', 'M'), panel('c', 'right', 'M')],
    };
    const next = {
      panels: [panel('a', 'left', 'S'), panel('b', 'center', 'L'), panel('d', 'center', 'M')],
    };
    expect(computeDiff(prev, next)).toEqual({
      added: ['d'],
      removed: ['c'],
      kept: ['a', 'b'],
      moved: ['b'],
    });
  });

  it('treats a zone-only change as moved', () => {
    const prev = { panels: [panel('a', 'left', 'M')] };
    const next = { panels: [panel('a', 'right', 'M')] };
    expect(computeDiff(prev, next)?.moved).toEqual(['a']);
  });
});
