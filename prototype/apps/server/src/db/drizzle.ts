import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './auth-schema';

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Drizzle client for auth tables. Null when DATABASE_URL is unset. */
export function getDrizzle() {
  if (!env.DATABASE_URL) return null;
  if (!db) {
    // Neon pooler: disable prepared statements.
    client = postgres(env.DATABASE_URL, {
      max: 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: { search_path: env.DB_SCHEMA },
      onnotice: () => {},
    });
    db = drizzle(client, { schema });
  }
  return db;
}

export type DrizzleDb = NonNullable<ReturnType<typeof getDrizzle>>;
