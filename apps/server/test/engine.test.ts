import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MANIFESTS,
  PANEL_PROPS,
  isComponentId,
  templateNeeds,
  type Scope,
  type Shape,
  type Size,
} from '@gestalt/shared';
import { createSql, Db } from '../src/db/client';
import { migrate } from '../src/db/migrate';
import { seed } from '../src/db/seed';
import { env } from '../src/env';
import { startOfDay } from '../src/lib/dates';
import { runAuction, type AuctionResult } from '../src/services/auction';
import { componentData, loadScopeData } from '../src/services/data';
import { buildDigest, digestIds } from '../src/services/digest';
import { loadEntities } from '../src/services/entities';

// Integration test: the full deterministic engine (loaders -> signals -> auction) on seeded data,
// in a throwaway schema.
const SCHEMA = 'gestalt_test_engine';
const today = startOfDay(new Date());
const ACME: Scope = { clientId: 'acme', projectId: null, timeRange: '30d' };
const ALL: Scope = { clientId: null, projectId: null, timeRange: '30d' };
const RANK: Record<Size, number> = { S: 0, M: 1, L: 2 };

describe.skipIf(!env.DATABASE_URL)(
  'engine on seeded data (Section 8.2)',
  { timeout: 30_000 },
  () => {
    let db: Db;

    beforeAll(async () => {
      db = new Db(createSql(env.DATABASE_URL!, SCHEMA), SCHEMA);
      await db.sql`DROP SCHEMA IF EXISTS ${db.sql(SCHEMA)} CASCADE`;
      await migrate(db.sql, SCHEMA);
      await seed(db.sql, SCHEMA, today);
    }, 120_000);

    afterAll(async () => {
      if (!db) return;
      await db.sql`DROP SCHEMA IF EXISTS ${db.sql(SCHEMA)} CASCADE`;
      await db.sql.end({ timeout: 5 });
    }, 60_000);

    async function run(shape: Shape, scope: Scope): Promise<AuctionResult> {
      const data = await componentData(await loadScopeData(db, scope, today), shape);
      return runAuction({
        shape,
        needs: templateNeeds(shape),
        manifests: MANIFESTS,
        data,
        pinned: new Set(),
        dismissed: new Set(),
      });
    }

    function expectPanel(r: AuctionResult, id: string, zone: string, min: Size, max: Size = 'L') {
      const p = r.panels.find((x) => x.componentId === id);
      expect(p, `${id} placed`).toBeDefined();
      expect(p!.zone).toBe(zone);
      expect(RANK[p!.size], `${id} size ${p!.size}`).toBeGreaterThanOrEqual(RANK[min]);
      expect(RANK[p!.size], `${id} size ${p!.size}`).toBeLessThanOrEqual(RANK[max]);
    }

    it('every loader returns props that satisfy its schema', async () => {
      for (const scope of [ACME, ALL]) {
        const { props } = await loadScopeData(db, scope, today);
        for (const [id, p] of Object.entries(props)) {
          if (p === null || !isComponentId(id)) continue;
          expect(PANEL_PROPS[id].safeParse(p).success, id).toBe(true);
        }
      }
    });

    it('prepare, acme', async () => {
      const r = await run('prepare', ACME);
      expectPanel(r, 'talking_points', 'center', 'L');
      expectPanel(r, 'usage_trend', 'center', 'M');
      expectPanel(r, 'comms_timeline', 'center', 'M');
      expectPanel(r, 'client_snapshot', 'left', 'M');
      expectPanel(r, 'last_meeting_recap', 'left', 'M');
      expectPanel(r, 'open_issues', 'right', 'M');
      expectPanel(r, 'action_bar', 'right', 'M');
    });

    it('diagnose, acme', async () => {
      const r = await run('diagnose', ACME);
      expectPanel(r, 'usage_trend', 'center', 'L');
      expectPanel(r, 'segment_breakdown', 'center', 'M');
      expectPanel(r, 'hypothesis_list', 'center', 'M');
      expectPanel(r, 'release_strip', 'left', 'M');
      expectPanel(r, 'open_issues', 'right', 'M');
      expectPanel(r, 'client_snapshot', 'left', 'S', 'S');
      expectPanel(r, 'action_bar', 'right', 'M');
    });

    it('triage, no client', async () => {
      const r = await run('triage', ALL);
      expectPanel(r, 'overdue_queue', 'center', 'L');
      expectPanel(r, 'blocker_chain', 'center', 'M');
      expectPanel(r, 'workload_bars', 'left', 'M');
      expectPanel(r, 'action_bar', 'right', 'M');
      expectPanel(r, 'open_issues', 'right', 'S');
      expect(r.excluded.find((e) => e.componentId === 'client_snapshot')?.reason).toBe('low_score');
    });

    it('overview', async () => {
      const r = await run('overview', ALL);
      for (const id of [
        'portfolio_health',
        'upcoming_meetings',
        'usage_trend',
        'overdue_queue',
        'open_issues',
      ]) {
        expect(
          r.panels.some((p) => p.componentId === id),
          id,
        ).toBe(true);
      }
    });

    it('action bar actions follow the shape', async () => {
      const data = await loadScopeData(db, ACME, today);
      const prepare = (await componentData(data, 'prepare')).action_bar!.props as {
        actions: { id: string }[];
      };
      const diagnose = (await componentData(data, 'diagnose')).action_bar!.props as {
        actions: { id: string }[];
      };
      expect(prepare.actions.map((a) => a.id)).toEqual([
        'draft_pre_meeting_email',
        'add_followup_task',
        'reschedule_meeting',
      ]);
      expect(diagnose.actions.map((a) => a.id)).toEqual([
        'notify_engineering',
        'draft_customer_update',
      ]);
    });

    it('rule-based copy cites only digest ids', async () => {
      const data = await loadScopeData(db, ACME, today);
      const ids = digestIds(await buildDigest(data.ctx));
      const hyp = data.props.hypothesis_list!;
      const tp = data.props.talking_points!;
      expect(hyp.hypotheses.length).toBeGreaterThanOrEqual(2);
      expect(hyp.hypotheses.some((h) => h.confidence === 'low')).toBe(true);
      expect(tp.points.length).toBeGreaterThanOrEqual(3);
      for (const e of [...hyp.hypotheses, ...tp.points].flatMap((x) => x.evidence)) {
        expect(ids.has(e.id), e.id).toBe(true);
      }
      expect(hyp.hypotheses[0]!.evidence.map((e) => e.id)).toContain('rel:v2.4');
    });

    it('loads entities with aliases and the lowest-health client', async () => {
      const ents = await loadEntities(db);
      expect(ents.lowestHealthClientId).toBe('acme');
      expect(ents.clients.find((c) => c.id === 'acme')?.aliases).toContain('acme');
    });
  },
);
