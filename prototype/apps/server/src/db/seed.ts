import { startOfDay } from '../lib/dates';
import { log } from '../log';
import type { Sql } from './client';
import { buildHeliosStory } from './story-helios';
import { buildStory } from './story';
import { DEMO_PASSWORD, DEMO_TENANTS, seedTenants } from './tenants';

const USAGE_CHUNK = 1000;

/** Truncates story tables, inserts both org portfolios, then wires isolated tenants. */
export async function seed(
  sql: Sql,
  schema: string,
  today = startOfDay(new Date()),
): Promise<void> {
  const northwind = buildStory(today);
  const helios = buildHeliosStory(today);

  const people = [...northwind.people, ...helios.people];
  const clients = [...northwind.clients, ...helios.clients];
  const releases = northwind.releases;
  const usage = [...northwind.usage, ...helios.usage];
  const tickets = [...northwind.tickets, ...helios.tickets];
  const communications = [...northwind.communications, ...helios.communications];
  const meetings = [...northwind.meetings, ...helios.meetings];
  const projects = [...northwind.projects, ...helios.projects];
  const tasks = [...northwind.tasks, ...helios.tasks];

  await sql.begin(async (tx) => {
    await tx`SELECT set_config('search_path', ${schema}, true)`;
    await tx`
      TRUNCATE people, clients, releases, usage_daily, tickets, communications, meetings, projects, tasks
      RESTART IDENTITY CASCADE`;

    await tx`INSERT INTO people ${tx(people)}`;
    await tx`INSERT INTO clients ${tx(clients)}`;
    await tx`INSERT INTO releases ${tx(releases.map((r) => ({ ...r, features: tx.json(r.features) })))}`;
    for (let i = 0; i < usage.length; i += USAGE_CHUNK) {
      await tx`INSERT INTO usage_daily ${tx(usage.slice(i, i + USAGE_CHUNK))}`;
    }
    await tx`INSERT INTO tickets ${tx(tickets.map((r) => ({ ...r, tags: tx.json(r.tags) })))}`;
    await tx`INSERT INTO communications ${tx(communications)}`;
    await tx`INSERT INTO meetings ${tx(
      meetings.map((r) => ({ ...r, commitments: tx.json(r.commitments.map((c) => ({ ...c }))) })),
    )}`;
    await tx`INSERT INTO projects ${tx(projects)}`;
    await tx`INSERT INTO tasks ${tx(tasks.map((r) => ({ ...r, depends_on: tx.json(r.depends_on) })))}`;
  });

  // Auth/org tables may not exist yet on very early migrate-only paths; ignore then.
  try {
    await seedTenants(sql, schema);
    for (const t of DEMO_TENANTS) {
      log.info(`Demo tenant ready: ${t.email} / ${DEMO_PASSWORD} → ${t.name}`, {
        orgId: t.orgId,
        clients: t.clientIds.length,
      });
    }
  } catch (err) {
    log.warn('Story seed OK, but tenant seed skipped (auth/org tables missing?)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Seeds only when the clients table is empty. Returns true if it seeded. */
export async function seedIfEmpty(sql: Sql, schema: string): Promise<boolean> {
  const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ${sql(schema)}.clients`;
  if ((row?.n ?? 0) > 0) return false;
  await seed(sql, schema);
  return true;
}
