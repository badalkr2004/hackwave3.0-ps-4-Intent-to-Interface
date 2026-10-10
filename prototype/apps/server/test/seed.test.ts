import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql, Db } from '../src/db/client';
import { migrate } from '../src/db/migrate';
import { seed } from '../src/db/seed';
import { env } from '../src/env';
import { addDays, DAY_MS, startOfDay, toISODate } from '../src/lib/dates';

// Integration test: runs against DATABASE_URL in a throwaway schema, never the app schema.
const SCHEMA = 'gestalt_test';
const today = startOfDay(new Date());
const day = (n: number) => toISODate(addDays(today, n));

describe.skipIf(!env.DATABASE_URL)('seed invariants (Section 5.8)', () => {
  let db: Db;

  beforeAll(async () => {
    db = new Db(createSql(env.DATABASE_URL!, SCHEMA), SCHEMA);
    const { sql } = db;
    await sql`DROP SCHEMA IF EXISTS ${sql(SCHEMA)} CASCADE`;
    await migrate(sql, SCHEMA);
    await seed(sql, SCHEMA, today);
  }, 120_000);

  afterAll(async () => {
    if (!db) return;
    const { sql } = db;
    await sql`DROP SCHEMA IF EXISTS ${sql(SCHEMA)} CASCADE`;
    await sql.end({ timeout: 5 });
  }, 60_000);

  it('migrations are idempotent', async () => {
    expect(await migrate(db.sql, SCHEMA)).toEqual([]);
  });

  it('acme total DAU is 36-40% below its pre-release baseline', async () => {
    const [row] = await db.sql<{ current: number; baseline: number }[]>`
      SELECT
        avg(value) FILTER (WHERE date BETWEEN ${day(-7)} AND ${day(-1)})::float8 AS current,
        avg(value) FILTER (WHERE date BETWEEN ${day(-45)} AND ${day(-18)})::float8 AS baseline
      FROM ${db.table('usage_daily')}
      WHERE client_id = 'acme' AND dimension = 'total'`;
    const drop = (1 - row!.current / row!.baseline) * 100;
    expect(drop).toBeGreaterThanOrEqual(36);
    expect(drop).toBeLessThanOrEqual(40);
  });

  it('has exactly 3 open tickets tagged export', async () => {
    const [row] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${db.table('tickets')}
      WHERE status = 'open' AND tags @> ${db.sql.json(['export'])}`;
    expect(row!.n).toBe(3);
  });

  it('has exactly 4 overdue tasks, 3 of them in proj-export-hotfix', async () => {
    const rows = await db.sql<{ project_id: string; n: number }[]>`
      SELECT project_id, count(*)::int AS n FROM ${db.table('tasks')}
      WHERE due < ${day(0)} AND status <> 'done'
      GROUP BY project_id`;
    const total = rows.reduce((a, r) => a + r.n, 0);
    expect(total).toBe(4);
    expect(rows.find((r) => r.project_id === 'proj-export-hotfix')?.n).toBe(3);
  });

  it("Dev's capacity is above 150%", async () => {
    const [row] = await db.sql<{ capacity_pct: number }[]>`
      SELECT capacity_pct FROM ${db.table('people')} WHERE id = 'dev'`;
    expect(row!.capacity_pct).toBeGreaterThan(150);
  });

  it('the upcoming acme meeting is exactly 1 day from today', async () => {
    const [row] = await db.sql<{ date: Date }[]>`
      SELECT date FROM ${db.table('meetings')} WHERE client_id = 'acme' AND date > now()
      ORDER BY date LIMIT 1`;
    const days = Math.round((startOfDay(row!.date).getTime() - today.getTime()) / DAY_MS);
    expect(days).toBe(1);
  });
});
