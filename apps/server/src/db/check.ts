import { env } from '../env';
import { createSql } from './client';

/** Prints table counts for the configured schema; never logs DATABASE_URL. */
async function main(): Promise<void> {
  if (!env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }
  const schema = env.DB_SCHEMA;
  const sql = createSql(env.DATABASE_URL, schema);
  try {
    const schemas = await sql<{ nspname: string }[]>`
      SELECT nspname FROM pg_namespace WHERE nspname = ${schema}`;
    console.log(`schema "${schema}" exists: ${schemas.length > 0}`);
    if (!schemas.length) return;

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${schema}
      ORDER BY 1`;
    console.log(`tables: ${tables.map((t) => t.table_name).join(', ')}`);

    const [clients] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${sql(schema)}.clients`;
    const [projects] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${sql(schema)}.projects`;
    const [usage] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${sql(schema)}.usage_daily`;
    console.log(
      `counts: clients=${clients?.n ?? 0} projects=${projects?.n ?? 0} usage_daily=${usage?.n ?? 0}`,
    );
    const names = await sql<{ name: string }[]>`
      SELECT name FROM ${sql(schema)}.clients ORDER BY name`;
    console.log(`clients: ${names.map((n) => n.name).join(' | ') || '(none)'}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();
