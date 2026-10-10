import { addDays, atTime, shortDate, toISODate } from '../lib/dates';
import {
  buildUsage,
  type ClientRow,
  type CommunicationRow,
  type MeetingRow,
  type PersonRow,
  type ProjectRow,
  type Story,
  type TaskRow,
  type TicketRow,
  type UsageProfile,
  type UsageRow,
} from './story';

/**
 * Helios Account Management portfolio — distinct clients from Northwind so
 * org-scoped dashboards never share Acme/Globex/etc.
 */
export const HELIOS_CLIENT_IDS = ['vertex', 'oakmont', 'pulse'] as const;

const HELIOS_USAGE: readonly UsageProfile[] = [
  {
    clientId: 'vertex',
    weekday: 380,
    weekend: 95,
    finalLevel: 0.7,
    driftPer60d: 0.04,
    features: {
      dashboards: [0.35, 0.9],
      export: [0.4, 0.55],
      alerts: [0.25, 0.75],
    },
    teams: {
      risk: [0.45, 0.6],
      ops: [0.35, 0.8],
      sales: [0.2, 0.95],
    },
  },
  {
    clientId: 'oakmont',
    weekday: 510,
    weekend: 140,
    finalLevel: 1,
    driftPer60d: 0,
    features: {
      dashboards: [0.5, 1],
      export: [0.3, 1],
      alerts: [0.2, 1],
    },
    teams: {
      editorial: [0.4, 1],
      ads: [0.35, 1],
      product: [0.25, 1],
    },
  },
  {
    clientId: 'pulse',
    weekday: 260,
    weekend: 70,
    finalLevel: 0.92,
    driftPer60d: -0.03,
    features: {
      dashboards: [0.45, 1],
      export: [0.25, 0.9],
      alerts: [0.3, 1],
    },
    teams: {
      field: [0.5, 0.95],
      engineering: [0.3, 1],
      support: [0.2, 0.85],
    },
  },
];

export function buildHeliosStory(today: Date): Omit<Story, 'releases'> & { usage: UsageRow[] } {
  const day = (n: number) => toISODate(addDays(today, n));
  const at = (n: number, h: number, m = 0) => atTime(addDays(today, n), h, m);

  const people: PersonRow[] = [
    { id: 'jordan', name: 'Jordan Blake', role: 'Account director', capacity_pct: 95 },
    { id: 'nina', name: 'Nina Okonkwo', role: 'Customer success manager', capacity_pct: 110 },
    { id: 'caleb', name: 'Caleb Ng', role: 'Solutions engineer', capacity_pct: 125 },
    { id: 'renee', name: 'Renee Soto', role: 'Support lead', capacity_pct: 90 },
  ];

  const clients: ClientRow[] = [
    {
      id: 'vertex',
      name: 'Vertex Payments',
      plan: 'Enterprise',
      arr: 540000,
      health: 58,
      csm_id: 'nina',
      renewal_date: day(48),
      contact_name: 'Elena Vargas',
      contact_title: 'VP Risk',
    },
    {
      id: 'oakmont',
      name: 'Oakmont Media',
      plan: 'Enterprise',
      arr: 710000,
      health: 91,
      csm_id: 'jordan',
      renewal_date: day(190),
      contact_name: 'Marcus Hale',
      contact_title: 'COO',
    },
    {
      id: 'pulse',
      name: 'Pulse Robotics',
      plan: 'Growth',
      arr: 180000,
      health: 76,
      csm_id: 'nina',
      renewal_date: day(125),
      contact_name: 'Sora Kim',
      contact_title: 'Head of Field Ops',
    },
  ];

  const tickets: TicketRow[] = [
    {
      id: 'H-T1',
      client_id: 'vertex',
      title: 'Fraud alert latency above SLA',
      status: 'open',
      priority: 'high',
      created: at(-12, 8, 20),
      updated: at(-1, 16, 40),
      tags: ['alerts', 'sla'],
      summary:
        'Risk alerts arrive 4–7 minutes late during peak authorizations; SLA is 90 seconds.',
    },
    {
      id: 'H-T2',
      client_id: 'vertex',
      title: 'Settlement export missing merchant IDs',
      status: 'open',
      priority: 'high',
      created: at(-9, 11, 0),
      updated: at(-2, 9, 15),
      tags: ['export', 'billing'],
      summary: 'Daily settlement CSV omits merchant_id for ~12% of rows since last deploy.',
    },
    {
      id: 'H-T3',
      client_id: 'vertex',
      title: 'Sandbox webhook retries storm',
      status: 'open',
      priority: 'medium',
      created: at(-6, 14, 30),
      updated: at(-4, 10, 0),
      tags: ['integrations'],
      summary: 'Test webhooks retry aggressively and flood their staging queue.',
    },
    {
      id: 'H-T4',
      client_id: 'oakmont',
      title: 'Request: brand-level dashboard rollup',
      status: 'open',
      priority: 'low',
      created: at(-15, 10, 0),
      updated: at(-10, 11, 0),
      tags: ['dashboards', 'feature'],
      summary: 'Want a parent view across five publication brands for the weekly exec pack.',
    },
    {
      id: 'H-T5',
      client_id: 'oakmont',
      title: 'Ad ops SSO group mapping',
      status: 'closed',
      priority: 'medium',
      created: at(-28, 9, 0),
      updated: at(-20, 15, 0),
      tags: ['sso'],
      summary: 'Mapped Okta groups for ad ops editors; confirmed in production.',
    },
    {
      id: 'H-T6',
      client_id: 'pulse',
      title: 'Field alert false positives on battery',
      status: 'open',
      priority: 'medium',
      created: at(-8, 7, 45),
      updated: at(-3, 13, 0),
      tags: ['alerts', 'hardware'],
      summary: 'Battery-low alerts fire when robots are on chargers overnight.',
    },
    {
      id: 'H-T7',
      client_id: 'pulse',
      title: 'Fleet export truncates serial numbers',
      status: 'open',
      priority: 'high',
      created: at(-5, 16, 0),
      updated: at(-1, 11, 20),
      tags: ['export'],
      summary: 'CSV serial column truncates after 12 characters for newer hardware SKUs.',
    },
  ];

  const communications: CommunicationRow[] = [
    {
      id: 'h-c1',
      client_id: 'vertex',
      channel: 'email',
      date: at(-1, 9, 5),
      direction: 'inbound',
      sender: 'Elena Vargas',
      subject: 'SLA breach — fraud alerts',
      snippet:
        'We breached our internal risk SLA twice this week because alerts arrived late. Need a written plan before renewal talks.',
      sentiment: -0.75,
    },
    {
      id: 'h-c2',
      client_id: 'vertex',
      channel: 'slack',
      date: at(-2, 14, 10),
      direction: 'outbound',
      sender: 'Nina Okonkwo',
      subject: null,
      snippet:
        'Acknowledged the alert latency. Caleb is profiling the peak-hour queue; I will send interim mitigations today.',
      sentiment: 0.05,
    },
    {
      id: 'h-c3',
      client_id: 'vertex',
      channel: 'email',
      date: at(-7, 11, 30),
      direction: 'inbound',
      sender: 'Elena Vargas',
      subject: 'Settlement file gaps',
      snippet:
        'Finance cannot close Tuesday’s book — merchant IDs missing again on the settlement export.',
      sentiment: -0.55,
    },
    {
      id: 'h-c4',
      client_id: 'vertex',
      channel: 'email',
      date: at(-18, 10, 0),
      direction: 'outbound',
      sender: 'Jordan Blake',
      subject: 'Renewal prep + risk module upsell',
      snippet:
        'Sharing a draft renewal proposal with optional advanced risk scoring. Happy to walk through numbers next week.',
      sentiment: 0.25,
    },
    {
      id: 'h-c5',
      client_id: 'oakmont',
      channel: 'email',
      date: at(-3, 8, 40),
      direction: 'inbound',
      sender: 'Marcus Hale',
      subject: 'QBR agenda — expansion brands',
      snippet:
        'Please add the two new lifestyle brands to the QBR deck. Also send the MSA amendment for analytics seats.',
      sentiment: 0.45,
    },
    {
      id: 'h-c6',
      client_id: 'oakmont',
      channel: 'email',
      date: at(-11, 15, 0),
      direction: 'outbound',
      sender: 'Jordan Blake',
      subject: 'Contract pack + SOP links',
      snippet:
        'Attached: executed order form, data processing addendum, and the editorial publishing SOP your team asked for.',
      sentiment: 0.5,
    },
    {
      id: 'h-c7',
      client_id: 'oakmont',
      channel: 'slack',
      date: at(-16, 12, 20),
      direction: 'inbound',
      sender: 'Marcus Hale',
      subject: null,
      snippet: 'Love the faster dashboards. Ads team wants the brand rollup before the board meeting.',
      sentiment: 0.55,
    },
    {
      id: 'h-c8',
      client_id: 'pulse',
      channel: 'email',
      date: at(-2, 17, 15),
      direction: 'inbound',
      sender: 'Sora Kim',
      subject: 'Serial truncation blocking RMA',
      snippet:
        'RMA intake is blocked because fleet export truncates serials. Warehouse cannot match units.',
      sentiment: -0.6,
    },
    {
      id: 'h-c9',
      client_id: 'pulse',
      channel: 'email',
      date: at(-9, 9, 50),
      direction: 'outbound',
      sender: 'Nina Okonkwo',
      subject: 'Battery alert tuning proposal',
      snippet:
        'Proposing a charger-aware suppress window for overnight docks. Draft change note attached for your SE review.',
      sentiment: 0.2,
    },
    {
      id: 'h-c10',
      client_id: 'pulse',
      channel: 'email',
      date: at(-22, 13, 0),
      direction: 'inbound',
      sender: 'Sora Kim',
      subject: 'Pilot quotation for EU depots',
      snippet:
        'Please send a quotation for 40 additional seats across Berlin and Lyon depots — pilot starts next quarter.',
      sentiment: 0.35,
    },
  ];

  const meetings: MeetingRow[] = [
    {
      id: 'h-m1',
      client_id: 'vertex',
      date: at(-21, 10, 0),
      kind: 'qbr',
      title: 'Vertex Q3 risk review',
      notes:
        'Reviewed authorization volume growth and alert precision. ' +
        'Elena flagged SLA risk if latency stays high into renewal. ' +
        'Discussed proposal for advanced risk scoring upsell. ' +
        'Commitment: share settlement export RCA and interim runbook. ' +
        'Documents referenced: MSA 2024, risk SLA exhibit, draft renewal quote.',
      commitments: [
        {
          id: 'h-m1-1',
          text: `Publish settlement export RCA by ${shortDate(addDays(today, -7))}`,
          status: 'missed',
          due: day(-7),
        },
        {
          id: 'h-m1-2',
          text: 'Deliver interim alert latency mitigations',
          status: 'open',
          due: day(3),
        },
        {
          id: 'h-m1-3',
          text: 'Send renewal proposal with risk module option',
          status: 'done',
          due: day(-14),
        },
      ],
    },
    {
      id: 'h-m2',
      client_id: 'vertex',
      date: at(2, 15, 0),
      kind: 'renewal',
      title: 'Vertex renewal working session',
      notes: null,
      commitments: [],
    },
    {
      id: 'h-m3',
      client_id: 'oakmont',
      date: at(4, 11, 0),
      kind: 'qbr',
      title: 'Oakmont exec QBR',
      notes: null,
      commitments: [],
    },
    {
      id: 'h-m4',
      client_id: 'pulse',
      date: at(-14, 9, 30),
      kind: 'sync',
      title: 'Pulse fleet ops sync',
      notes:
        'Covered false battery alerts and EU depot expansion quote. ' +
        'Sora needs serial export fix before RMA season. ' +
        'Shared field SOP v3 and pending quotation NW-440.',
      commitments: [
        {
          id: 'h-m4-1',
          text: 'Ship serial number export fix',
          status: 'open',
          due: day(2),
        },
        {
          id: 'h-m4-2',
          text: 'Issue EU depot pilot quotation',
          status: 'open',
          due: day(5),
        },
      ],
    },
    {
      id: 'h-m5',
      client_id: 'pulse',
      date: at(6, 14, 0),
      kind: 'sync',
      title: 'Pulse EU pilot kickoff',
      notes: null,
      commitments: [],
    },
  ];

  const projects: ProjectRow[] = [
    {
      id: 'proj-vertex-alerts',
      name: 'Vertex alert latency hotfix',
      client_id: 'vertex',
      owner_id: 'caleb',
    },
    {
      id: 'proj-oakmont-rollup',
      name: 'Oakmont brand rollup',
      client_id: 'oakmont',
      owner_id: 'jordan',
    },
    {
      id: 'proj-pulse-fleet',
      name: 'Pulse fleet export & alerts',
      client_id: 'pulse',
      owner_id: 'nina',
    },
  ];

  const t = (
    id: string,
    project_id: string,
    title: string,
    owner_id: string,
    dueIn: number,
    status: TaskRow['status'],
    estimate_h: number,
    depends_on: string[] = [],
  ): TaskRow => ({
    id,
    project_id,
    title,
    owner_id,
    due: day(dueIn),
    status,
    depends_on,
    estimate_h,
  });

  const tasks: TaskRow[] = [
    t('HV1', 'proj-vertex-alerts', 'Profile peak-hour alert queue', 'caleb', -4, 'done', 6),
    t('HV2', 'proj-vertex-alerts', 'Shard fraud alert workers', 'caleb', -1, 'in_progress', 10),
    t('HV3', 'proj-vertex-alerts', 'Hotfix settlement merchant_id', 'caleb', 1, 'todo', 5, ['HV2']),
    t('HV4', 'proj-vertex-alerts', 'Write Vertex interim runbook', 'nina', 2, 'todo', 3),
    t('HV5', 'proj-vertex-alerts', 'Load test alert pipeline', 'renee', 4, 'todo', 6, ['HV2']),

    t('HO1', 'proj-oakmont-rollup', 'Brand hierarchy data model', 'jordan', -6, 'done', 4),
    t('HO2', 'proj-oakmont-rollup', 'Exec rollup dashboard prototype', 'caleb', 3, 'in_progress', 8),
    t('HO3', 'proj-oakmont-rollup', 'QBR deck with new brands', 'jordan', 3, 'todo', 4),
    t('HO4', 'proj-oakmont-rollup', 'MSA amendment for analytics seats', 'nina', 7, 'todo', 2),

    t('HP1', 'proj-pulse-fleet', 'Widen serial column in export', 'caleb', 1, 'in_progress', 4),
    t('HP2', 'proj-pulse-fleet', 'Charger-aware battery suppress', 'caleb', 3, 'todo', 6),
    t('HP3', 'proj-pulse-fleet', 'EU depot quotation NW-440', 'jordan', 5, 'todo', 3),
    t('HP4', 'proj-pulse-fleet', 'Field SOP v3 walkthrough', 'nina', -3, 'done', 2),
    t('HP5', 'proj-pulse-fleet', 'RMA intake regression check', 'renee', 2, 'blocked', 3, ['HP1']),
  ];

  return {
    people,
    clients,
    usage: buildUsage(today, HELIOS_USAGE, 99),
    tickets,
    communications,
    meetings,
    projects,
    tasks,
  };
}
