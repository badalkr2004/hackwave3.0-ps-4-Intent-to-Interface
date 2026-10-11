import { capabilitiesFor } from '../services/accessPolicy';
import { dayOf, defineModule, effectiveClientIds } from './types';

const OPEN = new Set(['lead', 'qualified', 'proposal', 'negotiation']);

export default defineModule({
  id: 'sales_pulse',
  async loader(ctx) {
    if (!capabilitiesFor(ctx.accessRole).sales) return null;
    if (!ctx.organizationId) return null;
    const allowed = effectiveClientIds(ctx);
    if (allowed && allowed.length === 0) return null;

    const { db } = ctx;
    const { sql } = db;
    const sch = sql(db.schema);

    const opps = await sql<
      {
        client_id: string;
        client_name: string;
        stage: string;
        amount: number;
        probability: number;
        closed_at: string | null;
      }[]
    >`
      SELECT o.client_id, c.name AS client_name, o.stage, o.amount::float8 AS amount,
        o.probability::float8 AS probability, to_char(o.closed_at, 'YYYY-MM-DD') AS closed_at
      FROM ${sch}.sales_opportunity o
      JOIN ${db.table('clients')} c ON c.id = o.client_id
      WHERE o.organization_id = ${ctx.organizationId}
        ${allowed ? sql`AND o.client_id = ANY(${[...allowed]})` : sql``}`;

    if (opps.length === 0) return null;

    const open = opps.filter((o) => OPEN.has(o.stage));
    const pipelineValue = open.reduce((s, o) => s + o.amount, 0);
    const weightedForecast = open.reduce((s, o) => s + o.amount * o.probability, 0);
    const won = opps.filter((o) => o.stage === 'won');
    const lost = opps.filter((o) => o.stage === 'lost');
    const decided = won.length + lost.length;
    const winRate = decided ? won.length / decided : 0;

    const byClient = new Map<string, { name: string; pipeline: number }>();
    for (const o of open) {
      const cur = byClient.get(o.client_id) ?? { name: o.client_name, pipeline: 0 };
      cur.pipeline += o.amount;
      byClient.set(o.client_id, cur);
    }
    const top = [...byClient.entries()].sort((a, b) => b[1].pipeline - a[1].pipeline)[0];
    const topClientShare =
      top && pipelineValue > 0 ? top[1].pipeline / pipelineValue : 0;

    const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation'];
    const byStage = stageOrder.map((stage) => ({
      stage,
      amount: open.filter((o) => o.stage === stage).reduce((s, o) => s + o.amount, 0),
    }));

    const from = dayOf(ctx, -56);
    const weekly = await sql<{ week: string; leads: number; spend: number }[]>`
      SELECT to_char(date_trunc('week', d.date), 'YYYY-MM-DD') AS week,
        COALESCE(SUM(d.leads), 0)::float8 AS leads,
        COALESCE(SUM(d.spend), 0)::float8 AS spend
      FROM ${sch}.marketing_channel_daily d
      WHERE d.organization_id = ${ctx.organizationId}
        AND d.date >= ${from}::date
      GROUP BY 1
      ORDER BY 1`;

    const insight =
      top && topClientShare >= 0.3
        ? `${top[1].name} holds ${Math.round(topClientShare * 100)}% of open pipeline.`
        : `${open.length} open deals · ${formatShortMoney(pipelineValue)} pipeline.`;

    return {
      pipelineValue,
      weightedForecast,
      winRate,
      openDeals: open.length,
      topClientName: top?.[1].name ?? null,
      topClientShare,
      byStage,
      trend: weekly.map((w) => ({
        week: w.week,
        leads: w.leads,
        spend: w.spend,
      })),
      preferredChart: 'bars' as const,
      insight,
    };
  },
  signal: (p) => (p.openDeals === 0 ? 0 : Math.min(1, 0.4 + p.topClientShare * 0.4)),
  evidence: (p) => [
    p.insight,
    `Win rate ${Math.round(p.winRate * 100)}% · forecast ${formatShortMoney(p.weightedForecast)}`,
  ],
});

function formatShortMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
