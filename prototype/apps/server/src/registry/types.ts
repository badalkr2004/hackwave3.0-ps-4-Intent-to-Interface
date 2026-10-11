import type { ComponentId, PanelProps, Scope, Shape } from '@gestalt/shared';
import type { Db } from '../db/client';
import { addDays, toISODate } from '../lib/dates';

export interface LoadContext {
  // SPEC-NOTE: the spec passes `sql`; loaders get a schema-bound Db so every table reference is
  // schema-qualified (the Neon pooler ignores the connection-level search_path).
  db: Db;
  scope: Scope;
  today: Date;
  /**
   * Clients visible to the active organization. `null` means unrestricted (auth off / legacy).
   * Empty array means the org has no linked clients — loaders must return no portfolio data.
   */
  allowedClientIds: readonly string[] | null;
  /** Active organization for tenant-scoped loaders (sales, MOM). Null when auth is off. */
  organizationId: string | null;
  /** Signed-in user — connectors (Jira) are per-user. Null when auth is off. */
  userId: string | null;
  /** Memoizes shared sub-queries (e.g. usage analysis) across loaders within one loadAll call. */
  once<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** Another module's props for the same scope (memoized), e.g. for deferred panels' digests. */
  load<K extends ComponentId>(id: K): Promise<PanelProps<K> | null>;
}

/**
 * Client ids a loader may read: the scoped client (if allowed), else the org allow-list,
 * else `null` for unrestricted access.
 */
export function effectiveClientIds(ctx: LoadContext): readonly string[] | null {
  if (ctx.scope.clientId) {
    if (ctx.allowedClientIds && !ctx.allowedClientIds.includes(ctx.scope.clientId)) return [];
    return [ctx.scope.clientId];
  }
  return ctx.allowedClientIds;
}

export interface RegistryModule<K extends ComponentId = ComponentId> {
  id: K;
  /** Returns null when there is no data for the scope (auction excludes it as no_data). */
  loader: (ctx: LoadContext) => Promise<PanelProps<K> | null>;
  /**
   * 0..1: how much the data deserves attention. Deferred modules read their source data through
   * `ctx`, because their props are generated copy rather than measurements.
   */
  signal: (props: PanelProps<K>, ctx: LoadContext) => number | Promise<number>;
  /** 1-3 human-readable receipt strings. */
  evidence: (props: PanelProps<K>) => string[];
  /** Optional shape-specific props (applied at bind time, so loaded scope data stays shape-agnostic). */
  forShape?: (props: PanelProps<K>, shape: Shape) => PanelProps<K>;
}

export function defineModule<K extends ComponentId>(m: RegistryModule<K>): RegistryModule<K> {
  return m;
}

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** `YYYY-MM-DD` for today + n days. */
export function dayOf(ctx: Pick<LoadContext, 'today'>, n: number): string {
  return toISODate(addDays(ctx.today, n));
}

export function rangeDays(scope: Scope): number {
  return scope.timeRange === '7d' ? 7 : scope.timeRange === '90d' ? 90 : 30;
}

export function pctText(pct: number): string {
  return `${pct < 0 ? 'down' : 'up'} ${Math.abs(Math.round(pct))}%`;
}
