import { env } from '../env';
import { log } from '../log';
import { createSql } from './client';
import { migrate } from './migrate';
import { seed } from './seed';

const command = process.argv[2];
const COMMANDS = ['migrate', 'seed', 'reset'] as const;

async function main(): Promise<number> {
  if (!COMMANDS.includes(command as (typeof COMMANDS)[number])) {
    log.error(`Usage: bun src/db/cli.ts <${COMMANDS.join('|')}>`);
    return 1;
  }
  if (!env.DATABASE_URL) {
    log.error('DATABASE_URL is not set.');
    return 1;
  }
  if (command === 'reset' && !env.ALLOW_DB_RESET) {
    log.error(
      `Refusing to drop schema "${env.DB_SCHEMA}": set ALLOW_DB_RESET=1 to allow db:reset.`,
    );
    return 1;
  }

  const schema = env.DB_SCHEMA;
  const sql = createSql(env.DATABASE_URL, schema);
  try {
    if (command === 'reset') {
      await sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`;
      log.info(`Dropped schema "${schema}".`);
    }
    const ran = await migrate(sql, schema);
    log.info(ran.length ? `Applied migrations: ${ran.join(', ')}` : 'Migrations up to date.');
    if (command !== 'migrate') {
      const started = Date.now();
      await seed(sql, schema);
      log.info(`Seeded schema "${schema}" in ${Date.now() - started} ms.`);
    }
    return 0;
  } catch (err) {
    log.error(`db:${command} failed`, { error: err instanceof Error ? err.message : String(err) });
    return 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

process.exitCode = await main();
