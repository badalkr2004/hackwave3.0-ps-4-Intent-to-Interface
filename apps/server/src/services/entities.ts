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
let cached: { db: Db; at: number; value: Promise<Entities> } | null = null;

/** "Acme Corp" -> ["acme"]: the name without company suffixes, plus its first word. */
export function aliasesFor(name: string): string[] {
  const lower = name.toLowerCase();
  const bare = lower.replace(/\b(corp|corporation|inc|ltd|llc|co|group|labs?)\.?$/, '').trim();
  const first = lower.split(/\s+/)[0] ?? lower;
  return [...new Set([bare, first])].filter((a) => a && a !== lower);
}

export function loadEntities(db: Db | null): Promise<Entities> {
  if (!db) return Promise.resolve(EMPTY);
  if (cached && cached.db === db && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = (async () => {
    try {
      const [clients, projects] = await Promise.all([
        db.sql<{ id: string; name: string; health: number }[]>`
          SELECT id, name, health FROM ${db.table('clients')} ORDER BY name`,
        db.sql<{ id: string; name: string; client_id: string | null }[]>`
          SELECT id, name, client_id FROM ${db.table('projects')} ORDER BY name`,
      ]);
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
      cached = null;
      return EMPTY;
    }
  })();
  cached = { db, at: Date.now(), value };
  return value;
}
