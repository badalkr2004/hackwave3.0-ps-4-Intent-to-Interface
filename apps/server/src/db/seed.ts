import { startOfDay } from '../lib/dates';
import type { Sql } from './client';
import { buildStory } from './story';

const USAGE_CHUNK = 1000;

/** Truncates the schema's tables and reinserts the demo story in one transaction. */
export async function seed(
  sql: Sql,
  schema: string,
  today = startOfDay(new Date()),
): Promise<void> {
  const s = buildStory(today);
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('search_path', ${schema}, true)`;
    await tx`
      TRUNCATE people, clients, releases, usage_daily, tickets, communications, meetings, projects, tasks
      RESTART IDENTITY CASCADE`;

    await tx`INSERT INTO people ${tx(s.people)}`;
    await tx`INSERT INTO clients ${tx(s.clients)}`;
    await tx`INSERT INTO releases ${tx(s.releases.map((r) => ({ ...r, features: tx.json(r.features) })))}`;
    for (let i = 0; i < s.usage.length; i += USAGE_CHUNK) {
      await tx`INSERT INTO usage_daily ${tx(s.usage.slice(i, i + USAGE_CHUNK))}`;
    }
    await tx`INSERT INTO tickets ${tx(s.tickets.map((r) => ({ ...r, tags: tx.json(r.tags) })))}`;
    await tx`INSERT INTO communications ${tx(s.communications)}`;
    await tx`INSERT INTO meetings ${tx(
      s.meetings.map((r) => ({ ...r, commitments: tx.json(r.commitments.map((c) => ({ ...c }))) })),
    )}`;
    await tx`INSERT INTO projects ${tx(s.projects)}`;
    await tx`INSERT INTO tasks ${tx(s.tasks.map((r) => ({ ...r, depends_on: tx.json(r.depends_on) })))}`;
  });
}

/** Seeds only when the clients table is empty. Returns true if it seeded. */
export async function seedIfEmpty(sql: Sql, schema: string): Promise<boolean> {
  const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ${sql(schema)}.clients`;
  if ((row?.n ?? 0) > 0) return false;
  await seed(sql, schema);
  return true;
}
