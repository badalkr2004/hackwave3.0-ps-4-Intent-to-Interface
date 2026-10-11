import type { ComponentId } from '@gestalt/shared';
import type { RegistryModule } from './types';
import action_bar from './action_bar';
import blocker_chain from './blocker_chain';
import client_snapshot from './client_snapshot';
import comms_timeline from './comms_timeline';
import hypothesis_list from './hypothesis_list';
import jira_tickets from './jira_tickets';
import last_meeting_recap from './last_meeting_recap';
import open_issues from './open_issues';
import overdue_queue from './overdue_queue';
import portfolio_health from './portfolio_health';
import release_strip from './release_strip';
import sales_pulse from './sales_pulse';
import segment_breakdown from './segment_breakdown';
import talking_points from './talking_points';
import upcoming_meetings from './upcoming_meetings';
import usage_trend from './usage_trend';
import workload_bars from './workload_bars';

export const REGISTRY: { [K in ComponentId]: RegistryModule<K> } = {
  portfolio_health,
  upcoming_meetings,
  client_snapshot,
  last_meeting_recap,
  comms_timeline,
  open_issues,
  usage_trend,
  segment_breakdown,
  release_strip,
  hypothesis_list,
  talking_points,
  overdue_queue,
  blocker_chain,
  workload_bars,
  sales_pulse,
  jira_tickets,
  action_bar,
};
