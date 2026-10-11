import type { ComponentManifest, NeedType, Placement, Shape, Size } from './schemas';

type Cell = `${'L' | 'C' | 'R'}${number}`;

const ZONES = { L: 'left', C: 'center', R: 'right' } as const;

function cell(c: Cell): Placement {
  const zone = ZONES[c[0] as keyof typeof ZONES];
  return { zone, order: Number(c.slice(1)) };
}

/** Placement matrix row, in shape order: overview, prepare, diagnose, triage. */
function place(
  overview: Cell,
  prepare: Cell,
  diagnose: Cell,
  triage: Cell,
): Record<Shape, Placement> {
  return {
    overview: cell(overview),
    prepare: cell(prepare),
    diagnose: cell(diagnose),
    triage: cell(triage),
  };
}

function manifest(
  id: string,
  title: string,
  question: string,
  answers: [NeedType, number][],
  sizes: Size[],
  placement: Record<Shape, Placement>,
  deferred = false,
): ComponentManifest {
  return {
    id,
    title,
    question,
    answers: answers.map(([need, fit]) => ({ need, fit })),
    sizes,
    placement,
    deferred,
  };
}

export const MANIFESTS: readonly ComponentManifest[] = [
  manifest(
    'portfolio_health',
    'Portfolio health',
    'How is the portfolio doing?',
    [['portfolio_health', 1]],
    ['M', 'L'],
    place('L1', 'L4', 'L4', 'L4'),
  ),
  manifest(
    'upcoming_meetings',
    'Upcoming meetings',
    'What is coming up?',
    [['schedule', 1]],
    ['S', 'M'],
    place('L2', 'L3', 'L5', 'L5'),
  ),
  manifest(
    'client_snapshot',
    'Client snapshot',
    'Where does this relationship stand?',
    [['relationship_status', 1]],
    ['S', 'M'],
    place('L3', 'L1', 'L1', 'L1'),
  ),
  manifest(
    'last_meeting_recap',
    'Last meeting recap',
    'What did we promise last time?',
    [['prior_commitments', 1]],
    ['S', 'M'],
    place('L4', 'L2', 'L3', 'L3'),
  ),
  manifest(
    'release_strip',
    'Release timeline',
    'What changed around then?',
    [['change_correlation', 1]],
    ['S', 'M'],
    place('C3', 'C4', 'L2', 'L2'),
  ),
  manifest(
    'workload_bars',
    'Team workload',
    'Who has capacity?',
    [
      ['capacity', 1],
      ['blockers', 0.4],
    ],
    ['S', 'M'],
    place('R3', 'R4', 'R4', 'L1'),
  ),
  manifest(
    'open_issues',
    'Open issues',
    'What is unresolved?',
    [
      ['open_issues', 1],
      ['root_cause_hypotheses', 0.3],
    ],
    ['S', 'M'],
    place('R1', 'R1', 'R1', 'R2'),
  ),
  manifest(
    'comms_timeline',
    'Recent communication',
    'What has been said recently?',
    [
      ['recent_communication', 1],
      ['relationship_status', 0.3],
    ],
    ['S', 'M'],
    place('R2', 'C3', 'R2', 'R3'),
  ),
  manifest(
    'usage_trend',
    'Usage trend',
    'What changed in usage?',
    [
      ['usage_trend', 1],
      ['change_correlation', 0.4],
    ],
    ['S', 'M', 'L'],
    place('C1', 'C2', 'C1', 'C4'),
  ),
  manifest(
    'segment_breakdown',
    'Segment breakdown',
    'Where is the drop concentrated?',
    [['anomaly_localization', 1]],
    ['M', 'L'],
    place('C4', 'C5', 'C2', 'C5'),
  ),
  manifest(
    'hypothesis_list',
    'Hypotheses',
    'What might explain this?',
    [['root_cause_hypotheses', 1]],
    ['M', 'L'],
    place('C5', 'C6', 'C3', 'C6'),
    true,
  ),
  manifest(
    'talking_points',
    'Talking points',
    'What should I say and ask?',
    [['talking_points', 1]],
    ['M', 'L'],
    place('C6', 'C1', 'C6', 'C7'),
    true,
  ),
  manifest(
    'overdue_queue',
    'Overdue work',
    'What is slipping?',
    [['overdue_work', 1]],
    ['S', 'M', 'L'],
    place('C2', 'C7', 'C7', 'C1'),
  ),
  manifest(
    'blocker_chain',
    'Blocker chain',
    'What is blocking what?',
    [['blockers', 1]],
    ['M', 'L'],
    place('C7', 'C8', 'C8', 'C2'),
  ),
  manifest(
    'sales_pulse',
    'Sales pulse',
    'How is sales and marketing performing?',
    [['sales_pulse', 1]],
    ['S', 'M', 'L'],
    place('R4', 'R5', 'R6', 'R6'),
  ),
  manifest(
    'jira_tickets',
    'Jira tickets',
    'What is happening in Jira?',
    [
      ['jira_tickets', 1],
      ['open_issues', 0.45],
    ],
    ['S', 'M', 'L'],
    place('C3', 'R2', 'R3', 'C3'),
  ),
  manifest(
    'action_bar',
    'Actions',
    'What can I do now?',
    [['available_actions', 1]],
    ['S', 'M'],
    place('R9', 'R9', 'R9', 'R9'),
  ),
];

export const MANIFESTS_BY_ID: Readonly<Record<string, ComponentManifest>> = Object.fromEntries(
  MANIFESTS.map((m) => [m.id, m]),
);
