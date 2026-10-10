import { describe, expect, it } from 'vitest';
import {
  clampSize,
  packZone,
  sizeForScore,
  sizesDownFrom,
  type PackCandidate,
} from '../src/services/layout';

const cand = (
  id: string,
  score: number,
  order: number,
  extra: Partial<PackCandidate> = {},
): PackCandidate => ({
  componentId: id,
  zone: 'center',
  order,
  score,
  pinned: false,
  desiredSize: sizeForScore(score),
  sizes: ['S', 'M', 'L'],
  ...extra,
});

describe('sizing', () => {
  it('maps scores to sizes at the configured breaks', () => {
    expect(sizeForScore(0.8)).toBe('L');
    expect(sizeForScore(0.79)).toBe('M');
    expect(sizeForScore(0.5)).toBe('M');
    expect(sizeForScore(0.49)).toBe('S');
  });

  it('clamps to supported sizes', () => {
    expect(clampSize('L', ['S', 'M'])).toBe('M');
    expect(clampSize('S', ['M', 'L'])).toBe('M');
    expect(clampSize('M', ['S', 'M', 'L'])).toBe('M');
  });

  it('steps down through supported sizes only', () => {
    expect(sizesDownFrom('L', ['M', 'L'])).toEqual(['L', 'M']);
    expect(sizesDownFrom('M', ['S', 'M'])).toEqual(['M', 'S']);
  });
});

describe('packZone', () => {
  it('orders placed panels by matrix order, then score, then id', () => {
    const { placed } = packZone('center', [
      cand('b', 0.6, 2),
      cand('a', 0.9, 2),
      cand('c', 0.5, 1),
    ]);
    expect(placed.map((p) => p.candidate.componentId)).toEqual(['c', 'a', 'b']);
  });

  it('assigns space by score and drops the lowest when full', () => {
    const { placed, overflow } = packZone('center', [
      cand('x', 0.95, 1),
      cand('y', 0.9, 2),
      cand('z', 0.85, 3),
      cand('w', 0.2, 4, { sizes: ['M', 'L'] }),
    ]);
    expect(placed.map((p) => `${p.candidate.componentId}:${p.size}`)).toEqual([
      'x:L',
      'y:L',
      'z:M',
    ]);
    expect(overflow.map((c) => c.componentId)).toEqual(['w']);
  });
});
