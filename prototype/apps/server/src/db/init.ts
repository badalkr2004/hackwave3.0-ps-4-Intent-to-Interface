import { env } from '../env';
import { log } from '../log';
import { getDb } from './client';
import { migrate } from './migrate';
import { seedIfEmpty } from './seed';
import { setDbState } from './state';

/** Boot-time migrate + seed-if-empty. Never throws: on failure the app stays in fixture mode. */
export async function initDatabase(): Promise<void> {
  const db = getDb();
  if (!db) {
    log.warn('DATABASE_URL is not set: serving fixture data only.');
    return;
  }
  try {
    const ran = await migrate(db.sql, db.schema);
    if (ran.length) log.info(`Applied migrations: ${ran.join(', ')}`);
    if (await seedIfEmpty(db.sql, db.schema)) log.info(`Seeded empty schema "${db.schema}".`);
    setDbState('up');
    log.info(`Database ready (schema "${env.DB_SCHEMA}").`);
  } catch (err) {
    setDbState('down');
    log.warn('Database unreachable: serving fixture data only.', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
