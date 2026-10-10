import { shortDate } from '../lib/dates';
import { clamp01, defineModule, rangeDays } from './types';
import { loadReleases, loadUsageAnalysis, scopeClientName } from './usage';

function isoToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export default defineModule({
  id: 'usage_trend',
  async loader(ctx) {
    const [analysis, releases, clientName] = await Promise.all([
      loadUsageAnalysis(ctx),
      loadReleases(ctx),
      scopeClientName(ctx),
    ]);
    if (!analysis) return null;

    // Show the selected range plus 30 days of context so the baseline is visible.
    const days = Math.min(analysis.series.length, Math.max(60, rangeDays(ctx.scope) + 30));
    const series = analysis.series.slice(-days);
    const first = series[0]!.date;
    const last = series[series.length - 1]!.date;
    const change = Math.round(analysis.changePct);
    const direction = change < 0 ? 'Down' : 'Up';
    const summary = analysis.anomalyStart
      ? `${direction} ${Math.abs(change)}% vs the prior 4 weeks since ${shortDate(isoToDate(analysis.anomalyStart))}.`
      : Math.abs(change) < 3
        ? 'Flat vs the prior 4 weeks.'
        : `${direction} ${Math.abs(change)}% vs the prior 4 weeks.`;

    return {
      scopeLabel: `${clientName ?? 'All clients'}, last ${days} days`,
      series,
      changePct: change,
      anomalyStart: analysis.anomalyStart,
      releases: releases
        .filter((r) => r.date >= first && r.date <= last)
        .map((r) => ({ id: r.id, version: r.version, date: r.date })),
      summary,
    };
  },
  signal: (p) => clamp01(Math.abs(p.changePct ?? 0) / 40),
  evidence: (p) => {
    const lines: string[] = [];
    if (p.changePct !== null) {
      lines.push(
        `Usage ${p.changePct < 0 ? 'down' : 'up'} ${Math.abs(p.changePct)}% vs the prior 4 weeks` +
          (p.anomalyStart ? ` since ${shortDate(isoToDate(p.anomalyStart))}` : ''),
      );
    }
    const rel = p.anomalyStart
      ? [...p.releases].reverse().find((r) => r.date <= p.anomalyStart!)
      : null;
    if (rel) lines.push(`Release ${rel.version} shipped just before the change`);
    return lines;
  },
});
