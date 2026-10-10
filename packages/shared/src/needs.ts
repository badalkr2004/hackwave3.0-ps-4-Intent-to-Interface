import { NeedType } from './schemas';
import type { Need, Shape } from './schemas';

export const NEED_QUESTIONS: Record<NeedType, string> = {
  portfolio_health: 'How is the portfolio doing?',
  schedule: 'What is coming up?',
  relationship_status: 'Where does this relationship stand?',
  recent_communication: 'What has been said recently?',
  open_issues: 'What is unresolved?',
  prior_commitments: 'What did we promise last time?',
  talking_points: 'What should I say and ask?',
  usage_trend: 'What changed in usage?',
  anomaly_localization: 'Where is the drop concentrated?',
  change_correlation: 'What changed around then?',
  root_cause_hypotheses: 'What might explain this?',
  overdue_work: 'What is slipping?',
  blockers: 'What is blocking what?',
  capacity: 'Who has capacity?',
  available_actions: 'What can I do now?',
};

export const SHAPE_TEMPLATES: Record<Shape, Partial<Record<NeedType, number>>> = {
  overview: {
    portfolio_health: 0.8,
    schedule: 0.7,
    open_issues: 0.5,
    usage_trend: 0.6,
    overdue_work: 0.55,
    available_actions: 0.3,
  },
  prepare: {
    relationship_status: 0.9,
    prior_commitments: 0.85,
    recent_communication: 0.7,
    open_issues: 0.8,
    talking_points: 0.95,
    usage_trend: 0.75,
    available_actions: 0.6,
  },
  diagnose: {
    relationship_status: 0.4,
    recent_communication: 0.45,
    open_issues: 0.6,
    usage_trend: 0.95,
    anomaly_localization: 0.9,
    change_correlation: 0.85,
    root_cause_hypotheses: 0.9,
    available_actions: 0.55,
  },
  triage: {
    relationship_status: 0.3,
    open_issues: 0.4,
    overdue_work: 0.95,
    blockers: 0.9,
    capacity: 0.8,
    available_actions: 0.7,
  },
};

export function templateNeeds(shape: Shape): Need[] {
  return NeedType.options.flatMap((type) => {
    const priority = SHAPE_TEMPLATES[shape][type];
    return priority === undefined
      ? []
      : [{ type, question: NEED_QUESTIONS[type], priority, source: 'template' as const }];
  });
}
