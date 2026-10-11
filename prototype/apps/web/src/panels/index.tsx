import { useMemo, type FC } from 'react';
import type { z } from 'zod';
import { PANEL_PROPS, type ComponentId, type PanelProps, type Size } from '@gestalt/shared';
import { ActionBar } from './ActionBar';
import { BlockerChain } from './BlockerChain';
import { ClientSnapshot } from './ClientSnapshot';
import { CommsTimeline } from './CommsTimeline';
import { HypothesisList } from './HypothesisList';
import { JiraTicketsPanel } from './JiraTickets';
import { LastMeetingRecap } from './LastMeetingRecap';
import { OpenIssues } from './OpenIssues';
import { OverdueQueue } from './OverdueQueue';
import { PanelSkeleton, type SkeletonVariant } from './PanelSkeleton';
import { PortfolioHealth } from './PortfolioHealth';
import { ReleaseStrip } from './ReleaseStrip';
import { SalesPulse } from './SalesPulse';
import { SegmentBreakdown } from './SegmentBreakdown';
import { TalkingPoints } from './TalkingPoints';
import { UpcomingMeetings } from './UpcomingMeetings';
import { UsageTrend } from './UsageTrend';
import { WorkloadBars } from './WorkloadBars';
import type { PanelViewProps } from './types';

export class PanelPropsError extends Error {
  constructor(
    readonly componentId: string,
    readonly issues: z.ZodError['issues'],
  ) {
    super(`Invalid props for panel "${componentId}"`);
  }
}

export interface PanelEntry {
  propsSchema: z.ZodType;
  /** Validates props with propsSchema before rendering; throws PanelPropsError on failure. */
  Component: FC<{ props: unknown; size: Size; lens: boolean }>;
  skeleton: FC<{ size: Size }>;
}

function definePanel<K extends ComponentId>(
  id: K,
  View: FC<PanelViewProps<K>>,
  variant: SkeletonVariant,
): PanelEntry {
  const schema: z.ZodType = PANEL_PROPS[id];
  function Validated({ props, size, lens }: { props: unknown; size: Size; lens: boolean }) {
    const parsed = useMemo(() => schema.safeParse(props), [props]);
    if (!parsed.success) throw new PanelPropsError(id, parsed.error.issues);
    return <View props={parsed.data as PanelProps<K>} size={size} lens={lens} />;
  }
  Validated.displayName = `Panel(${id})`;
  function Skeleton({ size }: { size: Size }) {
    return <PanelSkeleton size={size} variant={variant} />;
  }
  return { propsSchema: schema, Component: Validated, skeleton: Skeleton };
}

export const PANELS: Record<ComponentId, PanelEntry> = {
  portfolio_health: definePanel('portfolio_health', PortfolioHealth, 'bars'),
  upcoming_meetings: definePanel('upcoming_meetings', UpcomingMeetings, 'list'),
  client_snapshot: definePanel('client_snapshot', ClientSnapshot, 'text'),
  last_meeting_recap: definePanel('last_meeting_recap', LastMeetingRecap, 'list'),
  comms_timeline: definePanel('comms_timeline', CommsTimeline, 'list'),
  open_issues: definePanel('open_issues', OpenIssues, 'list'),
  usage_trend: definePanel('usage_trend', UsageTrend, 'chart'),
  segment_breakdown: definePanel('segment_breakdown', SegmentBreakdown, 'bars'),
  release_strip: definePanel('release_strip', ReleaseStrip, 'text'),
  hypothesis_list: definePanel('hypothesis_list', HypothesisList, 'list'),
  talking_points: definePanel('talking_points', TalkingPoints, 'list'),
  overdue_queue: definePanel('overdue_queue', OverdueQueue, 'list'),
  blocker_chain: definePanel('blocker_chain', BlockerChain, 'list'),
  workload_bars: definePanel('workload_bars', WorkloadBars, 'bars'),
  sales_pulse: definePanel('sales_pulse', SalesPulse, 'bars'),
  jira_tickets: definePanel('jira_tickets', JiraTicketsPanel, 'list'),
  action_bar: definePanel('action_bar', ActionBar, 'buttons'),
};

export function getPanelEntry(componentId: string): PanelEntry | null {
  return Object.hasOwn(PANELS, componentId) ? PANELS[componentId as ComponentId] : null;
}
