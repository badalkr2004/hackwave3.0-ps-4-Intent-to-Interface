import type { ClientRef, ProjectRef } from '@gestalt/shared';
import type { Db } from '../db/client';
import { log } from '../log';

export interface Entities {
  clients: ClientRef[];
  projects: ProjectRef[];
  /** Most at-risk client; the default when a task needs a client and none is named. */
  lowestHealthClientId: string | null;
}

const EMPTY: Entities = { clients: [], projects: [], lowestHealthClientId: null };
const TTL_MS = 60_000;

type CacheKey = string;
const cache = new Map<CacheKey, { at: number; value: Promise<Entities> }>();

/** "Acme Corp" -> ["acme"]: the name without company suffixes, plus its first word. */
export function aliasesFor(name: string): string[] {
  const lower = name.toLowerCase();
  const bare = lower.replace(/\b(corp|corporation|inc|ltd|llc|co|group|labs?)\.?$/, '').trim();
  const first = lower.split(/\s+/)[0] ?? lower;
  return [...new Set([bare, first])].filter((a) => a && a !== lower);
}

/**
 * Loads clients/projects visible in the workspace.
 * When `allowedClientIds` is set, only those clients (and their projects) are returned.
 * An empty array yields an empty portfolio — never the global demo set.
 */
export function loadEntities(
  db: Db | null,
  allowedClientIds: readonly string[] | null = null,
): Promise<Entities> {
  if (!db) return Promise.resolve(EMPTY);
  if (allowedClientIds && allowedClientIds.length === 0) return Promise.resolve(EMPTY);

  const key = `${db.schema}:${allowedClientIds ? [...allowedClientIds].sort().join(',') : '*'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = (async () => {
    try {
      const clients = allowedClientIds
        ? await db.sql<{ id: string; name: string; health: number }[]>`
            SELECT id, name, health FROM ${db.table('clients')}
            WHERE id = ANY(${[...allowedClientIds]})
            ORDER BY name`
        : await db.sql<{ id: string; name: string; health: number }[]>`
            SELECT id, name, health FROM ${db.table('clients')} ORDER BY name`;

      const projects = allowedClientIds
        ? await db.sql<{ id: string; name: string; client_id: string | null }[]>`
            SELECT id, name, client_id FROM ${db.table('projects')}
            WHERE client_id = ANY(${[...allowedClientIds]})
            ORDER BY name`
        : await db.sql<{ id: string; name: string; client_id: string | null }[]>`
            SELECT id, name, client_id FROM ${db.table('projects')} ORDER BY name`;

      const lowest = [...clients].sort(
        (a, b) => a.health - b.health || a.id.localeCompare(b.id),
      )[0];
      return {
        clients: clients.map((c) => ({ id: c.id, name: c.name, aliases: aliasesFor(c.name) })),
        projects: projects.map((p) => ({ id: p.id, name: p.name, clientId: p.client_id })),
        lowestHealthClientId: lowest?.id ?? null,
      };
    } catch (err) {
      log.warn('Could not load entities', {
        error: err instanceof Error ? err.message : String(err),
      });
      cache.delete(key);
      return EMPTY;
    }
  })();
  cache.set(key, { at: Date.now(), value });
  return value;
}
