import { describe, expect, it } from 'vitest';
import {
  ComponentManifest,
  MANIFESTS,
  NEED_QUESTIONS,
  NeedType,
  SHAPE_TEMPLATES,
  Shape,
  templateNeeds,
} from '../src';

const SIZE_ORDER = ['S', 'M', 'L'] as const;

describe('component manifests', () => {
  it('declares exactly the 15 registry components', () => {
    expect(MANIFESTS).toHaveLength(15);
    expect(new Set(MANIFESTS.map((m) => m.id)).size).toBe(15);
  });

  it('every manifest parses with the shared schema', () => {
    for (const m of MANIFESTS) expect(ComponentManifest.parse(m)).toEqual(m);
  });

  it('sizes are ascending and the heading matches the primary need question', () => {
    for (const m of MANIFESTS) {
      const idx = m.sizes.map((s) => SIZE_ORDER.indexOf(s));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
      const primary = m.answers[0];
      expect(primary).toBeDefined();
      expect(m.question).toBe(NEED_QUESTIONS[primary!.need]);
    }
  });

  it('every need type is answered by at least one component', () => {
    const answered = new Set(MANIFESTS.flatMap((m) => m.answers.map((a) => a.need)));
    for (const need of NeedType.options) expect(answered.has(need)).toBe(true);
  });
});

describe('shape templates', () => {
  it('templateNeeds returns template-sourced needs with the configured priorities', () => {
    for (const shape of Shape.options) {
      const needs = templateNeeds(shape);
      expect(needs).toHaveLength(Object.keys(SHAPE_TEMPLATES[shape]).length);
      for (const n of needs) {
        expect(n.source).toBe('template');
        expect(n.priority).toBe(SHAPE_TEMPLATES[shape][n.type]);
        expect(n.question).toBe(NEED_QUESTIONS[n.type]);
      }
    }
  });
});
