import { getDb } from '../db/client';
import { addDays, startOfDay, toISODate } from '../lib/dates';
import { clientIdsForOrg, requireMember } from './orgs';

export type AnalyticsRange = '30d' | '90d' | 'ytd';

export interface AnalyticsReport {
  organizationId: string;
  range: AnalyticsRange;
  clientId: string | null;
  insight: string;
  kpis: {
    pipelineValue: number;
    weightedForecast: number;
    winRate: number;
    openDeals: number;
    campaignSpend: number;
    attributedRevenue: number;
    leads: number;
  };
  byStage: { stage: string; count: number; amount: number }[];
  byChannel: { channel: string; spend: number; leads: number; revenue: number }[];
  byClient: { clientId: string; clientName: string; pipeline: number; won: number }[];
  trend: { week: string; pipeline: number; leads: number; spend: number }[];
  winLoss: { reason: string; count: number; amount: number }[];
  funnel: { step: string; count: number }[];
  opportunities: {
    id: string;
    clientId: string;
    clientName: string;
    name: string;
    stage: string;
    amount: number;
    probability: number;
    owner: string | null;
    expectedClose: string | null;
    sourceChannel: string;
    lostReason: string | null;
  }[];
  campaigns: {
    id: string;
    name: string;
    channel: string;
    status: string;
    spend: number;
    leads: number;
    mqls: number;
    opportunities: number;
    revenueAttributed: number;
    clientId: string | null;
  }[];
}

const OPEN = new Set(['lead', 'qualified', 'proposal', 'negotiation']);

function rangeStart(range: AnalyticsRange, today: Date): Date {
  if (range === '30d') return addDays(today, -30);
  if (range === '90d') return addDays(today, -90);
  return new Date(today.getFullYear(), 0, 1);
}

function weekKey(d: Date): string {
  const start = addDays(d, -((d.getDay() + 6) % 7));
  return toISODate(startOfDay(start));
}

export async function buildAnalyticsReport(
  organizationId: string,
  userId: string,
  opts: { range?: AnalyticsRange; clientId?: string | null } = {},
): Promise<AnalyticsReport> {
  await requireMember(userId, organizationId);
  const story = getDb();
  if (!story) throw new Error('Database is not configured.');

  const range = opts.range ?? '90d';
  const today = startOfDay(new Date());
  const from = rangeStart(range, today);
  const fromIso = toISODate(from);
  let allowed = await clientIdsForOrg(organizationId);
  if (opts.clientId) {
    if (!allowed.includes(opts.clientId)) throw new Error('Client is not in this organization.');
    allowed = [opts.clientId];
  }
  if (allowed.length === 0) {
    return emptyReport(organizationId, range, opts.clientId ?? null);
  }

  const { sql } = story;
  const sch = sql(story.schema);
  const clients = await story.sql<{ id: string; name: string }[]>`
    SELECT id, name FROM ${story.table('clients')} WHERE id = ANY(${allowed})`;
  const nameById = new Map(clients.map((c) => [c.id, c.name]));

  const opps = await sql<
    {
      id: string;
      client_id: string;
      name: string;
      stage: string;
      amount: number;
      probability: number;
      owner: string | null;
      expected_close: string | null;
      closed_at: string | null;
      lost_reason: string | null;
      source_channel: string;
    }[]
  >`
    SELECT id, client_id, name, stage, amount::float8 AS amount, probability::float8 AS probability,
      owner, to_char(expected_close, 'YYYY-MM-DD') AS expected_close,
      to_char(closed_at, 'YYYY-MM-DD') AS closed_at, lost_reason, source_channel
    FROM ${sch}.sales_opportunity
    WHERE organization_id = ${organizationId}
      AND client_id = ANY(${allowed})`;

  const campaigns = await sql<
    {
      id: string;
      client_id: string | null;
      name: string;
      channel: string;
      status: string;
      spend: number;
      leads: number;
      mqls: number;
      opportunities: number;
      revenue_attributed: number;
    }[]
  >`
    SELECT id, client_id, name, channel, status, spend::float8 AS spend, leads, mqls, opportunities,
      revenue_attributed::float8 AS revenue_attributed
    FROM ${sch}.marketing_campaign
    WHERE organization_id = ${organizationId}
      AND (client_id IS NULL OR client_id = ANY(${allowed}))`;

  const daily = await sql<
    { date: string; channel: string; sessions: number; leads: number; spend: number }[]
  >`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, channel, sessions, leads, spend::float8 AS spend
    FROM ${sch}.marketing_channel_daily
    WHERE organization_id = ${organizationId} AND date >= ${fromIso}::date
    ORDER BY date`;

  const openOpps = opps.filter((o) => OPEN.has(o.stage));
  const closedInRange = opps.filter((o) => {
    if (!o.closed_at) return false;
    return o.closed_at >= fromIso;
  });
  const won = closedInRange.filter((o) => o.stage === 'won');
  const lost = closedInRange.filter((o) => o.stage === 'lost');
  const decided = won.length + lost.length;

  const pipelineValue = openOpps.reduce((s, o) => s + o.amount, 0);
  const weightedForecast = openOpps.reduce((s, o) => s + o.amount * o.probability, 0);
  const campaignSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const attributedRevenue = campaigns.reduce((s, c) => s + c.revenue_attributed, 0);
  const leads = campaigns.reduce((s, c) => s + c.leads, 0) || daily.reduce((s, d) => s + d.leads, 0);

  const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const byStage = stageOrder.map((stage) => {
    const rows = opps.filter((o) => o.stage === stage);
    return {
      stage,
      count: rows.length,
      amount: rows.reduce((s, o) => s + o.amount, 0),
    };
  });

  const channelMap = new Map<string, { spend: number; leads: number; revenue: number }>();
  for (const c of campaigns) {
    const cur = channelMap.get(c.channel) ?? { spend: 0, leads: 0, revenue: 0 };
    cur.spend += c.spend;
    cur.leads += c.leads;
    cur.revenue += c.revenue_attributed;
    channelMap.set(c.channel, cur);
  }
  const byChannel = [...channelMap.entries()]
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.spend - a.spend);

  const byClient = allowed.map((clientId) => {
    const clientOpps = opps.filter((o) => o.client_id === clientId);
    return {
      clientId,
      clientName: nameById.get(clientId) ?? clientId,
      pipeline: clientOpps.filter((o) => OPEN.has(o.stage)).reduce((s, o) => s + o.amount, 0),
      won: clientOpps.filter((o) => o.stage === 'won').reduce((s, o) => s + o.amount, 0),
    };
  });

  const weekMap = new Map<string, { pipeline: number; leads: number; spend: number }>();
  for (const d of daily) {
    const wk = weekKey(new Date(d.date + 'T12:00:00'));
    const cur = weekMap.get(wk) ?? { pipeline: 0, leads: 0, spend: 0 };
    cur.leads += d.leads;
    cur.spend += d.spend;
    weekMap.set(wk, cur);
  }
  // Snapshot open pipeline onto the latest week for a simple trend companion series.
  const weeks = [...weekMap.keys()].sort();
  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek) {
    const cur = weekMap.get(lastWeek)!;
    cur.pipeline = pipelineValue;
  }
  const trend = weeks.map((week) => ({ week, ...weekMap.get(week)! }));

  const reasonMap = new Map<string, { count: number; amount: number }>();
  for (const o of lost) {
    const reason = o.lost_reason || 'Unspecified';
    const cur = reasonMap.get(reason) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += o.amount;
    reasonMap.set(reason, cur);
  }
  const winLoss = [...reasonMap.entries()]
    .map(([reason, v]) => ({ reason, ...v }))
    .sort((a, b) => b.amount - a.amount);

  const funnel = [
    { step: 'Leads', count: leads },
    { step: 'MQLs', count: campaigns.reduce((s, c) => s + c.mqls, 0) },
    { step: 'Opportunities', count: opps.length },
    { step: 'Won', count: opps.filter((o) => o.stage === 'won').length },
  ];

  const topClient = [...byClient].sort((a, b) => b.pipeline - a.pipeline)[0];
  const share =
    topClient && pipelineValue > 0 ? Math.round((topClient.pipeline / pipelineValue) * 100) : 0;
  const winRate = decided ? won.length / decided : 0;
  const insight =
    topClient && share >= 30
      ? `${topClient.clientName} carries ${share}% of open pipeline` +
        (decided ? `; win rate is ${Math.round(winRate * 100)}% on ${decided} closed deals.` : '.')
      : decided
        ? `Win rate is ${Math.round(winRate * 100)}% across ${decided} closed deals in range; open pipeline is $${Math.round(pipelineValue / 1000)}k.`
        : `Open pipeline is $${Math.round(pipelineValue / 1000)}k across ${openOpps.length} active deals.`;

  return {
    organizationId,
    range,
    clientId: opts.clientId ?? null,
    insight,
    kpis: {
      pipelineValue,
      weightedForecast,
      winRate,
      openDeals: openOpps.length,
      campaignSpend,
      attributedRevenue,
      leads,
    },
    byStage,
    byChannel,
    byClient,
    trend,
    winLoss,
    funnel,
    opportunities: opps.map((o) => ({
      id: o.id,
      clientId: o.client_id,
      clientName: nameById.get(o.client_id) ?? o.client_id,
      name: o.name,
      stage: o.stage,
      amount: o.amount,
      probability: o.probability,
      owner: o.owner,
      expectedClose: o.expected_close,
      sourceChannel: o.source_channel,
      lostReason: o.lost_reason,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      status: c.status,
      spend: c.spend,
      leads: c.leads,
      mqls: c.mqls,
      opportunities: c.opportunities,
      revenueAttributed: c.revenue_attributed,
      clientId: c.client_id,
    })),
  };
}

function emptyReport(
  organizationId: string,
  range: AnalyticsRange,
  clientId: string | null,
): AnalyticsReport {
  return {
    organizationId,
    range,
    clientId,
    insight: 'No sales or marketing data linked to this organization yet.',
    kpis: {
      pipelineValue: 0,
      weightedForecast: 0,
      winRate: 0,
      openDeals: 0,
      campaignSpend: 0,
      attributedRevenue: 0,
      leads: 0,
    },
    byStage: [],
    byChannel: [],
    byClient: [],
    trend: [],
    winLoss: [],
    funnel: [],
    opportunities: [],
    campaigns: [],
  };
}
