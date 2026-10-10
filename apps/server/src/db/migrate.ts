import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sql } from './client';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Applies pending migrations in filename order, one transaction each. Returns applied names. */
export async function migrate(sql: Sql, schema: string): Promise<string[]> {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(schema)}.migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  const rows = await sql<{ name: string }[]>`SELECT name FROM ${sql(schema)}.migrations`;
  const applied = new Set(rows.map((r) => r.name));

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('search_path', ${schema}, true)`;
      await tx.unsafe(body);
      await tx`INSERT INTO ${tx(schema)}.migrations (name) VALUES (${file})`;
    });
    ran.push(file);
  }
  return ran;
}
