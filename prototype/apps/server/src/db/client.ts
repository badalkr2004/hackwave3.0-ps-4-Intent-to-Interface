import postgres from 'postgres';
import { env } from '../env';

export type Sql = postgres.Sql;

export const TABLES = [
  'people',
  'clients',
  'releases',
  'usage_daily',
  'tickets',
  'communications',
  'meetings',
  'projects',
  'tasks',
] as const;
export type TableName = (typeof TABLES)[number];

export function createSql(url: string, schema: string): Sql {
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Poolers in transaction mode (e.g. Neon's -pooler endpoint) ignore this startup parameter,
    // so runtime queries must reference tables through Db.table() instead of relying on it.
    connection: { search_path: schema },
    onnotice: () => {},
  });
}

/** A client bound to one schema. Use `table()` for every table reference in a query. */
export class Db {
  constructor(
    readonly sql: Sql,
    readonly schema: string,
  ) {}

  /** Schema-qualified table identifier, e.g. "gestalt"."clients". */
  table(name: TableName) {
    return this.sql(`${this.schema}.${name}`);
  }
}

let shared: Db | null = null;

/** Shared app database, or null when DATABASE_URL is not configured. */
export function getDb(): Db | null {
  if (!env.DATABASE_URL) return null;
  shared ??= new Db(createSql(env.DATABASE_URL, env.DB_SCHEMA), env.DB_SCHEMA);
  return shared;
}
