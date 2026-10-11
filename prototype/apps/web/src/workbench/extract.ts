import type { ComponentId, Panel, PanelProps, UISpec } from '@gestalt/shared';

function propsOf<K extends ComponentId>(panels: Panel[], componentId: K): PanelProps<K> | null {
  const panel = panels.find((p) => p.componentId === componentId);
  if (!panel?.props || typeof panel.props !== 'object') return null;
  return panel.props as PanelProps<K>;
}

export interface WorkbenchData {
  client: PanelProps<'client_snapshot'> | null;
  meetings: PanelProps<'upcoming_meetings'> | null;
  lastMeeting: PanelProps<'last_meeting_recap'> | null;
  comms: PanelProps<'comms_timeline'> | null;
  issues: PanelProps<'open_issues'> | null;
  usage: PanelProps<'usage_trend'> | null;
  hypotheses: PanelProps<'hypothesis_list'> | null;
  talkingPoints: PanelProps<'talking_points'> | null;
  overdue: PanelProps<'overdue_queue'> | null;
  blockers: PanelProps<'blocker_chain'> | null;
  workload: PanelProps<'workload_bars'> | null;
  portfolio: PanelProps<'portfolio_health'> | null;
  actions: PanelProps<'action_bar'> | null;
  evidencePanels: Panel[];
}

const CANVAS_OWNED: Record<string, Set<string>> = {
  overview: new Set([
    'portfolio_health',
    'upcoming_meetings',
    'usage_trend',
    'overdue_queue',
    'open_issues',
    'sales_pulse',
  ]),
  prepare: new Set([
    'client_snapshot',
    'talking_points',
    'last_meeting_recap',
    'open_issues',
    'comms_timeline',
    'action_bar',
  ]),
  diagnose: new Set([
    'usage_trend',
    'hypothesis_list',
    'release_strip',
    'segment_breakdown',
    'open_issues',
    'comms_timeline',
    'action_bar',
  ]),
  triage: new Set(['overdue_queue', 'blocker_chain', 'workload_bars', 'action_bar', 'open_issues']),
};

export function extractWorkbench(spec: UISpec): WorkbenchData {
  const panels = spec.panels;
  const owned = CANVAS_OWNED[spec.intent.shape] ?? new Set();
  return {
    client: propsOf(panels, 'client_snapshot'),
    meetings: propsOf(panels, 'upcoming_meetings'),
    lastMeeting: propsOf(panels, 'last_meeting_recap'),
    comms: propsOf(panels, 'comms_timeline'),
    issues: propsOf(panels, 'open_issues'),
    usage: propsOf(panels, 'usage_trend'),
    hypotheses: propsOf(panels, 'hypothesis_list'),
    talkingPoints: propsOf(panels, 'talking_points'),
    overdue: propsOf(panels, 'overdue_queue'),
    blockers: propsOf(panels, 'blocker_chain'),
    workload: propsOf(panels, 'workload_bars'),
    portfolio: propsOf(panels, 'portfolio_health'),
    actions: propsOf(panels, 'action_bar'),
    evidencePanels: panels.filter((p) => !owned.has(p.componentId)).slice(0, 4),
  };
}

export function taskGaps(spec: UISpec, data: WorkbenchData): string[] {
  const gaps: string[] = [];
  switch (spec.intent.shape) {
    case 'prepare': {
      if ((data.issues?.highCount ?? 0) > 0) {
        gaps.push(
          `${data.issues!.highCount} high-priority issue${data.issues!.highCount === 1 ? '' : 's'} still open`,
        );
      }
      if (data.usage?.changePct != null && data.usage.changePct < -5) {
        gaps.push(`Usage down ${Math.abs(Math.round(data.usage.changePct))}% — expect questions`);
      }
      const commitments = Array.isArray(data.lastMeeting?.commitments)
        ? data.lastMeeting.commitments
        : [];
      const openCommitments = commitments.filter((c) => c.status === 'open').length;
      if (openCommitments > 0) gaps.push('Open commitments from last meeting');
      if (!(data.talkingPoints?.points?.length)) gaps.push('Talk track still generating');
      break;
    }
    case 'diagnose': {
      if (data.usage?.anomalyStart) gaps.push(`Anomaly since ${data.usage.anomalyStart}`);
      if (!(data.hypotheses?.hypotheses?.length)) gaps.push('No root-cause hypothesis confirmed yet');
      if ((data.issues?.totalOpen ?? 0) > 0) {
        gaps.push(`${data.issues!.totalOpen} related open tickets`);
      }
      break;
    }
    case 'triage': {
      if ((data.overdue?.overdueCount ?? 0) > 0) {
        gaps.push(`${data.overdue!.overdueCount} overdue items in queue`);
      }
      if ((data.blockers?.tasks ?? []).some((t) => t.status === 'blocked')) {
        gaps.push('Blocked work sitting on the critical path');
      }
      break;
    }
    default: {
      if ((data.portfolio?.atRiskCount ?? 0) > 0) {
        gaps.push(`${data.portfolio!.atRiskCount} accounts need attention`);
      }
      if ((data.overdue?.overdueCount ?? 0) > 0) {
        gaps.push(`${data.overdue!.overdueCount} overdue across portfolio`);
      }
    }
  }
  return gaps.slice(0, 4);
}
