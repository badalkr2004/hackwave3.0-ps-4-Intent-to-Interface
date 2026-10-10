import { describe, expect, it } from 'vitest';
import {
  fixtureHypotheses,
  fixtureIntent,
  fixtureTalkingPoints,
  normalizePrompt,
} from '../src/fallback/fixtures';
import { DEMO_PROMPTS } from '@gestalt/shared';
import { guardHypotheses, guardTalkingPoints } from '../src/services/copy';
import type { Digest } from '../src/services/digest';

const digest: Digest = {
  scope: {
    client: {
      id: 'client:acme',
      name: 'Acme Corp',
      plan: 'Enterprise',
      arr: 480000,
      health: 54,
      renewalInDays: 75,
      contactName: 'Rohan Mehta',
    },
    timeRange: '30d',
  },
  usage: {
    id: 'usage:acme',
    changePct: -37,
    startedOn: '2026-09-24',
    worstSegments: [
      { id: 'seg:feature:export', dimension: 'feature', label: 'Export', deltaPct: -71 },
    ],
  },
  releases: [
    {
      id: 'rel:v2.4',
      version: 'v2.4',
      daysAgo: 18,
      notes: null,
      features: ['export'],
      correlated: true,
    },
  ],
  tickets: [
    {
      id: 'ticket:T-1',
      title: 'CSV export times out',
      status: 'open',
      priority: 'high',
      tags: ['export'],
      ageDays: 16,
    },
  ],
  comms: [],
  commitments: [
    {
      id: 'commitment:m1-1',
      text: 'Deliver scheduled exports',
      status: 'missed',
      due: '2026-09-30',
    },
  ],
  work: { overdue: [], blockedBy: [], ownerLoad: [] },
  meeting: null,
};

const point = (evidence: string[]) => ({
  type: 'acknowledge' as const,
  headline: 'H',
  detail: 'D',
  evidence,
});

describe('hallucination guard', () => {
  it('removes evidence ids that are not in the digest and labels the rest', () => {
    const out = guardTalkingPoints(
      {
        points: [point(['ticket:T-1', 'ticket:T-99']), point(['rel:v2.4']), point(['usage:acme'])],
      },
      digest,
    );
    expect(out?.points[0]!.evidence).toEqual([
      { id: 'ticket:T-1', label: 'T-1 CSV export times out' },
    ]);
    expect(out?.generatedWithoutAi).toBe(false);
  });

  it('drops points left without evidence and rejects output below the minimum', () => {
    const out = guardTalkingPoints(
      { points: [point(['ticket:T-1']), point(['comm:c404']), point([]), point(['rel:v2.4'])] },
      digest,
    );
    expect(out).toBeNull();
  });

  it('applies the same rules to hypotheses', () => {
    const h = (evidence: string[]) => ({
      title: 'T',
      confidence: 'medium' as const,
      explanation: 'E',
      evidence,
      howToConfirm: 'C',
    });
    expect(guardHypotheses({ hypotheses: [h(['rel:v2.4']), h(['made:up'])] }, digest)).toBeNull();
    expect(
      guardHypotheses({ hypotheses: [h(['rel:v2.4']), h(['seg:feature:export', 'x'])] }, digest)
        ?.hypotheses,
    ).toHaveLength(2);
  });
});

describe('fixtures (Section 10.7)', () => {
  it('normalizes prompt keys', () => {
    expect(normalizePrompt('  I need to prepare tomorrow’s client meeting with Acme. ')).toBe(
      'i need to prepare tomorrows client meeting with acme',
    );
  });

  it('has an intent fixture for every demo prompt', () => {
    for (const p of DEMO_PROMPTS) expect(fixtureIntent(p), p).not.toBeNull();
  });

  it('has Acme copy fixtures and none for other clients', () => {
    expect(fixtureTalkingPoints('acme')?.points.length).toBeGreaterThanOrEqual(3);
    expect(fixtureHypotheses('acme')?.hypotheses.length).toBeGreaterThanOrEqual(2);
    expect(fixtureTalkingPoints('globex')).toBeNull();
  });
});
