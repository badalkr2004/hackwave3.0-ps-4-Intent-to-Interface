import {
  MANIFESTS_BY_ID,
  UISpec,
  type ComponentId,
  type Panel,
  type PanelProps,
  type Shape,
  type Size,
} from '@gestalt/shared';

// Static sample data mirroring the seeded story, for the /gallery dev route only.

const DAY = 86_400_000;
const today = new Date();
today.setHours(0, 0, 0, 0);

function day(n: number): string {
  const d = new Date(today.getTime() + n * DAY);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}
function at(n: number, h: number, min = 0): string {
  const d = new Date(today.getTime() + n * DAY);
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}

function usageSeries(): PanelProps<'usage_trend'>['series'] {
  const out: PanelProps<'usage_trend'>['series'] = [];
  for (let n = -90; n <= -1; n++) {
    const d = new Date(today.getTime() + n * DAY);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const base = weekend ? 120 : 410;
    const ramp = n < -17 ? 0 : n >= -12 ? 1 : (n + 18) / 6;
    const wobble = 1 + 0.03 * Math.sin(n * 1.7);
    out.push({
      date: day(n),
      value: Math.round(base * (1 - 0.38 * ramp) * wobble),
      baseline: base,
    });
  }
  return out;
}

export const SAMPLE_PROPS: { [K in ComponentId]: PanelProps<K> } = {
  portfolio_health: {
    totalArr: 1_346_000,
    atRiskCount: 1,
    clients: [
      {
        id: 'acme',
        name: 'Acme Corp',
        plan: 'Enterprise',
        arr: 480000,
        health: 54,
        usageChangePct: -38,
        renewalInDays: 75,
      },
      {
        id: 'globex',
        name: 'Globex Industries',
        plan: 'Enterprise',
        arr: 620000,
        health: 88,
        usageChangePct: 1,
        renewalInDays: 210,
      },
      {
        id: 'initech',
        name: 'Initech',
        plan: 'Growth',
        arr: 96000,
        health: 71,
        usageChangePct: -6,
        renewalInDays: 140,
      },
      {
        id: 'umbrella',
        name: 'Umbrella Labs',
        plan: 'Growth',
        arr: 150000,
        health: 79,
        usageChangePct: 0,
        renewalInDays: 110,
      },
    ],
  },
  upcoming_meetings: {
    meetings: [
      {
        id: 'm2',
        clientId: 'acme',
        clientName: 'Acme Corp',
        title: 'Q4 Business Review',
        kind: 'qbr',
        startsAt: at(1, 11),
        inHours: 30,
      },
      {
        id: 'm3',
        clientId: 'globex',
        clientName: 'Globex Industries',
        title: 'Renewal planning',
        kind: 'renewal',
        startsAt: at(3, 15),
        inHours: 82,
      },
      {
        id: 'm4',
        clientId: 'umbrella',
        clientName: 'Umbrella Labs',
        title: 'Lab managers onboarding sync',
        kind: 'sync',
        startsAt: at(5, 10, 30),
        inHours: 125,
      },
    ],
  },
  client_snapshot: {
    client: {
      id: 'acme',
      name: 'Acme Corp',
      plan: 'Enterprise',
      arr: 480000,
      health: 54,
      renewalInDays: 75,
      contactName: 'Rohan Mehta',
      contactTitle: 'VP Operations',
      csmName: 'Maya Rao',
    },
    openTickets: 4,
    highPriorityTickets: 2,
    usageChangePct: -38,
    recentSentiment: -0.37,
  },
  last_meeting_recap: {
    meeting: {
      id: 'm1',
      title: 'Q3 Business Review',
      date: at(-42, 11),
      daysAgo: 42,
      notes:
        'Reviewed Q3 adoption: dashboards usage up 12% and the ops team fully onboarded. Rohan asked for scheduled exports so finance can automate month-end reporting. We committed to delivering scheduled exports with the upcoming release.',
    },
    commitments: [
      {
        id: 'm1-1',
        text: 'Deliver scheduled exports by the end of the quarter',
        status: 'missed',
        due: day(-10),
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
  comms_timeline: {
    recentSentiment: -0.37,
    items: [
      {
        id: 'c1',
        channel: 'email',
        date: at(-2, 9, 12),
        daysAgo: 2,
        direction: 'inbound',
        sender: 'Rohan Mehta',
        subject: 'Export failures',
        snippet: 'Export failures are blocking our month-end close. We need a date, not an update.',
        sentiment: -0.7,
      },
      {
        id: 'c2',
        channel: 'slack',
        date: at(-4, 15, 30),
        daysAgo: 4,
        direction: 'outbound',
        sender: 'Maya Rao',
        subject: null,
        snippet:
          'Acknowledged: we can reproduce the export failures and engineering is working on a hotfix.',
        sentiment: 0,
      },
      {
        id: 'c3',
        channel: 'email',
        date: at(-6, 11, 5),
        daysAgo: 6,
        direction: 'inbound',
        sender: 'Priya Shah',
        subject: 'Scheduled export missing',
        snippet: 'Our scheduled export has not arrived for three days and nobody got an error.',
        sentiment: -0.4,
      },
      {
        id: 'c4',
        channel: 'email',
        date: at(-10, 10),
        daysAgo: 10,
        direction: 'inbound',
        sender: 'Rohan Mehta',
        subject: 'Large exports timing out',
        snippet: 'Our larger CSV exports keep timing out since last week. Is this a known issue?',
        sentiment: -0.3,
      },
      {
        id: 'c8',
        channel: 'email',
        date: at(-29, 10, 30),
        daysAgo: 29,
        direction: 'outbound',
        sender: 'Maya Rao',
        subject: 'Checking in',
        snippet: 'Just checking in after the SSO fix. Anything else we can help the ops team with?',
        sentiment: 0.4,
      },
    ],
  },
  open_issues: {
    totalOpen: 4,
    highCount: 2,
    recentShare: 0.75,
    tickets: [
      {
        id: 'T-1',
        clientId: 'acme',
        clientName: 'Acme Corp',
        title: 'CSV export times out above 10k rows',
        priority: 'high',
        ageDays: 16,
        tags: ['export', 'v2.4'],
      },
      {
        id: 'T-2',
        clientId: 'acme',
        clientName: 'Acme Corp',
        title: 'Scheduled export fails silently',
        priority: 'high',
        ageDays: 14,
        tags: ['export', 'v2.4', 'scheduled'],
      },
      {
        id: 'T-3',
        clientId: 'acme',
        clientName: 'Acme Corp',
        title: 'Export is missing the cost center column',
        priority: 'medium',
        ageDays: 11,
        tags: ['export', 'v2.4'],
      },
      {
        id: 'T-4',
        clientId: 'acme',
        clientName: 'Acme Corp',
        title: 'Invoice shows wrong seat count',
        priority: 'low',
        ageDays: 9,
        tags: ['billing'],
      },
    ],
  },
  usage_trend: {
    scopeLabel: 'Acme Corp, last 90 days',
    series: usageSeries(),
    changePct: -38,
    anomalyStart: day(-17),
    releases: [
      { id: 'rel-v2.3', version: 'v2.3', date: day(-45) },
      { id: 'rel-v2.4', version: 'v2.4', date: day(-18) },
    ],
    summary: 'Down 38% vs the 4 weeks before v2.4.',
  },
  segment_breakdown: {
    summary: 'The drop is concentrated in export and the finance team.',
    groups: [
      {
        dimension: 'feature',
        label: 'Feature',
        segments: [
          { id: 'seg:feature:export', label: 'Export', deltaPct: -71, before: 148, after: 43 },
          {
            id: 'seg:feature:dashboards',
            label: 'Dashboards',
            deltaPct: -12,
            before: 131,
            after: 115,
          },
          { id: 'seg:feature:alerts', label: 'Alerts', deltaPct: -5, before: 49, after: 47 },
        ],
      },
      {
        dimension: 'team',
        label: 'Team',
        segments: [
          { id: 'seg:team:finance', label: 'Finance', deltaPct: -62, before: 131, after: 50 },
          { id: 'seg:team:ops', label: 'Ops', deltaPct: -30, before: 115, after: 80 },
          { id: 'seg:team:sales', label: 'Sales', deltaPct: -8, before: 82, after: 75 },
        ],
      },
    ],
  },
  release_strip: {
    anomalyStart: day(-17),
    correlatedReleaseId: 'rel-v2.4',
    releases: [
      {
        id: 'rel-v2.3',
        version: 'v2.3',
        date: day(-45),
        daysAgo: 45,
        notes: 'Alert routing rules and faster dashboard loading.',
        features: ['alerts', 'dashboards'],
        released: true,
      },
      {
        id: 'rel-v2.4',
        version: 'v2.4',
        date: day(-18),
        daysAgo: 18,
        notes:
          'Introduces the new export pipeline (streaming CSV and scheduled exports) and refreshed dashboards.',
        features: ['export', 'dashboards'],
        released: true,
      },
      {
        id: 'rel-v2.5',
        version: 'v2.5',
        date: day(21),
        daysAgo: -21,
        notes: 'Planned: audit log and SSO group sync.',
        features: ['audit', 'sso'],
        released: false,
      },
    ],
  },
  hypothesis_list: {
    generatedWithoutAi: false,
    hypotheses: [
      {
        title: 'The v2.4 export pipeline broke large and scheduled exports',
        confidence: 'high',
        explanation:
          'Export usage fell 71% starting the day after v2.4, three open export tickets are tagged v2.4, and finance (the main export users) dropped 62%.',
        evidence: [
          { id: 'rel:v2.4', label: 'Release v2.4' },
          { id: 'seg:feature:export', label: 'Export −71%' },
          { id: 'ticket:T-1', label: 'T-1 export timeout' },
          { id: 'ticket:T-2', label: 'T-2 scheduled export' },
        ],
        howToConfirm: 'Compare export job error rates before and after v2.4 for Acme.',
      },
      {
        title: 'Finance stopped logging in after scheduled exports failed',
        confidence: 'medium',
        explanation:
          'Finance relies on scheduled exports for month-end close; their usage dropped most and they reported silent failures.',
        evidence: [
          { id: 'seg:team:finance', label: 'Finance −62%' },
          { id: 'comm:c3', label: 'Email from Priya Shah' },
        ],
        howToConfirm:
          'Check finance users’ last login dates against the scheduled export failure dates.',
      },
      {
        title: 'Seat changes from the billing dispute reduced active users',
        confidence: 'low',
        explanation:
          'A billing ticket mentions a seat count mismatch, but sales and alerts usage are nearly flat.',
        evidence: [{ id: 'ticket:T-4', label: 'T-4 invoice seats' }],
        howToConfirm: 'Compare the seat roster from 30 days ago with today.',
      },
    ],
  },
  talking_points: {
    generatedWithoutAi: false,
    points: [
      {
        type: 'acknowledge',
        headline: 'Own the export failures since v2.4',
        detail:
          'Exports have timed out or failed silently for two weeks, and it is blocking their month-end close.',
        evidence: [
          { id: 'ticket:T-1', label: 'T-1' },
          { id: 'comm:c1', label: 'Rohan, 2 days ago' },
        ],
      },
      {
        type: 'acknowledge',
        headline: 'We missed the scheduled exports commitment',
        detail: 'We promised scheduled exports at the Q3 review and did not deliver on time.',
        evidence: [{ id: 'commitment:m1-1', label: 'Q3 commitment' }],
      },
      {
        type: 'ask',
        headline: 'Which reports does finance need first?',
        detail:
          'Ask Rohan to rank the exports blocking month-end so the hotfix order matches their impact.',
        evidence: [{ id: 'seg:team:finance', label: 'Finance −62%' }],
      },
      {
        type: 'commit',
        headline: 'Share the v2.4.1 hotfix date with a named owner',
        detail:
          'The hotfix project has a release task in 5 days; commit to that date and a daily status note.',
        evidence: [{ id: 'task:T7', label: 'T7 Release v2.4.1' }],
      },
      {
        type: 'risk',
        headline: 'Renewal in 75 days with health at 54',
        detail:
          'Two open commitments and falling sentiment put the renewal at risk if the hotfix slips.',
        evidence: [{ id: 'client:acme', label: 'Acme health 54' }],
      },
    ],
  },
  overdue_queue: {
    scopeLabel: 'All projects',
    overdueCount: 4,
    tasks: [
      {
        id: 'T1',
        title: 'Fix export pagination',
        projectId: 'proj-export-hotfix',
        projectName: 'v2.4 export hotfix',
        ownerId: 'dev',
        ownerName: 'Dev Patel',
        due: day(-5),
        overdueDays: 5,
        status: 'in_progress',
      },
      {
        id: 'T2',
        title: 'Fix scheduled export job',
        projectId: 'proj-export-hotfix',
        projectName: 'v2.4 export hotfix',
        ownerId: 'lena',
        ownerName: 'Lena Fischer',
        due: day(-3),
        overdueDays: 3,
        status: 'in_progress',
      },
      {
        id: 'T3',
        title: 'Add retry queue for large exports',
        projectId: 'proj-export-hotfix',
        projectName: 'v2.4 export hotfix',
        ownerId: 'dev',
        ownerName: 'Dev Patel',
        due: day(-2),
        overdueDays: 2,
        status: 'blocked',
      },
      {
        id: 'S1',
        title: 'Rotate SSO signing certificates',
        projectId: 'proj-sso-rollout',
        projectName: 'Acme SSO rollout',
        ownerId: 'lena',
        ownerName: 'Lena Fischer',
        due: day(-2),
        overdueDays: 2,
        status: 'in_progress',
      },
    ],
  },
  blocker_chain: {
    projectName: 'v2.4 export hotfix',
    tasks: [
      {
        id: 'T1',
        title: 'Fix export pagination',
        status: 'in_progress',
        ownerName: 'Dev Patel',
        due: day(-5),
        overdueDays: 5,
        dependsOn: [],
      },
      {
        id: 'T2',
        title: 'Fix scheduled export job',
        status: 'in_progress',
        ownerName: 'Lena Fischer',
        due: day(-3),
        overdueDays: 3,
        dependsOn: [],
      },
      {
        id: 'T3',
        title: 'Add retry queue for large exports',
        status: 'blocked',
        ownerName: 'Dev Patel',
        due: day(-2),
        overdueDays: 2,
        dependsOn: ['T1'],
      },
      {
        id: 'T4',
        title: 'Restore cost center column',
        status: 'todo',
        ownerName: 'Lena Fischer',
        due: day(2),
        overdueDays: 0,
        dependsOn: [],
      },
      {
        id: 'T5',
        title: 'Regression tests for export',
        status: 'todo',
        ownerName: 'Sam Ortiz',
        due: day(3),
        overdueDays: 0,
        dependsOn: ['T1', 'T3'],
      },
      {
        id: 'T6',
        title: 'Update export docs',
        status: 'todo',
        ownerName: 'Ira Menon',
        due: day(4),
        overdueDays: 0,
        dependsOn: [],
      },
      {
        id: 'T7',
        title: 'Release v2.4.1',
        status: 'todo',
        ownerName: 'Ira Menon',
        due: day(5),
        overdueDays: 0,
        dependsOn: ['T2', 'T4', 'T5'],
      },
    ],
  },
  workload_bars: {
    people: [
      {
        id: 'dev',
        name: 'Dev Patel',
        role: 'Backend engineer',
        capacityPct: 160,
        openTasks: 14,
        overdueTasks: 2,
      },
      {
        id: 'ira',
        name: 'Ira Menon',
        role: 'Product manager',
        capacityPct: 90,
        openTasks: 5,
        overdueTasks: 0,
      },
      {
        id: 'sam',
        name: 'Sam Ortiz',
        role: 'QA engineer',
        capacityPct: 85,
        openTasks: 3,
        overdueTasks: 0,
      },
      {
        id: 'lena',
        name: 'Lena Fischer',
        role: 'Backend engineer',
        capacityPct: 70,
        openTasks: 4,
        overdueTasks: 2,
      },
    ],
  },
  sales_pulse: {
    pipelineValue: 767000,
    weightedForecast: 312000,
    winRate: 0.5,
    openDeals: 5,
    topClientName: 'Acme Corp',
    topClientShare: 0.72,
    byStage: [
      { stage: 'lead', amount: 28000 },
      { stage: 'qualified', amount: 145000 },
      { stage: 'proposal', amount: 114000 },
      { stage: 'negotiation', amount: 480000 },
    ],
    trend: [
      { week: '2025-08-18', leads: 42, spend: 12000 },
      { week: '2025-08-25', leads: 38, spend: 11000 },
      { week: '2025-09-01', leads: 51, spend: 14000 },
      { week: '2025-09-08', leads: 47, spend: 13500 },
    ],
    preferredChart: 'bars',
    insight: 'Acme Corp holds 72% of open pipeline.',
  },
  jira_tickets: {
    connected: true,
    baseUrl: 'https://example.atlassian.net',
    projectKey: 'KAN',
    displayName: 'Demo User',
    total: 3,
    openCount: 2,
    highCount: 1,
    focused: false,
    issues: [
      {
        key: 'KAN-12',
        id: '10012',
        summary: 'Export timeout above 10k rows',
        status: 'In Progress',
        statusCategory: 'indeterminate',
        priority: 'High',
        issueType: 'Bug',
        assignee: 'Caleb Ng',
        updated: at(-1, 10),
        created: at(-12, 9),
        url: 'https://example.atlassian.net/browse/KAN-12',
      },
      {
        key: 'KAN-15',
        id: '10015',
        summary: 'Add cost center column to CSV',
        status: 'To Do',
        statusCategory: 'new',
        priority: 'Medium',
        issueType: 'Story',
        assignee: null,
        updated: at(-2, 14),
        created: at(-5, 11),
        url: 'https://example.atlassian.net/browse/KAN-15',
      },
      {
        key: 'KAN-9',
        id: '10009',
        summary: 'Update onboarding checklist',
        status: 'Done',
        statusCategory: 'done',
        priority: 'Low',
        issueType: 'Task',
        assignee: 'Nina Okonkwo',
        updated: at(-3, 16),
        created: at(-20, 9),
        url: 'https://example.atlassian.net/browse/KAN-9',
      },
    ],
  },
  action_bar: {
    actions: [
      { id: 'draft_pre_meeting_email', label: 'Draft pre-meeting email', kind: 'draft_email' },
      { id: 'add_followup_task', label: 'Add follow-up task', kind: 'mock' },
      { id: 'reschedule_meeting', label: 'Reschedule meeting', kind: 'mock' },
    ],
  },
};

export const EMPTY_PROPS: { [K in ComponentId]: PanelProps<K> } = {
  portfolio_health: { clients: [], totalArr: 0, atRiskCount: 0 },
  upcoming_meetings: { meetings: [] },
  client_snapshot: SAMPLE_PROPS.client_snapshot,
  last_meeting_recap: { ...SAMPLE_PROPS.last_meeting_recap, commitments: [] },
  comms_timeline: { items: [], recentSentiment: null },
  open_issues: { tickets: [], totalOpen: 0, highCount: 0, recentShare: 0 },
  usage_trend: {
    scopeLabel: 'Acme Corp',
    series: [],
    changePct: null,
    anomalyStart: null,
    releases: [],
    summary: '',
  },
  segment_breakdown: { groups: [], summary: '' },
  release_strip: { releases: [], anomalyStart: null, correlatedReleaseId: null },
  hypothesis_list: { hypotheses: [], generatedWithoutAi: false },
  talking_points: { points: [], generatedWithoutAi: false },
  overdue_queue: { scopeLabel: 'All projects', overdueCount: 0, tasks: [] },
  blocker_chain: { projectName: 'v2.4 export hotfix', tasks: [] },
  workload_bars: { people: [] },
  sales_pulse: {
    pipelineValue: 0,
    weightedForecast: 0,
    winRate: 0,
    openDeals: 0,
    topClientName: null,
    topClientShare: 0,
    byStage: [],
    trend: [],
    preferredChart: 'bars',
    insight: 'No open pipeline for this organization.',
  },
  jira_tickets: {
    connected: false,
    baseUrl: null,
    projectKey: null,
    displayName: null,
    issues: [],
    total: 0,
    openCount: 0,
    highCount: 0,
    focused: false,
  },
  action_bar: { actions: [] },
};

const ACTIONS_BY_SHAPE: Record<Shape, PanelProps<'action_bar'>> = {
  overview: { actions: [{ id: 'add_followup_task', label: 'Add follow-up task', kind: 'mock' }] },
  prepare: SAMPLE_PROPS.action_bar,
  diagnose: {
    actions: [
      { id: 'notify_engineering', label: 'Notify engineering owner', kind: 'mock' },
      { id: 'draft_customer_update', label: 'Draft customer update', kind: 'draft_email' },
    ],
  },
  triage: {
    actions: [
      { id: 'nudge_owner', label: 'Nudge owner', kind: 'mock', params: { owner: 'Dev Patel' } },
      {
        id: 'reassign_task',
        label: 'Reassign task',
        kind: 'mock',
        params: { task: 'T3', person: 'Lena Fischer' },
      },
      { id: 'escalate', label: 'Escalate', kind: 'mock' },
    ],
  },
};

export function fixturePanel(
  shape: Shape,
  componentId: ComponentId,
  size: Size,
  opts: { status?: Panel['status']; props?: Record<string, unknown> } = {},
): Panel {
  const m = MANIFESTS_BY_ID[componentId]!;
  const placement = m.placement[shape];
  const props =
    opts.props ??
    (componentId === 'action_bar' ? ACTIONS_BY_SHAPE[shape] : SAMPLE_PROPS[componentId]);
  return {
    id: componentId,
    componentId,
    need: m.answers[0]!.need,
    question: m.question,
    size,
    zone: placement.zone,
    order: placement.order,
    status: opts.status ?? 'ready',
    pinned: false,
    props: props as Record<string, unknown>,
  };
}

type Entry = [ComponentId, Size];

const COMPOSITIONS: Record<Shape, { headline: string; summary: string; panels: Entry[] }> = {
  overview: {
    headline: 'Overview',
    summary: 'Here is your portfolio at a glance.',
    panels: [
      ['portfolio_health', 'M'],
      ['upcoming_meetings', 'M'],
      ['usage_trend', 'M'],
      ['overdue_queue', 'M'],
      ['open_issues', 'M'],
      ['action_bar', 'S'],
    ],
  },
  prepare: {
    headline: 'Preparing for Acme Corp',
    summary: 'Preparing for your meeting with Acme Corp.',
    panels: [
      ['client_snapshot', 'M'],
      ['last_meeting_recap', 'M'],
      ['talking_points', 'L'],
      ['usage_trend', 'M'],
      ['comms_timeline', 'M'],
      ['open_issues', 'M'],
      ['action_bar', 'M'],
    ],
  },
  diagnose: {
    headline: 'Investigating Acme Corp usage drop',
    summary: "Investigating why Acme Corp's usage changed over the last 30 days.",
    panels: [
      ['client_snapshot', 'S'],
      ['release_strip', 'M'],
      ['usage_trend', 'L'],
      ['segment_breakdown', 'L'],
      ['hypothesis_list', 'M'],
      ['open_issues', 'M'],
      ['comms_timeline', 'S'],
      ['action_bar', 'M'],
    ],
  },
  triage: {
    headline: 'Reviewing overdue work',
    summary: 'Reviewing overdue work across all projects.',
    panels: [
      ['workload_bars', 'M'],
      ['overdue_queue', 'L'],
      ['blocker_chain', 'L'],
      ['open_issues', 'S'],
      ['action_bar', 'M'],
    ],
  },
};

export function fixtureSpec(shape: Shape): UISpec {
  const c = COMPOSITIONS[shape];
  const panels = c.panels.map(([id, size]) => fixturePanel(shape, id, size));
  const receipts = panels.map((p, i) => {
    const m = MANIFESTS_BY_ID[p.componentId]!;
    const score = Math.max(0.35, 0.95 - i * 0.07);
    return {
      panelId: p.id,
      componentId: p.componentId,
      need: p.need,
      alsoServes: [] as const,
      priority: score,
      fit: 1,
      signal: 0.7,
      score,
      size: p.size,
      evidence: [`Answers “${m.question}” for this job.`, 'Facts loaded for the current scope.'],
      reason: `Answers '${m.question}' (priority ${score.toFixed(2)}).`,
    };
  });
  return UISpec.parse({
    id: `fixture-${shape}`,
    version: 1,
    intent: {
      shape,
      scope: {
        clientId: shape === 'triage' || shape === 'overview' ? null : 'acme',
        projectId: null,
        timeRange: '30d',
      },
      confidence: 1,
      summary: c.summary,
      headline: c.headline,
    },
    needs: [],
    panels,
    receipts,
    excluded: [],
    diff: null,
    degraded: false,
  });
}
