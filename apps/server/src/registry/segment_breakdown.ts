import { clamp01, defineModule } from './types';
import { loadUsageAnalysis } from './usage';

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default defineModule({
  id: 'segment_breakdown',
  async loader(ctx) {
    const clientId = ctx.scope.clientId;
    if (!clientId) return null;
    const analysis = await loadUsageAnalysis(ctx);
    if (!analysis) return null;
    const { db } = ctx;
    const rows = await db.sql<
      {
        dimension: 'feature' | 'team';
        segment: string;
        before: number | null;
        after: number | null;
      }[]
    >`
      SELECT dimension, segment,
        avg(value) FILTER (WHERE date BETWEEN ${analysis.pre[0]} AND ${analysis.pre[1]})::float8 AS before,
        avg(value) FILTER (WHERE date BETWEEN ${analysis.post[0]} AND ${analysis.post[1]})::float8 AS after
      FROM ${db.table('usage_daily')}
      WHERE client_id = ${clientId} AND dimension IN ('feature', 'team')
        AND date BETWEEN ${analysis.pre[0]} AND ${analysis.post[1]}
      GROUP BY dimension, segment
      ORDER BY dimension, segment`;

    const groups = (['feature', 'team'] as const).map((dimension) => ({
      dimension,
      label: dimension === 'feature' ? 'Feature' : 'Team',
      segments: rows
        .filter((r) => r.dimension === dimension && r.before && r.after !== null)
        .map((r) => ({
          id: `seg:${dimension}:${r.segment}`,
          label: label(r.segment),
          deltaPct: Math.round((r.after! / r.before! - 1) * 100),
          before: Math.round(r.before!),
          after: Math.round(r.after!),
        }))
        .sort((a, b) => a.deltaPct - b.deltaPct || a.id.localeCompare(b.id)),
    }));
    if (groups.every((g) => g.segments.length === 0)) return null;

    const worst = (d: 'feature' | 'team') => groups.find((g) => g.dimension === d)?.segments[0];
    const wf = worst('feature');
    const wt = worst('team');
    const summary =
      analysis.changePct < -5 && wf && wt
        ? `The drop is concentrated in ${wf.label.toLowerCase()} and the ${wt.label.toLowerCase()} team.`
        : 'No segment stands out from the overall trend.';
    return { groups, summary };
  },
  signal: (p) => {
    const deltas = p.groups.flatMap((g) => g.segments.map((s) => s.deltaPct));
    if (deltas.length < 2) return 0;
    return clamp01((Math.max(...deltas) - Math.min(...deltas)) / 50);
  },
  evidence: (p) =>
    p.groups
      .map((g) => g.segments[0])
      .filter((s): s is NonNullable<typeof s> => !!s && s.deltaPct < 0)
      .map((s) => `${s.label} ${s.deltaPct < 0 ? 'down' : 'up'} ${Math.abs(s.deltaPct)}%`),
});
