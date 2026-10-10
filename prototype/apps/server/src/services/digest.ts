import type { CommitmentStatus, Priority, TaskStatus, TimeRange } from '@gestalt/shared';
import type { LoadContext } from '../registry/types';

/** Compact, id-tagged facts about a scope (Section 10.6). Every citable item carries an `id`. */
export interface Digest {
  scope: {
    client: {
      id: string;
      name: string;
      plan: string;
      arr: number;
      health: number;
      renewalInDays: number | null;
      contactName: string | null;
    } | null;
    timeRange: TimeRange;
  };
  usage: {
    id: string;
    changePct: number;
    startedOn: string | null;
    worstSegments: { id: string; dimension: 'feature' | 'team'; label: string; deltaPct: number }[];
  } | null;
  releases: {
    id: string;
    version: string;
    daysAgo: number;
    notes: string | null;
    features: string[];
    correlated: boolean;
  }[];
  tickets: {
    id: string;
    title: string;
    status: 'open';
    priority: Priority;
    tags: string[];
    ageDays: number;
  }[];
  comms: {
    id: string;
    channel: 'email' | 'slack';
    daysAgo: number;
    direction: 'inbound' | 'outbound';
    sender: string;
    snippet: string;
    sentiment: number;
  }[];
  commitments: { id: string; text: string; status: CommitmentStatus; due: string }[];
  /** Most recent past meeting notes — feeds talking points after MOM ingest. */
  lastMeeting: {
    id: string;
    title: string;
    daysAgo: number;
    notesExcerpt: string | null;
    decisions: string[];
  } | null;
  work: {
    overdue: {
      id: string;
      title: string;
      owner: string | null;
      overdueDays: number;
      status: TaskStatus;
    }[];
    blockedBy: { id: string; title: string; waitingOn: string[] }[];
    ownerLoad: { person: string; capacityPct: number; openTasks: number }[];
  };
  meeting: { id: string; title: string; inHours: number } | null;
}

export const releaseRef = (version: string) => `rel:${version}`;

function decisionsFromNotes(notes: string | null): string[] {
  if (!notes) return [];
  const block = notes.match(/Decisions:\s*\n([\s\S]*?)(?:\n\nAttendees:|\n\n[A-Z]|$)/i);
  if (!block?.[1]) return [];
  return block[1]
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** Builds the digest from module props already loaded for this scope (memoized via ctx.load). */
export function buildDigest(ctx: LoadContext): Promise<Digest> {
  return ctx.once('digest', async () => {
    const clientId = ctx.scope.clientId;
    const [
      snapshot,
      usage,
      segments,
      releases,
      issues,
      comms,
      recap,
      overdue,
      chain,
      workload,
      meetings,
    ] = await Promise.all([
      clientId ? ctx.load('client_snapshot') : null,
      ctx.load('usage_trend'),
      ctx.load('segment_breakdown'),
      ctx.load('release_strip'),
      ctx.load('open_issues'),
      ctx.load('comms_timeline'),
      ctx.load('last_meeting_recap'),
      ctx.load('overdue_queue'),
      ctx.load('blocker_chain'),
      ctx.load('workload_bars'),
      ctx.load('upcoming_meetings'),
    ]);

    const correlatedId = releases?.correlatedReleaseId ?? null;
    const chainById = new Map((chain?.tasks ?? []).map((t) => [t.id, t]));

    return {
      scope: {
        client: snapshot
          ? {
              id: `client:${snapshot.client.id}`,
              name: snapshot.client.name,
              plan: snapshot.client.plan,
              arr: snapshot.client.arr,
              health: snapshot.client.health,
              renewalInDays: snapshot.client.renewalInDays,
              contactName: snapshot.client.contactName,
            }
          : null,
        timeRange: ctx.scope.timeRange,
      },
      usage:
        usage && usage.changePct !== null
          ? {
              id: `usage:${clientId ?? 'portfolio'}`,
              changePct: usage.changePct,
              startedOn: usage.anomalyStart,
              worstSegments: (segments?.groups ?? []).flatMap((g) =>
                g.segments
                  .filter((s) => s.deltaPct <= -10)
                  .slice(0, 2)
                  .map((s) => ({
                    id: s.id,
                    dimension: g.dimension,
                    label: s.label,
                    deltaPct: s.deltaPct,
                  })),
              ),
            }
          : null,
      releases: (releases?.releases ?? [])
        .filter((r) => r.released && r.daysAgo <= 60)
        .map((r) => ({
          id: releaseRef(r.version),
          version: r.version,
          daysAgo: r.daysAgo,
          notes: r.notes,
          features: r.features,
          correlated: r.id === correlatedId,
        })),
      tickets: (issues?.tickets ?? []).slice(0, 8).map((t) => ({
        id: `ticket:${t.id}`,
        title: t.title,
        status: 'open' as const,
        priority: t.priority,
        tags: t.tags,
        ageDays: t.ageDays,
      })),
      comms: (comms?.items ?? []).slice(0, 6).map((c) => ({
        id: `comm:${c.id}`,
        channel: c.channel,
        daysAgo: c.daysAgo,
        direction: c.direction,
        sender: c.sender,
        snippet: c.snippet,
        sentiment: c.sentiment,
      })),
      commitments: (recap?.commitments ?? []).map((c) => ({
        id: `commitment:${c.id}`,
        text: c.text,
        status: c.status,
        due: c.due,
      })),
      lastMeeting: recap?.meeting
        ? {
            id: `meeting:${recap.meeting.id}`,
            title: recap.meeting.title,
            daysAgo: recap.meeting.daysAgo,
            notesExcerpt: recap.meeting.notes
              ? recap.meeting.notes.replace(/\s+/g, ' ').trim().slice(0, 600)
              : null,
            decisions: decisionsFromNotes(recap.meeting.notes),
          }
        : null,
      work: {
        overdue: (overdue?.tasks ?? []).slice(0, 6).map((t) => ({
          id: `task:${t.id}`,
          title: t.title,
          owner: t.ownerName,
          overdueDays: t.overdueDays,
          status: t.status,
        })),
        blockedBy: (chain?.tasks ?? [])
          .filter((t) => t.dependsOn.length > 0)
          .map((t) => ({
            id: `task:${t.id}`,
            title: t.title,
            waitingOn: t.dependsOn.filter((d) => chainById.has(d)).map((d) => `task:${d}`),
          })),
        ownerLoad: (workload?.people ?? []).slice(0, 5).map((p) => ({
          person: p.name,
          capacityPct: p.capacityPct,
          openTasks: p.openTasks,
        })),
      },
      meeting: meetings?.meetings[0]
        ? {
            id: `meeting:${meetings.meetings[0].id}`,
            title: meetings.meetings[0].title,
            inHours: meetings.meetings[0].inHours,
          }
        : null,
    };
  });
}

/** Every citable id in the digest (the hallucination guard drops anything else). */
export function digestIds(d: Digest): Set<string> {
  const ids = new Set<string>();
  if (d.scope.client) ids.add(d.scope.client.id);
  if (d.usage) {
    ids.add(d.usage.id);
    for (const s of d.usage.worstSegments) ids.add(s.id);
  }
  for (const list of [
    d.releases,
    d.tickets,
    d.comms,
    d.commitments,
    d.work.overdue,
    d.work.blockedBy,
  ]) {
    for (const item of list) ids.add(item.id);
  }
  if (d.meeting) ids.add(d.meeting.id);
  if (d.lastMeeting) ids.add(d.lastMeeting.id);
  return ids;
}
