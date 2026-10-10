import { describe, expect, it } from 'vitest';
import { buildStory } from '../src/db/story';
import { addDays, startOfDay, toISODate } from '../src/lib/dates';

const today = startOfDay(new Date());
const story = buildStory(today);

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function windowMean(
  clientId: string,
  dimension: string,
  segment: string,
  from: number,
  to: number,
) {
  const lo = toISODate(addDays(today, from));
  const hi = toISODate(addDays(today, to));
  return mean(
    story.usage
      .filter((r) => r.client_id === clientId && r.dimension === dimension && r.segment === segment)
      .filter((r) => r.date >= lo && r.date <= hi)
      .map((r) => r.value),
  );
}

// SPEC-NOTE: Section 5.8 phrases the drop as "last 30 days vs prior 30 days", but Section 5.3 puts
// the decay at day -17 and the 38% figure on the post-drop level, so a literal 30-vs-30 comparison
// yields roughly 20%. The drop is measured as the current run rate (last 7 days) against the 4 weeks
// before the anomaly (days -45..-18). Both windows are whole weeks, so weekday mix cancels out.
function acmeDropPct(mean7: number, baseline: number): number {
  return (1 - mean7 / baseline) * 100;
}

describe('seed story (pure)', () => {
  it('is deterministic for a given day', () => {
    expect(buildStory(today)).toEqual(story);
  });

  it('acme total usage dropped ~38% after v2.4', () => {
    const drop = acmeDropPct(
      windowMean('acme', 'total', 'total', -7, -1),
      windowMean('acme', 'total', 'total', -45, -18),
    );
    expect(drop).toBeGreaterThanOrEqual(36);
    expect(drop).toBeLessThanOrEqual(40);
  });

  it('the acme drop is concentrated in export and finance', () => {
    const delta = (dim: string, seg: string) =>
      acmeDropPct(windowMean('acme', dim, seg, -7, -1), windowMean('acme', dim, seg, -45, -18));
    expect(delta('feature', 'export')).toBeGreaterThan(65);
    expect(delta('feature', 'dashboards')).toBeLessThan(20);
    expect(delta('team', 'finance')).toBeGreaterThan(55);
    expect(delta('team', 'sales')).toBeLessThan(15);
  });

  it('dev carries 14 open tasks', () => {
    expect(story.tasks.filter((t) => t.owner_id === 'dev' && t.status !== 'done')).toHaveLength(14);
  });

  it('task dependencies reference existing tasks', () => {
    const ids = new Set(story.tasks.map((t) => t.id));
    for (const t of story.tasks) for (const dep of t.depends_on) expect(ids.has(dep)).toBe(true);
  });
});
