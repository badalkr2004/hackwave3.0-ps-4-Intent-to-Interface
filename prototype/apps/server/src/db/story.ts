import { addDays, atTime, isWeekend, shortDate, toISODate } from '../lib/dates';
import { mulberry32 } from '../lib/prng';

// Rows use database column names so they can be inserted with the postgres row helper.

export interface PersonRow {
  id: string;
  name: string;
  role: string;
  capacity_pct: number;
}
export interface ClientRow {
  id: string;
  name: string;
  plan: string;
  arr: number;
  health: number;
  csm_id: string;
  renewal_date: string;
  contact_name: string;
  contact_title: string;
}
export interface ReleaseRow {
  id: string;
  version: string;
  date: string;
  notes: string;
  features: string[];
}
export interface UsageRow {
  client_id: string;
  date: string;
  dimension: 'total' | 'feature' | 'team';
  segment: string;
  value: number;
}
export interface TicketRow {
  id: string;
  client_id: string;
  title: string;
  status: 'open' | 'closed';
  priority: 'high' | 'medium' | 'low';
  created: Date;
  updated: Date;
  tags: string[];
  summary: string;
}
export interface CommunicationRow {
  id: string;
  client_id: string;
  channel: 'email' | 'slack';
  date: Date;
  direction: 'inbound' | 'outbound';
  sender: string;
  subject: string | null;
  snippet: string;
  sentiment: number;
}
export interface Commitment {
  id: string;
  text: string;
  status: 'open' | 'done' | 'missed';
  due: string;
}
export interface MeetingRow {
  id: string;
  client_id: string;
  date: Date;
  kind: string;
  title: string;
  notes: string | null;
  commitments: Commitment[];
}
export interface ProjectRow {
  id: string;
  name: string;
  client_id: string | null;
  owner_id: string;
}
export interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  owner_id: string;
  due: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  depends_on: string[];
  estimate_h: number;
}

export interface Story {
  people: PersonRow[];
  clients: ClientRow[];
  releases: ReleaseRow[];
  usage: UsageRow[];
  tickets: TicketRow[];
  communications: CommunicationRow[];
  meetings: MeetingRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
}

export const USAGE_DAYS = 90;
export const RELEASE_V24_DAY = -18;
/** First day of the Acme decay (day after v2.4) and the day the drop is fully in effect. */
export const DROP_START_DAY = -17;
export const DROP_FULL_DAY = -12;
const NOISE = 0.04;

/** 0 before the drop, rising linearly to 1 by DROP_FULL_DAY. */
function dropRamp(day: number): number {
  if (day < DROP_START_DAY) return 0;
  if (day >= DROP_FULL_DAY) return 1;
  return (day - (DROP_START_DAY - 1)) / (DROP_FULL_DAY - (DROP_START_DAY - 1));
}

/** [share of daily base, level after the drop] per segment. */
type SegmentCurve = Record<string, readonly [share: number, finalLevel: number]>;

export interface UsageProfile {
  clientId: string;
  weekday: number;
  weekend: number;
  /** Level of total usage after the drop (1 = no drop). */
  finalLevel: number;
  /** Linear decline over the full 90 days, as a fraction per 60 days. */
  driftPer60d: number;
  features: SegmentCurve;
  teams: SegmentCurve;
}

const STABLE_FEATURES: SegmentCurve = {
  dashboards: [0.4, 1],
  export: [0.45, 1],
  alerts: [0.15, 1],
};
const STABLE_TEAMS: SegmentCurve = { finance: [0.4, 1], ops: [0.35, 1], sales: [0.25, 1] };

/** Northwind CS portfolio — export-decay narrative used by engine tests. */
export const NORTHWIND_USAGE_PROFILES: readonly UsageProfile[] = [
  {
    clientId: 'acme',
    weekday: 410,
    weekend: 120,
    finalLevel: 0.62,
    driftPer60d: 0,
    features: { dashboards: [0.4, 0.88], export: [0.45, 0.29], alerts: [0.15, 0.95] },
    teams: { finance: [0.4, 0.38], ops: [0.35, 0.7], sales: [0.25, 0.92] },
  },
  {
    clientId: 'globex',
    weekday: 620,
    weekend: 180,
    finalLevel: 1,
    driftPer60d: 0,
    features: STABLE_FEATURES,
    teams: STABLE_TEAMS,
  },
  {
    clientId: 'initech',
    weekday: 140,
    weekend: 40,
    finalLevel: 1,
    driftPer60d: 0.085,
    features: STABLE_FEATURES,
    teams: STABLE_TEAMS,
  },
  {
    clientId: 'umbrella',
    weekday: 220,
    weekend: 60,
    finalLevel: 1,
    driftPer60d: 0,
    features: STABLE_FEATURES,
    teams: STABLE_TEAMS,
  },
];

export function buildUsage(
  today: Date,
  profiles: readonly UsageProfile[] = NORTHWIND_USAGE_PROFILES,
  seed = 42,
): UsageRow[] {
  const rng = mulberry32(seed);
  const noise = () => 1 + (rng() * 2 - 1) * NOISE;
  const rows: UsageRow[] = [];

  for (const p of profiles) {
    for (let day = -USAGE_DAYS; day <= -1; day++) {
      const d = addDays(today, day);
      const date = toISODate(d);
      const base =
        (isWeekend(d) ? p.weekend : p.weekday) * (1 - (p.driftPer60d * (day + USAGE_DAYS)) / 60);
      const ramp = dropRamp(day);
      const level = (final: number) => 1 - (1 - final) * ramp;

      rows.push({
        client_id: p.clientId,
        date,
        dimension: 'total',
        segment: 'total',
        value: Math.round(base * level(p.finalLevel) * noise()),
      });
      for (const [dimension, curves] of [
        ['feature', p.features],
        ['team', p.teams],
      ] as const) {
        for (const [segment, [share, final]] of Object.entries(curves)) {
          rows.push({
            client_id: p.clientId,
            date,
            dimension,
            segment,
            value: Math.round(base * share * level(final) * noise()),
          });
        }
      }
    }
  }
  return rows;
}

export function buildStory(today: Date): Story {
  const day = (n: number) => toISODate(addDays(today, n));
  const at = (n: number, h: number, m = 0) => atTime(addDays(today, n), h, m);

  const people: PersonRow[] = [
    { id: 'maya', name: 'Maya Rao', role: 'Customer success manager', capacity_pct: 80 },
    { id: 'dev', name: 'Dev Patel', role: 'Backend engineer', capacity_pct: 160 },
    { id: 'lena', name: 'Lena Fischer', role: 'Backend engineer', capacity_pct: 70 },
    { id: 'sam', name: 'Sam Ortiz', role: 'QA engineer', capacity_pct: 85 },
    { id: 'ira', name: 'Ira Menon', role: 'Product manager', capacity_pct: 90 },
  ];

  const clients: ClientRow[] = [
    {
      id: 'acme',
      name: 'Acme Corp',
      plan: 'Enterprise',
      arr: 480000,
      health: 54,
      csm_id: 'maya',
      renewal_date: day(75),
      contact_name: 'Rohan Mehta',
      contact_title: 'VP Operations',
    },
    {
      id: 'globex',
      name: 'Globex Industries',
      plan: 'Enterprise',
      arr: 620000,
      health: 88,
      csm_id: 'maya',
      renewal_date: day(210),
      contact_name: 'Hank Scorpio',
      contact_title: 'CEO',
    },
    {
      id: 'initech',
      name: 'Initech',
      plan: 'Growth',
      arr: 96000,
      health: 71,
      csm_id: 'maya',
      renewal_date: day(140),
      contact_name: 'Bill Lumbergh',
      contact_title: 'Division VP',
    },
    {
      id: 'umbrella',
      name: 'Umbrella Labs',
      plan: 'Growth',
      arr: 150000,
      health: 79,
      csm_id: 'maya',
      renewal_date: day(110),
      contact_name: 'Alice Abernathy',
      contact_title: 'Head of Research Ops',
    },
  ];

  const releases: ReleaseRow[] = [
    {
      id: 'rel-v2.3',
      version: 'v2.3',
      date: day(-45),
      notes: 'Alert routing rules and faster dashboard loading.',
      features: ['alerts', 'dashboards'],
    },
    {
      id: 'rel-v2.4',
      version: 'v2.4',
      date: day(RELEASE_V24_DAY),
      notes:
        'Introduces the new export pipeline (streaming CSV and scheduled exports) and refreshed dashboards.',
      features: ['export', 'dashboards'],
    },
    {
      id: 'rel-v2.5',
      version: 'v2.5',
      date: day(21),
      notes: 'Planned: audit log and SSO group sync. Not released yet.',
      features: ['audit', 'sso'],
    },
  ];

  const tickets: TicketRow[] = [
    {
      id: 'T-1',
      client_id: 'acme',
      title: 'CSV export times out above 10k rows',
      status: 'open',
      priority: 'high',
      created: at(-16, 9, 40),
      updated: at(-2, 15, 5),
      // Engineering depth — developers see; interns do not.
      tags: ['export', 'v2.4', 'bug', 'technical', 'backend'],
      summary:
        'Exports larger than about 10,000 rows time out after 60 seconds since the v2.4 pipeline change.',
    },
    {
      id: 'T-2',
      client_id: 'acme',
      title: 'Scheduled export fails silently',
      status: 'open',
      priority: 'high',
      created: at(-14, 11, 15),
      updated: at(-3, 10, 20),
      tags: ['export', 'v2.4', 'scheduled', 'bug', 'api'],
      summary:
        'Nightly scheduled exports to the finance team stopped arriving; no error is shown or emailed.',
    },
    {
      id: 'T-3',
      client_id: 'acme',
      title: 'Export is missing the cost center column',
      status: 'open',
      priority: 'medium',
      created: at(-11, 14, 0),
      updated: at(-5, 9, 30),
      // Public CS surface — visible to intern on Acme.
      tags: ['export', 'v2.4', 'customer'],
      summary: 'The cost center column present before v2.4 is missing from CSV exports.',
    },
    {
      id: 'T-4',
      client_id: 'acme',
      title: 'Invoice shows wrong seat count',
      status: 'open',
      priority: 'low',
      created: at(-9, 16, 10),
      updated: at(-8, 12, 0),
      tags: ['billing', 'customer'],
      summary: 'Invoice lists 450 seats; the customer counts 410 active seats.',
    },
    {
      id: 'T-5',
      client_id: 'acme',
      title: 'SSO metadata refresh',
      status: 'closed',
      priority: 'medium',
      created: at(-40, 10, 0),
      updated: at(-30, 17, 0),
      tags: ['sso', 'technical', 'engineering'],
      summary: 'Identity provider metadata rotated; refreshed and confirmed working.',
    },
    {
      id: 'T-6',
      client_id: 'initech',
      title: 'Report filters reset on reload',
      status: 'open',
      priority: 'medium',
      created: at(-7, 13, 0),
      updated: at(-6, 9, 0),
      tags: ['reports', 'bug', 'technical', 'frontend'],
      summary: 'Saved filters on the weekly report are cleared after a page reload.',
    },
    {
      id: 'T-7',
      client_id: 'globex',
      title: 'Request: additional admin seats',
      status: 'closed',
      priority: 'low',
      created: at(-20, 9, 0),
      updated: at(-18, 11, 0),
      tags: ['account', 'customer'],
      summary: 'Added three admin seats.',
    },
    {
      id: 'T-8',
      client_id: 'umbrella',
      title: 'Alert emails land in spam',
      status: 'open',
      priority: 'low',
      created: at(-5, 8, 30),
      updated: at(-4, 10, 0),
      tags: ['alerts', 'email', 'customer'],
      summary: 'Alert notifications are flagged as spam by their mail gateway.',
    },
    {
      id: 'T-9',
      client_id: 'globex',
      title: 'API rate limit returns 429 under load',
      status: 'open',
      priority: 'high',
      created: at(-6, 10, 0),
      updated: at(-1, 14, 0),
      tags: ['api', 'bug', 'technical', 'backend'],
      summary: 'Globex integration clients hit 429s during peak sync windows.',
    },
    {
      id: 'T-10',
      client_id: 'initech',
      title: 'Webhook signature verification failing',
      status: 'open',
      priority: 'high',
      created: at(-4, 11, 0),
      updated: at(-1, 9, 30),
      tags: ['api', 'bug', 'engineering', 'backend'],
      summary: 'Outbound webhooks fail HMAC checks after key rotation.',
    },
    {
      id: 'T-11',
      client_id: 'acme',
      title: 'Need training deck for new admins',
      status: 'open',
      priority: 'low',
      created: at(-3, 15, 0),
      updated: at(-2, 11, 0),
      tags: ['enablement', 'customer'],
      summary: 'CS asked for a short admin onboarding deck before the QBR.',
    },
  ];

  const communications: CommunicationRow[] = [
    {
      id: 'c1',
      client_id: 'acme',
      channel: 'email',
      date: at(-2, 9, 12),
      direction: 'inbound',
      sender: 'Rohan Mehta',
      subject: 'Export failures',
      snippet: 'Export failures are blocking our month-end close. We need a date, not an update.',
      sentiment: -0.7,
    },
    {
      id: 'c2',
      client_id: 'acme',
      channel: 'slack',
      date: at(-4, 15, 30),
      direction: 'outbound',
      sender: 'Maya Rao',
      subject: null,
      snippet:
        'Acknowledged: we can reproduce the export failures and engineering is working on a hotfix. I will share a timeline.',
      sentiment: 0,
    },
    {
      id: 'c3',
      client_id: 'acme',
      channel: 'email',
      date: at(-6, 11, 5),
      direction: 'inbound',
      sender: 'Priya Shah',
      subject: 'Scheduled export missing',
      snippet:
        'Our scheduled export has not arrived for three days and nobody got an error. Finance is reconciling by hand.',
      sentiment: -0.4,
    },
    {
      id: 'c4',
      client_id: 'acme',
      channel: 'email',
      date: at(-10, 10, 0),
      direction: 'inbound',
      sender: 'Rohan Mehta',
      subject: 'Large exports timing out',
      snippet: 'Our larger CSV exports keep timing out since last week. Is this a known issue?',
      sentiment: -0.3,
    },
    {
      id: 'c5',
      client_id: 'acme',
      channel: 'email',
      date: at(-14, 16, 45),
      direction: 'inbound',
      sender: 'Priya Shah',
      subject: 'Invoice question',
      snippet: 'Our invoice shows 450 seats but we only have 410 active users. Can you check?',
      sentiment: -0.1,
    },
    {
      id: 'c6',
      client_id: 'acme',
      channel: 'slack',
      date: at(-19, 12, 0),
      direction: 'inbound',
      sender: 'Rohan Mehta',
      subject: null,
      snippet: 'Happy to do the Q4 business review next month. Can you send a few times?',
      sentiment: 0.2,
    },
    {
      id: 'c7',
      client_id: 'acme',
      channel: 'email',
      date: at(-24, 14, 20),
      direction: 'inbound',
      sender: 'Rohan Mehta',
      subject: 'Dashboards',
      snippet: 'The team likes the faster dashboards. Looking forward to the new export options.',
      sentiment: 0.3,
    },
    {
      id: 'c8',
      client_id: 'acme',
      channel: 'email',
      date: at(-29, 10, 30),
      direction: 'outbound',
      sender: 'Maya Rao',
      subject: 'Checking in',
      snippet:
        'Just checking in after the SSO fix. Anything else we can help the ops team with this month?',
      sentiment: 0.4,
    },
    {
      id: 'c9',
      client_id: 'globex',
      channel: 'email',
      date: at(-3, 9, 0),
      direction: 'inbound',
      sender: 'Hank Scorpio',
      subject: 'Renewal',
      snippet: 'Things are going great. Let us talk about adding the analytics module at renewal.',
      sentiment: 0.6,
    },
    {
      id: 'c10',
      client_id: 'globex',
      channel: 'slack',
      date: at(-12, 13, 0),
      direction: 'outbound',
      sender: 'Maya Rao',
      subject: null,
      snippet: 'Thanks for the case study quote. Sharing the draft for your approval.',
      sentiment: 0.4,
    },
    {
      id: 'c11',
      client_id: 'initech',
      channel: 'email',
      date: at(-6, 15, 0),
      direction: 'inbound',
      sender: 'Bill Lumbergh',
      subject: 'Report filters',
      snippet: 'The saved filters on our weekly report keep resetting. Mildly annoying.',
      sentiment: -0.2,
    },
    {
      id: 'c12',
      client_id: 'initech',
      channel: 'email',
      date: at(-21, 11, 0),
      direction: 'outbound',
      sender: 'Maya Rao',
      subject: 'Usage tips',
      snippet: 'Sharing a few tips to get more out of alerts for your support team.',
      sentiment: 0.1,
    },
    {
      id: 'c13',
      client_id: 'umbrella',
      channel: 'email',
      date: at(-8, 10, 0),
      direction: 'inbound',
      sender: 'Alice Abernathy',
      subject: 'Onboarding',
      snippet: 'The research ops team finished onboarding. Next step is the lab managers.',
      sentiment: 0.3,
    },
  ];

  const missedDue = addDays(today, -10);
  const meetings: MeetingRow[] = [
    {
      id: 'm1',
      client_id: 'acme',
      date: at(-42, 11, 0),
      kind: 'qbr',
      title: 'Q3 Business Review',
      notes:
        'Reviewed Q3 adoption: dashboards usage up 12% and the ops team fully onboarded. ' +
        'Rohan asked for scheduled exports so finance can automate month-end reporting. ' +
        'We committed to delivering scheduled exports with the upcoming release. ' +
        'SSO rollout timing was discussed and a date was promised by email. ' +
        'Finance team adoption is lagging and needs a dedicated onboarding session. ' +
        'Overall sentiment was positive and renewal was described as likely.',
      commitments: [
        {
          id: 'm1-1',
          text: `Deliver scheduled exports by ${shortDate(missedDue)}`,
          status: 'missed',
          due: toISODate(missedDue),
        },
        { id: 'm1-2', text: 'Share SSO rollout date', status: 'done', due: day(-35) },
        {
          id: 'm1-3',
          text: 'Dedicated onboarding session for the finance team',
          status: 'open',
          due: day(10),
        },
      ],
    },
    {
      id: 'm2',
      client_id: 'acme',
      date: at(1, 11, 0),
      kind: 'qbr',
      title: 'Q4 Business Review',
      notes: null,
      commitments: [],
    },
    {
      id: 'm3',
      client_id: 'globex',
      date: at(3, 15, 0),
      kind: 'renewal',
      title: 'Renewal planning',
      notes: null,
      commitments: [],
    },
    {
      id: 'm4',
      client_id: 'umbrella',
      date: at(5, 10, 30),
      kind: 'sync',
      title: 'Lab managers onboarding sync',
      notes: null,
      commitments: [],
    },
  ];

  const projects: ProjectRow[] = [
    { id: 'proj-export-hotfix', name: 'v2.4 export hotfix', client_id: 'acme', owner_id: 'ira' },
    { id: 'proj-sso-rollout', name: 'Acme SSO rollout', client_id: 'acme', owner_id: 'lena' },
    { id: 'proj-docs-revamp', name: 'Docs revamp', client_id: null, owner_id: 'ira' },
    { id: 'proj-platform-upkeep', name: 'Platform upkeep', client_id: null, owner_id: 'dev' },
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
    t('T1', 'proj-export-hotfix', 'Fix export pagination', 'dev', -5, 'in_progress', 8),
    t('T2', 'proj-export-hotfix', 'Fix scheduled export job', 'lena', -3, 'in_progress', 6),
    t('T3', 'proj-export-hotfix', 'Add retry queue for large exports', 'dev', -2, 'blocked', 10, [
      'T1',
    ]),
    t('T4', 'proj-export-hotfix', 'Restore cost center column', 'lena', 2, 'todo', 3),
    t('T5', 'proj-export-hotfix', 'Regression tests for export', 'sam', 3, 'todo', 6, ['T1', 'T3']),
    t('T6', 'proj-export-hotfix', 'Update export docs', 'ira', 4, 'todo', 2),
    t('T7', 'proj-export-hotfix', 'Release v2.4.1', 'ira', 5, 'todo', 2, ['T2', 'T4', 'T5']),

    t('S1', 'proj-sso-rollout', 'Rotate SSO signing certificates', 'lena', -2, 'in_progress', 4),
    t('S2', 'proj-sso-rollout', 'Group sync prototype', 'dev', 6, 'todo', 8),
    t('S3', 'proj-sso-rollout', 'SCIM provisioning endpoint', 'dev', 9, 'todo', 12),
    t('S4', 'proj-sso-rollout', 'SSO audit events', 'dev', 12, 'todo', 6),
    t('S5', 'proj-sso-rollout', 'SSO admin guide', 'ira', 8, 'todo', 3),
    t('S6', 'proj-sso-rollout', 'Configure Acme identity provider', 'lena', -20, 'done', 4),

    t('D1', 'proj-docs-revamp', 'Rewrite API quickstart', 'ira', 7, 'todo', 4),
    t('D2', 'proj-docs-revamp', 'API reference generator', 'dev', 10, 'todo', 6),
    t('D3', 'proj-docs-revamp', 'Code samples for exports', 'dev', 14, 'todo', 4),
    t('D4', 'proj-docs-revamp', 'Docs test plan', 'sam', 11, 'todo', 3),
    t('D5', 'proj-docs-revamp', 'Docs navigation redesign', 'ira', -12, 'done', 5),

    t('P1', 'proj-platform-upkeep', 'Upgrade Postgres driver', 'dev', 3, 'todo', 3),
    t('P2', 'proj-platform-upkeep', 'Rotate service credentials', 'dev', 4, 'in_progress', 2),
    t('P3', 'proj-platform-upkeep', 'Reduce worker memory usage', 'dev', 6, 'todo', 8),
    t('P4', 'proj-platform-upkeep', 'Queue metrics dashboard', 'dev', 8, 'todo', 5),
    t('P5', 'proj-platform-upkeep', 'Flaky integration test cleanup', 'dev', 9, 'todo', 4),
    t('P6', 'proj-platform-upkeep', 'Archive old export jobs', 'dev', 13, 'todo', 3),
    t('P7', 'proj-platform-upkeep', 'On-call runbook update', 'dev', 15, 'todo', 2),
    t('P8', 'proj-platform-upkeep', 'Load test export pipeline', 'sam', 7, 'todo', 6),
    t('P9', 'proj-platform-upkeep', 'Dependency audit', 'lena', 10, 'todo', 3),
    t('P10', 'proj-platform-upkeep', 'Upgrade build tooling', 'dev', -25, 'done', 4),
  ];

  return {
    people,
    clients,
    releases,
    usage: buildUsage(today),
    tickets,
    communications,
    meetings,
    projects,
    tasks,
  };
}
