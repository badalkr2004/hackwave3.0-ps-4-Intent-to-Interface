import { describe, expect, it } from 'vitest';
import { DEMO_PROMPTS, type ClientRef, type Scope } from '@gestalt/shared';
import { keywordIntent, type KeywordContext } from '../src/fallback/keywordIntent';
import { aliasesFor } from '../src/services/entities';
import { describeIntent, finalizeIntent, mergeScope } from '../src/services/intent';

const CLIENTS: ClientRef[] = ['Acme Corp', 'Globex', 'Initech', 'Umbrella Labs'].map((name) => ({
  id: name.split(' ')[0]!.toLowerCase(),
  name,
  aliases: aliasesFor(name),
}));

const ctx = (current: KeywordContext['current'] = null): KeywordContext => ({
  clients: CLIENTS,
  current,
  defaultClientId: 'acme',
});

const ACME: Scope = { clientId: 'acme', projectId: null, timeRange: '30d' };

describe('keyword intent fallback (Section 10.7)', () => {
  it('maps the four demo prompts', () => {
    const [prepare, why, overdue, lookInto] = DEMO_PROMPTS;

    const p = keywordIntent(prepare, ctx());
    expect(p.interpretations).toHaveLength(1);
    expect(p.interpretations[0]).toMatchObject({
      shape: 'prepare',
      confidence: 0.7,
      scope: { clientId: 'acme' },
    });

    const d = keywordIntent(why, ctx({ shape: 'prepare', scope: ACME }));
    expect(d.interpretations[0]!.shape).toBe('diagnose');
    expect(d.interpretations[0]!.scope.clientId).toBeUndefined(); // carried over
    expect(d.isPivot).toBe(true);

    const t = keywordIntent(overdue, ctx({ shape: 'diagnose', scope: ACME }));
    expect(t.interpretations[0]).toMatchObject({ shape: 'triage', scope: { clientId: null } });

    const l = keywordIntent(lookInto, ctx());
    expect(l.interpretations.map((i) => [i.shape, i.confidence])).toEqual([
      ['prepare', 0.5],
      ['diagnose', 0.45],
    ]);
  });

  it('treats empty text and reset words as overview', () => {
    for (const text of ['', '   ', 'go home', 'reset', 'show the dashboard']) {
      expect(keywordIntent(text, ctx()).interpretations[0]!.shape).toBe('overview');
    }
  });

  it('emits two interpretations when two shapes match', () => {
    const r = keywordIntent('why is the meeting prep overdue', ctx());
    expect(r.interpretations.map((i) => i.confidence)).toEqual([0.5, 0.45]);
  });

  it('matches clients by alias and picks the lowest-health client when none is named', () => {
    expect(
      keywordIntent('prep for the globex call', ctx()).interpretations[0]!.scope.clientId,
    ).toBe('globex');
    expect(keywordIntent('prepare for my meeting', ctx()).interpretations[0]!.scope.clientId).toBe(
      'acme',
    );
  });

  it('reads time ranges', () => {
    expect(
      keywordIntent('why did acme usage drop this quarter', ctx()).interpretations[0]!.scope
        .timeRange,
    ).toBe('90d');
    expect(
      keywordIntent('why did acme usage drop last week', ctx()).interpretations[0]!.scope.timeRange,
    ).toBe('7d');
  });
});

describe('intent finalization', () => {
  it('clarifies on low confidence or a close runner-up', () => {
    const l = keywordIntent(DEMO_PROMPTS[3], ctx());
    expect(finalizeIntent(l, null, CLIENTS).kind).toBe('clarify');
  });

  it('carries scope over and fills headline templates', () => {
    const parsed = keywordIntent(DEMO_PROMPTS[1], ctx({ shape: 'prepare', scope: ACME }));
    const r = finalizeIntent(parsed, ACME, CLIENTS);
    expect(r.kind).toBe('intent');
    if (r.kind !== 'intent') return;
    expect(r.intent.scope).toEqual(ACME);
    expect(r.intent.headline).toBe('Investigating Acme Corp usage drop');
    expect(r.intent.summary).toBe(
      "Investigating why Acme Corp's usage changed over the last 30 days.",
    );
  });

  it('explicit null clears scope, omitted keeps it', () => {
    expect(mergeScope(ACME, { clientId: null })).toEqual({ ...ACME, clientId: null });
    expect(mergeScope(ACME, { timeRange: '7d' })).toEqual({ ...ACME, timeRange: '7d' });
    expect(mergeScope(null, {})).toEqual({ clientId: null, projectId: null, timeRange: '30d' });
  });

  it('uses the Section 10.2 templates', () => {
    expect(describeIntent('prepare', ACME, CLIENTS).headline).toBe('Preparing for Acme Corp');
    expect(describeIntent('triage', { ...ACME, clientId: null }, CLIENTS)).toEqual({
      summary: 'Reviewing overdue work.',
      headline: 'Reviewing overdue work',
    });
    expect(describeIntent('overview', ACME, CLIENTS).headline).toBe('Overview');
  });
});
