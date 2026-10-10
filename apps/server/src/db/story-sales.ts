import { addDays, toISODate } from '../lib/dates';
import { mulberry32 } from '../lib/prng';

/** Keep in sync with DEMO_TENANTS org ids in tenants.ts (avoid circular import). */
const ORG_NORTHWIND = 'org_northwind';
const ORG_HELIOS = 'org_helios';

export type OppStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type Channel =
  | 'email'
  | 'paid_search'
  | 'social'
  | 'event'
  | 'partner'
  | 'content'
  | 'referral';

export interface OpportunityRow {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  stage: OppStage;
  amount: number;
  probability: number;
  owner: string;
  expected_close: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  source_channel: Channel;
}

export interface CampaignRow {
  id: string;
  organization_id: string;
  client_id: string | null;
  name: string;
  channel: Exclude<Channel, 'referral'>;
  status: 'planned' | 'active' | 'completed';
  spend: number;
  leads: number;
  mqls: number;
  opportunities: number;
  revenue_attributed: number;
  started_at: string;
  ended_at: string | null;
}

export interface ChannelDailyRow {
  id: string;
  organization_id: string;
  date: string;
  channel: Exclude<Channel, 'referral'>;
  sessions: number;
  leads: number;
  spend: number;
}

export interface SalesStory {
  opportunities: OpportunityRow[];
  campaigns: CampaignRow[];
  channelDaily: ChannelDailyRow[];
}

function buildChannelDaily(
  orgId: string,
  today: Date,
  seed: number,
  weights: Record<Exclude<Channel, 'referral'>, { sessions: number; leads: number; spend: number }>,
): ChannelDailyRow[] {
  const rng = mulberry32(seed);
  const rows: ChannelDailyRow[] = [];
  const channels = Object.keys(weights) as Exclude<Channel, 'referral'>[];
  for (let d = -89; d <= -1; d++) {
    const date = toISODate(addDays(today, d));
    for (const channel of channels) {
      const w = weights[channel];
      const jitter = 0.85 + rng() * 0.3;
      rows.push({
        id: `mcd_${orgId.replace('org_', '')}_${date}_${channel}`,
        organization_id: orgId,
        date,
        channel,
        sessions: Math.round(w.sessions * jitter),
        leads: Math.max(0, Math.round(w.leads * jitter)),
        spend: Math.round(w.spend * jitter),
      });
    }
  }
  return rows;
}

/** Northwind: Acme risk + Globex expansion; email/event heavy. */
function northwindSales(today: Date): SalesStory {
  const day = (n: number) => toISODate(addDays(today, n));
  const org = ORG_NORTHWIND;

  const opportunities: OpportunityRow[] = [
    {
      id: 'opp_nw_acme_renew',
      organization_id: org,
      client_id: 'acme',
      name: 'Acme Enterprise renewal',
      stage: 'negotiation',
      amount: 480000,
      probability: 0.45,
      owner: 'Avery Chen',
      expected_close: day(40),
      closed_at: null,
      lost_reason: null,
      source_channel: 'referral',
    },
    {
      id: 'opp_nw_acme_export',
      organization_id: org,
      client_id: 'acme',
      name: 'Acme export add-on seats',
      stage: 'proposal',
      amount: 72000,
      probability: 0.35,
      owner: 'Maya Rao',
      expected_close: day(25),
      closed_at: null,
      lost_reason: null,
      source_channel: 'email',
    },
    {
      id: 'opp_nw_globex_analytics',
      organization_id: org,
      client_id: 'globex',
      name: 'Globex analytics module',
      stage: 'qualified',
      amount: 145000,
      probability: 0.55,
      owner: 'Avery Chen',
      expected_close: day(60),
      closed_at: null,
      lost_reason: null,
      source_channel: 'event',
    },
    {
      id: 'opp_nw_globex_won',
      organization_id: org,
      client_id: 'globex',
      name: 'Globex admin seat expansion',
      stage: 'won',
      amount: 36000,
      probability: 1,
      owner: 'Maya Rao',
      expected_close: day(-20),
      closed_at: day(-18),
      lost_reason: null,
      source_channel: 'email',
    },
    {
      id: 'opp_nw_initech_filters',
      organization_id: org,
      client_id: 'initech',
      name: 'Initech Growth uplift',
      stage: 'lead',
      amount: 28000,
      probability: 0.2,
      owner: 'Maya Rao',
      expected_close: day(80),
      closed_at: null,
      lost_reason: null,
      source_channel: 'content',
    },
    {
      id: 'opp_nw_umbrella_lost',
      organization_id: org,
      client_id: 'umbrella',
      name: 'Umbrella research pack',
      stage: 'lost',
      amount: 54000,
      probability: 0,
      owner: 'Avery Chen',
      expected_close: day(-30),
      closed_at: day(-28),
      lost_reason: 'Budget freeze',
      source_channel: 'event',
    },
    {
      id: 'opp_nw_umbrella_onboard',
      organization_id: org,
      client_id: 'umbrella',
      name: 'Umbrella lab manager seats',
      stage: 'proposal',
      amount: 42000,
      probability: 0.5,
      owner: 'Maya Rao',
      expected_close: day(35),
      closed_at: null,
      lost_reason: null,
      source_channel: 'partner',
    },
    {
      id: 'opp_nw_acme_lost_comp',
      organization_id: org,
      client_id: 'acme',
      name: 'Acme competitor displacement',
      stage: 'lost',
      amount: 90000,
      probability: 0,
      owner: 'Avery Chen',
      expected_close: day(-45),
      closed_at: day(-42),
      lost_reason: 'Chose competitor',
      source_channel: 'paid_search',
    },
  ];

  const campaigns: CampaignRow[] = [
    {
      id: 'camp_nw_q4_email',
      organization_id: org,
      client_id: null,
      name: 'Q4 renewal nurture',
      channel: 'email',
      status: 'active',
      spend: 12000,
      leads: 210,
      mqls: 68,
      opportunities: 9,
      revenue_attributed: 36000,
      started_at: day(-60),
      ended_at: null,
    },
    {
      id: 'camp_nw_summit',
      organization_id: org,
      client_id: 'globex',
      name: 'Customer summit booth',
      channel: 'event',
      status: 'completed',
      spend: 48000,
      leads: 140,
      mqls: 42,
      opportunities: 6,
      revenue_attributed: 145000,
      started_at: day(-50),
      ended_at: day(-40),
    },
    {
      id: 'camp_nw_content',
      organization_id: org,
      client_id: null,
      name: 'Export playbook content',
      channel: 'content',
      status: 'active',
      spend: 8000,
      leads: 95,
      mqls: 28,
      opportunities: 3,
      revenue_attributed: 0,
      started_at: day(-30),
      ended_at: null,
    },
    {
      id: 'camp_nw_partner',
      organization_id: org,
      client_id: 'umbrella',
      name: 'Lab ops partner webinar',
      channel: 'partner',
      status: 'completed',
      spend: 6000,
      leads: 55,
      mqls: 18,
      opportunities: 2,
      revenue_attributed: 0,
      started_at: day(-70),
      ended_at: day(-55),
    },
  ];

  return {
    opportunities,
    campaigns,
    channelDaily: buildChannelDaily(org, today, 11, {
      email: { sessions: 420, leads: 8, spend: 180 },
      paid_search: { sessions: 180, leads: 3, spend: 420 },
      social: { sessions: 260, leads: 2, spend: 90 },
      event: { sessions: 40, leads: 1, spend: 200 },
      partner: { sessions: 60, leads: 1, spend: 70 },
      content: { sessions: 310, leads: 4, spend: 50 },
    }),
  };
}

/** Helios: Vertex renewal risk + Oakmont expansion; partner/paid heavy. */
function heliosSales(today: Date): SalesStory {
  const day = (n: number) => toISODate(addDays(today, n));
  const org = ORG_HELIOS;

  const opportunities: OpportunityRow[] = [
    {
      id: 'opp_hx_vertex_renew',
      organization_id: org,
      client_id: 'vertex',
      name: 'Vertex Payments renewal',
      stage: 'negotiation',
      amount: 540000,
      probability: 0.4,
      owner: 'Samira Qureshi',
      expected_close: day(30),
      closed_at: null,
      lost_reason: null,
      source_channel: 'referral',
    },
    {
      id: 'opp_hx_vertex_risk',
      organization_id: org,
      client_id: 'vertex',
      name: 'Vertex advanced risk module',
      stage: 'proposal',
      amount: 120000,
      probability: 0.48,
      owner: 'Jordan Blake',
      expected_close: day(45),
      closed_at: null,
      lost_reason: null,
      source_channel: 'partner',
    },
    {
      id: 'opp_hx_oakmont_brands',
      organization_id: org,
      client_id: 'oakmont',
      name: 'Oakmont multi-brand rollup',
      stage: 'qualified',
      amount: 98000,
      probability: 0.6,
      owner: 'Jordan Blake',
      expected_close: day(55),
      closed_at: null,
      lost_reason: null,
      source_channel: 'event',
    },
    {
      id: 'opp_hx_oakmont_won',
      organization_id: org,
      client_id: 'oakmont',
      name: 'Oakmont analytics seats',
      stage: 'won',
      amount: 64000,
      probability: 1,
      owner: 'Nina Okonkwo',
      expected_close: day(-12),
      closed_at: day(-10),
      lost_reason: null,
      source_channel: 'paid_search',
    },
    {
      id: 'opp_hx_pulse_eu',
      organization_id: org,
      client_id: 'pulse',
      name: 'Pulse EU depot pilot',
      stage: 'proposal',
      amount: 88000,
      probability: 0.52,
      owner: 'Samira Qureshi',
      expected_close: day(20),
      closed_at: null,
      lost_reason: null,
      source_channel: 'content',
    },
    {
      id: 'opp_hx_pulse_lost',
      organization_id: org,
      client_id: 'pulse',
      name: 'Pulse Americas expansion',
      stage: 'lost',
      amount: 110000,
      probability: 0,
      owner: 'Jordan Blake',
      expected_close: day(-35),
      closed_at: day(-33),
      lost_reason: 'No decision / stalled',
      source_channel: 'social',
    },
    {
      id: 'opp_hx_vertex_lost_price',
      organization_id: org,
      client_id: 'vertex',
      name: 'Vertex fraud API bundle',
      stage: 'lost',
      amount: 75000,
      probability: 0,
      owner: 'Nina Okonkwo',
      expected_close: day(-50),
      closed_at: day(-48),
      lost_reason: 'Price',
      source_channel: 'paid_search',
    },
    {
      id: 'opp_hx_oakmont_lead',
      organization_id: org,
      client_id: 'oakmont',
      name: 'Oakmont lifestyle brands pack',
      stage: 'lead',
      amount: 52000,
      probability: 0.18,
      owner: 'Nina Okonkwo',
      expected_close: day(90),
      closed_at: null,
      lost_reason: null,
      source_channel: 'social',
    },
  ];

  const campaigns: CampaignRow[] = [
    {
      id: 'camp_hx_partner',
      organization_id: org,
      client_id: 'vertex',
      name: 'Risk partner co-sell',
      channel: 'partner',
      status: 'active',
      spend: 22000,
      leads: 76,
      mqls: 31,
      opportunities: 5,
      revenue_attributed: 0,
      started_at: day(-45),
      ended_at: null,
    },
    {
      id: 'camp_hx_paid',
      organization_id: org,
      client_id: null,
      name: 'Fintech paid search',
      channel: 'paid_search',
      status: 'active',
      spend: 38000,
      leads: 190,
      mqls: 54,
      opportunities: 8,
      revenue_attributed: 64000,
      started_at: day(-75),
      ended_at: null,
    },
    {
      id: 'camp_hx_social',
      organization_id: org,
      client_id: 'oakmont',
      name: 'Media brand ABM',
      channel: 'social',
      status: 'completed',
      spend: 15000,
      leads: 88,
      mqls: 24,
      opportunities: 4,
      revenue_attributed: 64000,
      started_at: day(-55),
      ended_at: day(-25),
    },
    {
      id: 'camp_hx_content',
      organization_id: org,
      client_id: 'pulse',
      name: 'Fleet ops field guide',
      channel: 'content',
      status: 'active',
      spend: 5000,
      leads: 62,
      mqls: 19,
      opportunities: 2,
      revenue_attributed: 0,
      started_at: day(-20),
      ended_at: null,
    },
  ];

  return {
    opportunities,
    campaigns,
    channelDaily: buildChannelDaily(org, today, 22, {
      email: { sessions: 220, leads: 3, spend: 60 },
      paid_search: { sessions: 520, leads: 9, spend: 640 },
      social: { sessions: 340, leads: 4, spend: 210 },
      event: { sessions: 30, leads: 1, spend: 150 },
      partner: { sessions: 90, leads: 3, spend: 280 },
      content: { sessions: 250, leads: 3, spend: 40 },
    }),
  };
}

export function buildSalesStory(today: Date): SalesStory {
  const a = northwindSales(today);
  const b = heliosSales(today);
  return {
    opportunities: [...a.opportunities, ...b.opportunities],
    campaigns: [...a.campaigns, ...b.campaigns],
    channelDaily: [...a.channelDaily, ...b.channelDaily],
  };
}
