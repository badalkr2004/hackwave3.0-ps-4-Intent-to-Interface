import { z } from 'zod';

// SPEC-NOTE: Section 6 puts a propsSchema on both the server registry module and the React panel.
// They live here once so loaders and panels validate against the same contract.

/** `YYYY-MM-DD` */
const IsoDate = z.string();
/** ISO 8601 timestamp */
const IsoDateTime = z.string();

export const EvidenceRef = z.object({ id: z.string(), label: z.string() });
export type EvidenceRef = z.infer<typeof EvidenceRef>;

export const TaskStatus = z.enum(['todo', 'in_progress', 'blocked', 'done']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Priority = z.enum(['high', 'medium', 'low']);
export type Priority = z.infer<typeof Priority>;

export const PortfolioHealthProps = z.object({
  clients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      plan: z.string(),
      arr: z.number(),
      health: z.number(),
      usageChangePct: z.number().nullable(),
      renewalInDays: z.number().nullable(),
    }),
  ),
  totalArr: z.number(),
  atRiskCount: z.number(),
});

export const UpcomingMeetingsProps = z.object({
  meetings: z.array(
    z.object({
      id: z.string(),
      clientId: z.string(),
      clientName: z.string(),
      title: z.string(),
      kind: z.string(),
      startsAt: IsoDateTime,
      inHours: z.number(),
    }),
  ),
});

export const ClientSnapshotProps = z.object({
  client: z.object({
    id: z.string(),
    name: z.string(),
    plan: z.string(),
    arr: z.number(),
    health: z.number(),
    renewalInDays: z.number().nullable(),
    contactName: z.string().nullable(),
    contactTitle: z.string().nullable(),
    csmName: z.string().nullable(),
  }),
  openTickets: z.number(),
  highPriorityTickets: z.number(),
  usageChangePct: z.number().nullable(),
  recentSentiment: z.number().nullable(),
});

export const CommitmentStatus = z.enum(['open', 'done', 'missed']);
export type CommitmentStatus = z.infer<typeof CommitmentStatus>;

export const LastMeetingRecapProps = z.object({
  meeting: z.object({
    id: z.string(),
    title: z.string(),
    date: IsoDateTime,
    daysAgo: z.number(),
    notes: z.string().nullable(),
  }),
  commitments: z.array(
    z.object({ id: z.string(), text: z.string(), status: CommitmentStatus, due: IsoDate }),
  ),
});

export const CommsTimelineProps = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      channel: z.enum(['email', 'slack']),
      date: IsoDateTime,
      daysAgo: z.number(),
      direction: z.enum(['inbound', 'outbound']),
      sender: z.string(),
      subject: z.string().nullable(),
      snippet: z.string(),
      sentiment: z.number(),
    }),
  ),
  recentSentiment: z.number().nullable(),
});

export const OpenIssuesProps = z.object({
  tickets: z.array(
    z.object({
      id: z.string(),
      clientId: z.string(),
      clientName: z.string(),
      title: z.string(),
      priority: Priority,
      ageDays: z.number(),
      tags: z.array(z.string()),
    }),
  ),
  totalOpen: z.number(),
  highCount: z.number(),
});

export const UsageTrendProps = z.object({
  scopeLabel: z.string(),
  series: z.array(z.object({ date: IsoDate, value: z.number(), baseline: z.number().nullable() })),
  changePct: z.number().nullable(),
  anomalyStart: IsoDate.nullable(),
  releases: z.array(z.object({ id: z.string(), version: z.string(), date: IsoDate })),
  summary: z.string(),
});

export const SegmentBreakdownProps = z.object({
  groups: z.array(
    z.object({
      dimension: z.enum(['feature', 'team']),
      label: z.string(),
      segments: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          deltaPct: z.number(),
          before: z.number(),
          after: z.number(),
        }),
      ),
    }),
  ),
  summary: z.string(),
});

export const ReleaseStripProps = z.object({
  releases: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      date: IsoDate,
      daysAgo: z.number(),
      notes: z.string().nullable(),
      features: z.array(z.string()),
      released: z.boolean(),
    }),
  ),
  anomalyStart: IsoDate.nullable(),
  correlatedReleaseId: z.string().nullable(),
});

export const Confidence = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

export const HypothesisListProps = z.object({
  hypotheses: z.array(
    z.object({
      title: z.string(),
      confidence: Confidence,
      explanation: z.string(),
      evidence: z.array(EvidenceRef),
      howToConfirm: z.string(),
    }),
  ),
  generatedWithoutAi: z.boolean(),
});

export const TalkingPointType = z.enum(['acknowledge', 'ask', 'commit', 'risk']);
export type TalkingPointType = z.infer<typeof TalkingPointType>;

export const TalkingPointsProps = z.object({
  points: z.array(
    z.object({
      type: TalkingPointType,
      headline: z.string(),
      detail: z.string(),
      evidence: z.array(EvidenceRef),
    }),
  ),
  generatedWithoutAi: z.boolean(),
});

export const OverdueQueueProps = z.object({
  scopeLabel: z.string(),
  overdueCount: z.number(),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      projectId: z.string(),
      projectName: z.string(),
      ownerId: z.string().nullable(),
      ownerName: z.string().nullable(),
      due: IsoDate,
      overdueDays: z.number(),
      status: TaskStatus,
    }),
  ),
});

export const BlockerChainProps = z.object({
  projectName: z.string(),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: TaskStatus,
      ownerName: z.string().nullable(),
      due: IsoDate,
      overdueDays: z.number(),
      dependsOn: z.array(z.string()),
    }),
  ),
});

export const WorkloadBarsProps = z.object({
  people: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      capacityPct: z.number(),
      openTasks: z.number(),
      overdueTasks: z.number(),
    }),
  ),
});

export const ActionId = z.enum([
  'draft_pre_meeting_email',
  'add_followup_task',
  'reschedule_meeting',
  'notify_engineering',
  'draft_customer_update',
  'nudge_owner',
  'reassign_task',
  'escalate',
]);
export type ActionId = z.infer<typeof ActionId>;

export const ActionBarProps = z.object({
  actions: z.array(
    z.object({
      id: ActionId,
      label: z.string(),
      kind: z.enum(['mock', 'draft_email']),
      params: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

export const PANEL_PROPS = {
  portfolio_health: PortfolioHealthProps,
  upcoming_meetings: UpcomingMeetingsProps,
  client_snapshot: ClientSnapshotProps,
  last_meeting_recap: LastMeetingRecapProps,
  comms_timeline: CommsTimelineProps,
  open_issues: OpenIssuesProps,
  usage_trend: UsageTrendProps,
  segment_breakdown: SegmentBreakdownProps,
  release_strip: ReleaseStripProps,
  hypothesis_list: HypothesisListProps,
  talking_points: TalkingPointsProps,
  overdue_queue: OverdueQueueProps,
  blocker_chain: BlockerChainProps,
  workload_bars: WorkloadBarsProps,
  action_bar: ActionBarProps,
} as const;

export type ComponentId = keyof typeof PANEL_PROPS;
export type PanelProps<K extends ComponentId> = z.infer<(typeof PANEL_PROPS)[K]>;

export function isComponentId(id: string): id is ComponentId {
  return Object.hasOwn(PANEL_PROPS, id);
}
