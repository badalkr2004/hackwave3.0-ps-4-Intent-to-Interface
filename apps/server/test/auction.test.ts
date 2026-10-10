import { describe, expect, it } from 'vitest';
import {
  MANIFESTS,
  SIZE_UNITS,
  ZONE_CAPACITY,
  templateNeeds,
  type Need,
  type Shape,
  type Size,
  type Zone,
} from '@gestalt/shared';
import {
  ghostLayout,
  runAuction,
  type AuctionResult,
  type ComponentData,
} from '../src/services/auction';

// Signals derived from the Section 5 seed story (see each registry module's signal()).
const ACME_SIGNALS: Record<string, number | null> = {
  portfolio_health: 0.25, // 1 of 4 clients under 60
  upcoming_meetings: 1, // Acme QBR tomorrow
  client_snapshot: 0.46, // 1 - 54/100
  last_meeting_recap: 2 / 3, // 1 missed + 1 open of 3
  comms_timeline: 0.367, // -avg(-0.7, 0, -0.4)
  open_issues: 0.6, // 0.6 * high share 0.5 + 0.4 * recency 0.75
  usage_trend: 0.95, // 38 / 40
  segment_breakdown: 1, // export -71 vs alerts -5
  release_strip: 1, // v2.4 one day before the drop
  hypothesis_list: 0.95,
  talking_points: 0.683, // 0.5 + 0.5 * max(0.367, 1/3)
  overdue_queue: 1, // 4 overdue
  blocker_chain: 1, // T3 blocked by overdue T1
  workload_bars: 0.75, // (160 - 100) / 80
  action_bar: 0.8,
};

// No client in scope: client-only components have no data; snapshot falls back to the most at-risk client.
const PORTFOLIO_SIGNALS: Record<string, number | null> = {
  ...ACME_SIGNALS,
  last_meeting_recap: null,
  comms_timeline: null,
  segment_breakdown: null,
  hypothesis_list: null,
  talking_points: null,
  open_issues: 0.533, // 6 open, 2 high, 5 recent
  usage_trend: 0.28, // portfolio-wide change about -11%
};

function dataFrom(signals: Record<string, number | null>): Record<string, ComponentData> {
  return Object.fromEntries(
    Object.entries(signals).map(([id, s]) => [
      id,
      {
        props: s === null ? null : { id },
        signal: s ?? 0,
        evidence: s === null ? [] : [`${id} evidence`],
      },
    ]),
  );
}

function compose(
  shape: Shape,
  signals: Record<string, number | null>,
  opts: { pinned?: string[]; dismissed?: string[]; needs?: Need[] } = {},
): AuctionResult {
  return runAuction({
    shape,
    needs: opts.needs ?? templateNeeds(shape),
    manifests: MANIFESTS,
    data: dataFrom(signals),
    pinned: new Set(opts.pinned ?? []),
    dismissed: new Set(opts.dismissed ?? []),
  });
}

const RANK: Record<Size, number> = { S: 0, M: 1, L: 2 };

function expectPanel(r: AuctionResult, id: string, zone: Zone, minSize: Size, maxSize: Size = 'L') {
  const p = r.panels.find((x) => x.componentId === id);
  expect(p, `${id} should be placed`).toBeDefined();
  expect(p!.zone, `${id} zone`).toBe(zone);
  expect(RANK[p!.size], `${id} size ${p!.size} >= ${minSize}`).toBeGreaterThanOrEqual(
    RANK[minSize],
  );
  expect(RANK[p!.size], `${id} size ${p!.size} <= ${maxSize}`).toBeLessThanOrEqual(RANK[maxSize]);
}

function expectExcluded(r: AuctionResult, id: string, reason: string) {
  const e = r.excluded.find((x) => x.componentId === id);
  expect(e, `${id} should be excluded`).toBeDefined();
  expect(e!.reason, `${id} exclusion reason`).toBe(reason);
}

function expectWithinCapacity(r: AuctionResult) {
  for (const zone of ['left', 'center', 'right'] as const) {
    const used = r.panels
      .filter((p) => p.zone === zone)
      .reduce((s, p) => s + SIZE_UNITS[p.size], 0);
    expect(used, `${zone} capacity`).toBeLessThanOrEqual(ZONE_CAPACITY[zone]);
  }
}

describe('Section 8.2 expected compositions', () => {
  it('prepare, acme', () => {
    const r = compose('prepare', ACME_SIGNALS);
    expectPanel(r, 'talking_points', 'center', 'L');
    expectPanel(r, 'usage_trend', 'center', 'M');
    expectPanel(r, 'comms_timeline', 'center', 'M');
    expectPanel(r, 'client_snapshot', 'left', 'M');
    expectPanel(r, 'last_meeting_recap', 'left', 'M');
    expectPanel(r, 'open_issues', 'right', 'M');
    expectPanel(r, 'action_bar', 'right', 'M');
    for (const id of ['hypothesis_list', 'segment_breakdown', 'blocker_chain', 'workload_bars'])
      expectExcluded(r, id, 'not_relevant');
    expectWithinCapacity(r);
  });

  it('diagnose, acme', () => {
    const r = compose('diagnose', ACME_SIGNALS);
    expectPanel(r, 'usage_trend', 'center', 'L');
    expectPanel(r, 'segment_breakdown', 'center', 'M');
    expectPanel(r, 'hypothesis_list', 'center', 'M');
    expectPanel(r, 'release_strip', 'left', 'M');
    expectPanel(r, 'open_issues', 'right', 'M');
    expectPanel(r, 'client_snapshot', 'left', 'S', 'S');
    expectPanel(r, 'action_bar', 'right', 'M');
    expectExcluded(r, 'talking_points', 'not_relevant');
    expectExcluded(r, 'last_meeting_recap', 'not_relevant');
    expectWithinCapacity(r);
  });

  it('triage, no client', () => {
    const r = compose('triage', PORTFOLIO_SIGNALS);
    expectPanel(r, 'overdue_queue', 'center', 'L');
    expectPanel(r, 'blocker_chain', 'center', 'M');
    expectPanel(r, 'workload_bars', 'left', 'M');
    expectPanel(r, 'action_bar', 'right', 'M');
    expectPanel(r, 'open_issues', 'right', 'S');
    expectExcluded(r, 'client_snapshot', 'low_score');
    expectExcluded(r, 'usage_trend', 'not_relevant');
    expectWithinCapacity(r);
  });

  it('overview', () => {
    const r = compose('overview', PORTFOLIO_SIGNALS);
    expectPanel(r, 'portfolio_health', 'left', 'S');
    expectPanel(r, 'upcoming_meetings', 'left', 'S');
    expectPanel(r, 'usage_trend', 'center', 'S');
    expectPanel(r, 'overdue_queue', 'center', 'S');
    expectPanel(r, 'open_issues', 'right', 'S');
    expectExcluded(r, 'talking_points', 'not_relevant');
    expectExcluded(r, 'hypothesis_list', 'not_relevant');
    expectWithinCapacity(r);
  });
});

describe('auction rules', () => {
  it('downgrades sizes when a zone budget overflows', () => {
    // Diagnose center wants L+L+L (9 units) but has 8: the lowest scorer steps down to M.
    const r = compose('diagnose', ACME_SIGNALS);
    const hyp = r.panels.find((p) => p.componentId === 'hypothesis_list')!;
    expect(hyp.score).toBeGreaterThanOrEqual(0.8);
    expect(hyp.size).toBe('M');
  });

  it('excludes with no_space when nothing fits, never exceeding capacity', () => {
    const needs: Need[] = templateNeeds('diagnose').concat(
      (['talking_points', 'overdue_work', 'blockers'] as const).map((type) => ({
        type,
        question: type,
        priority: 0.95,
        source: 'llm_added' as const,
      })),
    );
    const r = compose('diagnose', ACME_SIGNALS, { needs });
    expectWithinCapacity(r);
    expect(r.excluded.some((e) => e.reason === 'no_space')).toBe(true);
  });

  it('pin forces inclusion and evicts the lowest-scoring unpinned panel in its zone', () => {
    const base = compose('diagnose', ACME_SIGNALS);
    const centerBefore = base.panels.filter((p) => p.zone === 'center');
    const lowest = [...centerBefore].sort((a, b) => a.score - b.score)[0]!;

    const needs: Need[] = [
      ...templateNeeds('diagnose'),
      { type: 'overdue_work', question: 'What is slipping?', priority: 1, source: 'user_pinned' },
    ];
    const r = compose('diagnose', ACME_SIGNALS, { pinned: ['overdue_queue'], needs });
    const pinned = r.panels.find((p) => p.componentId === 'overdue_queue');
    expect(pinned?.pinned).toBe(true);
    expect(r.panels.some((p) => p.componentId === lowest.componentId)).toBe(false);
    expectExcluded(r, lowest.componentId, 'no_space');
    expectWithinCapacity(r);
  });

  it('pin keeps a low-score component instead of excluding it as low_score', () => {
    const r = compose('triage', PORTFOLIO_SIGNALS, { pinned: ['client_snapshot'] });
    expect(r.panels.find((p) => p.componentId === 'client_snapshot')?.pinned).toBe(true);
  });

  it('dismiss removes the panel and records the exclusion', () => {
    const r = compose('prepare', ACME_SIGNALS, { dismissed: ['comms_timeline'] });
    expect(r.panels.some((p) => p.componentId === 'comms_timeline')).toBe(false);
    expectExcluded(r, 'comms_timeline', 'dismissed');
  });

  it('excludes a relevant component with null props as no_data', () => {
    const r = compose('prepare', { ...ACME_SIGNALS, last_meeting_recap: null });
    expectExcluded(r, 'last_meeting_recap', 'no_data');
  });

  it('writes receipts with the need, score, size, and a one-sentence reason', () => {
    const r = compose('prepare', ACME_SIGNALS);
    const rec = r.receipts.find((x) => x.componentId === 'talking_points')!;
    expect(rec.need).toBe('talking_points');
    expect(rec.size).toBe(r.panels.find((p) => p.componentId === 'talking_points')!.size);
    expect(rec.reason).toBe(
      "Answers 'What should I say and ask?' (priority 0.95). talking_points evidence.",
    );
    expect(r.receipts).toHaveLength(r.panels.length);
  });

  it('records secondary needs a component also serves', () => {
    const r = compose('diagnose', ACME_SIGNALS);
    expect(r.receipts.find((x) => x.componentId === 'usage_trend')?.alsoServes).toEqual([
      'change_correlation',
    ]);
  });

  it('is deterministic', () => {
    expect(compose('diagnose', ACME_SIGNALS)).toEqual(compose('diagnose', ACME_SIGNALS));
    expect(compose('triage', PORTFOLIO_SIGNALS, { pinned: ['client_snapshot'] })).toEqual(
      compose('triage', PORTFOLIO_SIGNALS, { pinned: ['client_snapshot'] }),
    );
  });
});

describe('ghostLayout', () => {
  it('previews a shape from template needs only', () => {
    const g = ghostLayout('triage', MANIFESTS);
    expect(g.center.map((s) => s.componentId)).toContain('overdue_queue');
    expect(g.left.map((s) => s.componentId)).toContain('workload_bars');
    expect(ghostLayout('triage', MANIFESTS)).toEqual(g);
  });
});
