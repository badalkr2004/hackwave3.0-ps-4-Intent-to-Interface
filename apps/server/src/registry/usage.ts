import { isWeekend } from '../lib/dates';
import { dayOf, type LoadContext } from './types';

export interface UsagePoint {
  date: string;
  value: number;
}

export interface UsageAnalysis {
  /** Daily totals for the last 90 days (oldest first) with a weekday-adjusted baseline. */
  series: { date: string; value: number; baseline: number }[];
  changePct: number;
  /** First day of a sustained drop, or null if there is none. */
  anomalyStart: string | null;
  /** Comparison windows used for changePct (inclusive `YYYY-MM-DD` bounds). */
  pre: [string, string];
  post: [string, string];
}

const REFERENCE_DAYS = 28;
const POST_DAYS = 7;
const DROP_RATIO = 0.97;
const MIN_RUN_DAYS = 5;
const MIN_DROP_PCT = -10;

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Finds a sustained drop and measures it as the current run rate (last 7 days) against the 4 weeks
 * before the drop started. Pure and deterministic.
 */
export function analyzeUsage(points: UsagePoint[]): UsageAnalysis | null {
  const n = points.length;
  if (n < REFERENCE_DAYS + 2 * POST_DAYS) return null;

  const ref = points.slice(0, REFERENCE_DAYS);
  const refMean = (weekend: boolean) =>
    mean(ref.filter((p) => isWeekend(parseIso(p.date)) === weekend).map((p) => p.value)) || 1;
  const weekdayRef = refMean(false);
  const weekendRef = refMean(true);
  const baselineOf = (p: UsagePoint) => (isWeekend(parseIso(p.date)) ? weekendRef : weekdayRef);

  const series = points.map((p) => ({
    date: p.date,
    value: p.value,
    baseline: Math.round(baselineOf(p)),
  }));
  const ratio = points.map((p) => p.value / baselineOf(p));

  let start = n;
  while (start - 1 >= REFERENCE_DAYS && ratio[start - 1]! < DROP_RATIO) start--;

  const postValues = points.slice(n - POST_DAYS).map((p) => p.value);
  const post: [string, string] = [points[n - POST_DAYS]!.date, points[n - 1]!.date];

  if (n - start >= MIN_RUN_DAYS && start - REFERENCE_DAYS >= 0) {
    const preSlice = points.slice(start - REFERENCE_DAYS, start);
    const changePct = (mean(postValues) / mean(preSlice.map((p) => p.value)) - 1) * 100;
    if (changePct <= MIN_DROP_PCT) {
      return {
        series,
        changePct,
        anomalyStart: points[start]!.date,
        pre: [preSlice[0]!.date, preSlice[preSlice.length - 1]!.date],
        post,
      };
    }
  }

  const preSlice = points.slice(n - POST_DAYS - REFERENCE_DAYS, n - POST_DAYS);
  return {
    series,
    changePct: (mean(postValues) / mean(preSlice.map((p) => p.value)) - 1) * 100,
    anomalyStart: null,
    pre: [preSlice[0]!.date, preSlice[preSlice.length - 1]!.date],
    post,
  };
}

/** Per-client and portfolio-wide usage analyses from one query, memoized per load. */
export function loadUsageAnalyses(
  ctx: LoadContext,
): Promise<{ byClient: Map<string, UsageAnalysis>; portfolio: UsageAnalysis | null }> {
  return ctx.once('usage:all', async () => {
    const { db } = ctx;
    const rows = await db.sql<{ client_id: string; date: string; value: number }[]>`
      SELECT client_id, to_char(date, 'YYYY-MM-DD') AS date, value
      FROM ${db.table('usage_daily')}
      WHERE dimension = 'total' AND date BETWEEN ${dayOf(ctx, -90)} AND ${dayOf(ctx, -1)}
      ORDER BY client_id, date`;

    const perClient = new Map<string, UsagePoint[]>();
    const totals = new Map<string, number>();
    for (const r of rows) {
      const list = perClient.get(r.client_id) ?? [];
      list.push({ date: r.date, value: r.value });
      perClient.set(r.client_id, list);
      totals.set(r.date, (totals.get(r.date) ?? 0) + r.value);
    }
    const byClient = new Map<string, UsageAnalysis>();
    for (const [id, points] of perClient) {
      const a = analyzeUsage(points);
      if (a) byClient.set(id, a);
    }
    const portfolioPoints = [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
    return { byClient, portfolio: analyzeUsage(portfolioPoints) };
  });
}

/** Usage analysis for the scope's client, or the whole portfolio when no client is in scope. */
export async function loadUsageAnalysis(ctx: LoadContext): Promise<UsageAnalysis | null> {
  const all = await loadUsageAnalyses(ctx);
  return ctx.scope.clientId ? (all.byClient.get(ctx.scope.clientId) ?? null) : all.portfolio;
}

export interface ClientRow {
  id: string;
  name: string;
  plan: string;
  arr: number;
  health: number;
}

export function loadClients(ctx: LoadContext): Promise<ClientRow[]> {
  return ctx.once('clients', async () => {
    const { db } = ctx;
    return db.sql<ClientRow[]>`
      SELECT id, name, plan, arr, health FROM ${db.table('clients')} ORDER BY health, id`;
  });
}

export async function scopeClientName(ctx: LoadContext): Promise<string | null> {
  if (!ctx.scope.clientId) return null;
  const clients = await loadClients(ctx);
  return clients.find((c) => c.id === ctx.scope.clientId)?.name ?? null;
}

export interface ReleaseRow {
  id: string;
  version: string;
  date: string;
  notes: string | null;
  features: string[];
}

export function loadReleases(ctx: LoadContext): Promise<ReleaseRow[]> {
  return ctx.once('releases', async () => {
    const { db } = ctx;
    return db.sql<ReleaseRow[]>`
      SELECT id, version, to_char(date, 'YYYY-MM-DD') AS date, notes, features
      FROM ${db.table('releases')}
      ORDER BY date`;
  });
}

/** The release that shipped 0-3 days before the anomaly started, if any. */
export function correlatedRelease(
  releases: ReleaseRow[],
  anomalyStart: string | null,
): ReleaseRow | null {
  if (!anomalyStart) return null;
  const start = parseIso(anomalyStart).getTime();
  const candidates = releases.filter((r) => {
    const days = Math.round((start - parseIso(r.date).getTime()) / 86_400_000);
    return days >= 0 && days <= 3;
  });
  return candidates[candidates.length - 1] ?? null;
}

export function daysBetween(fromIso: string, to: Date): number {
  return Math.round((to.getTime() - parseIso(fromIso).getTime()) / 86_400_000);
}
