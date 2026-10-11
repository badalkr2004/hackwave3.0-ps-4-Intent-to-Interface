import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { getDbState } from '../db/state';
import { getDrizzle } from '../db/drizzle';
import { env } from '../env';
import { googleMeeting, meetingMinutes, orgActionItem } from '../db/auth-schema';
import {
  DEV_TAGS,
  capabilitiesFor,
  filterJiraIssuesForRole,
  ticketMatchesRole,
  type AccessRole,
} from './accessPolicy';
import { resolveJiraForSession } from './connectors';
import { searchRecentIssues, type JiraIssue } from './jira';
import { log } from '../log';

function tierForStoryTicket(tags: readonly string[]): 'engineering' | 'public' {
  const eng = tags.some((t) => DEV_TAGS.includes(t.toLowerCase() as (typeof DEV_TAGS)[number]));
  return eng ? 'engineering' : 'public';
}

export type RagLiveContextRequest = {
  org_id: string;
  access_role: AccessRole;
  client_ids: string[];
  query?: string;
  /** Chat user — pulls their Atlassian Jira connector when connected. */
  user_id?: string;
};

/** Compact role-aware snapshot from Postgres for the RAG chat LLM. */
export async function buildLiveContext(req: RagLiveContextRequest): Promise<{
  ok: true;
  text: string;
  sections: string[];
} | { ok: false; message: string }> {
  const caps = capabilitiesFor(req.access_role);
  const clientIds = req.client_ids;
  const sections: string[] = [];
  const dbReady = getDbState() === 'up' && !!getDb() && !!getDrizzle();
  const drizzle = dbReady ? getDrizzle()! : null;
  const story = dbReady ? getDb()! : null;
  const clientFilter = clientIds.length > 0;

  // Live Jira only when role may see engineering connectors.
  if (caps.jiraLive) {
    const jiraSection = await formatLiveJiraSection(
      req.user_id ?? null,
      req.query,
      req.access_role,
    );
    if (jiraSection) sections.push(jiraSection);
    else {
      sections.push(
        '## LIVE DATA — Atlassian Jira\n(not connected — connect Jira under Connectors, or set server JIRA_* env.)',
      );
    }
  } else {
    sections.push('## LIVE DATA — Atlassian Jira\n(redacted for this access_role)');
  }

  if (!story || !drizzle) {
    if (!sections.length) {
      return { ok: false, message: 'Database unavailable for live context.' };
    }
    const text = [
      `Org: ${req.org_id}`,
      `Access role: ${req.access_role}`,
      '(Postgres snapshot unavailable — Jira-only context)',
      '',
      ...sections,
    ].join('\n\n');
    return {
      ok: true,
      text: text.slice(0, 28_000),
      sections: sections.map((s) => s.split('\n')[0] ?? ''),
    };
  }

  const { sql } = story;
  const sch = sql(env.DB_SCHEMA);

  sections.push(
    [
      '## Database schema (Gestalt story + org tables)',
      'Use these structures when answering about live data. Prefer facts from LIVE DATA below over guesses.',
      '',
      '### clients — portfolio accounts',
      'id, name, plan, arr, health, csm_id, renewal_date, contact_name, contact_title',
      '',
      '### meetings — story meeting notes (client-scoped)',
      'id, client_id, date, kind, title, notes, commitments (json)',
      '',
      '### google_meeting — Google Calendar / Meet (org-scoped, dates pinned)',
      'id, organization_id, title, starts_at, ends_at, meet_link, html_link, attendees, client_id, status, meeting_minutes_id',
      'Pinned date = calendar day of starts_at (YYYY-MM-DD). Use for “when is my meeting” / schedule questions.',
      '',
      '### meeting_minutes — org MoM archive',
      'id, organization_id, client_id, meeting_id, title, held_at, raw_text, summary, decisions, action_items, attendees, source',
      '',
      '### org_action_item — commitments from MoM',
      'id, organization_id, meeting_minutes_id, client_id, text, owner, due, status',
      '',
      '### tickets — DEMO story engineering issues (seeded Postgres; NOT Atlassian)',
      'id, client_id, title, status, priority, created, updated, tags (json), summary',
      '',
      '### Atlassian Jira (live connector)',
      'Fetched via the signed-in user\'s Jira connector (or server JIRA_* env). Prefer these over demo tickets when present.',
      '',
      '### usage_daily — usage metrics',
      'client_id, date, dimension (total|feature|team), segment, value',
      '',
      '### tasks / projects — delivery work',
      'projects: id, name, client_id, owner_id',
      'tasks: id, project_id, title, owner_id, due, status, depends_on, estimate_h',
      '',
      '### sales_opportunity (management tier)',
      'id, organization_id, client_id, name, stage, amount, probability, owner, expected_close, source_channel',
      '',
      '### communications — client touchpoints',
      'id, client_id, channel, date, direction, sender, subject, snippet, sentiment',
    ].join('\n'),
  );

  {
    const rows = await sql<
      { id: string; name: string; plan: string; arr: number; health: number; renewal_date: string | null }[]
    >`
      SELECT id, name, plan, arr, health, renewal_date::text
      FROM ${story.table('clients')}
      WHERE ${clientFilter ? sql`id = ANY(${clientIds})` : sql`true`}
      ORDER BY name
      LIMIT 20`;
    if (rows.length) {
      sections.push(
        '## LIVE DATA — clients\n' +
          rows
            .map(
              (r) =>
                `- ${r.name} (${r.id}): plan=${r.plan}, ARR=${r.arr}, health=${r.health}, renewal=${r.renewal_date ?? 'n/a'}`,
            )
            .join('\n'),
      );
    }
  }

  {
    const rows = await sql<
      {
        id: string;
        client_id: string;
        client_name: string;
        date: string;
        kind: string;
        title: string;
        notes: string | null;
        commitments: unknown;
      }[]
    >`
      SELECT m.id, m.client_id, c.name AS client_name, m.date::text, m.kind, m.title, m.notes, m.commitments
      FROM ${story.table('meetings')} m
      JOIN ${story.table('clients')} c ON c.id = m.client_id
      WHERE ${clientFilter ? sql`m.client_id = ANY(${clientIds})` : sql`true`}
      ORDER BY m.date DESC
      LIMIT 12`;
    if (rows.length) {
      sections.push(
        '## LIVE DATA — meetings (story)\n' +
          rows
            .map((r) => {
              const notes = (r.notes ?? '').replace(/\s+/g, ' ').slice(0, 280);
              const commits = Array.isArray(r.commitments)
                ? r.commitments
                    .slice(0, 3)
                    .map((x) =>
                      typeof x === 'object' && x && 'text' in x
                        ? String((x as { text: unknown }).text)
                        : JSON.stringify(x),
                    )
                    .join('; ')
                : '';
              return `- [${r.date.slice(0, 10)}] ${r.client_name}: ${r.title} (${r.kind})\n  Notes: ${notes || '(none)'}${commits ? `\n  Commitments: ${commits}` : ''}`;
            })
            .join('\n'),
      );
    }
  }

  {
    const gmeetsRaw = await drizzle
      .select({
        id: googleMeeting.id,
        title: googleMeeting.title,
        startsAt: googleMeeting.startsAt,
        endsAt: googleMeeting.endsAt,
        status: googleMeeting.status,
        meetLink: googleMeeting.meetLink,
        clientId: googleMeeting.clientId,
        attendees: googleMeeting.attendees,
      })
      .from(googleMeeting)
      .where(eq(googleMeeting.organizationId, req.org_id))
      .orderBy(desc(googleMeeting.startsAt))
      .limit(40);
    const gmeets = clientFilter
      ? gmeetsRaw.filter((m) => !m.clientId || clientIds.includes(m.clientId))
      : gmeetsRaw;

    if (gmeets.length) {
      const pinned = [
        ...new Set(
          gmeets.map((m) =>
            m.startsAt instanceof Date
              ? m.startsAt.toISOString().slice(0, 10)
              : String(m.startsAt).slice(0, 10),
          ),
        ),
      ].sort();
      sections.push(
        '## LIVE DATA — google_meeting (Google Calendar, dates pinned)\n' +
          `Pinned meeting dates: ${pinned.join(', ')}\n` +
          gmeets
            .map((m) => {
              const start =
                m.startsAt instanceof Date ? m.startsAt.toISOString() : String(m.startsAt);
              const end = m.endsAt instanceof Date ? m.endsAt.toISOString() : String(m.endsAt);
              const day = start.slice(0, 10);
              const emails = Array.isArray(m.attendees)
                ? m.attendees
                    .slice(0, 5)
                    .map((a) =>
                      typeof a === 'object' && a && 'email' in a
                        ? String((a as { email: unknown }).email)
                        : '',
                    )
                    .filter(Boolean)
                    .join(', ')
                : '';
              return `- [pinned ${day}] ${m.title} · ${start} → ${end} · status=${m.status} · client=${m.clientId ?? 'n/a'}${m.meetLink ? ` · meet=${m.meetLink}` : ''}${emails ? `\n  Attendees: ${emails}` : ''}`;
            })
            .join('\n'),
      );
    }
  }

  {
    const momWhere = clientFilter
      ? and(eq(meetingMinutes.organizationId, req.org_id), inArray(meetingMinutes.clientId, clientIds))
      : eq(meetingMinutes.organizationId, req.org_id);
    const moms = await drizzle
      .select({
        id: meetingMinutes.id,
        title: meetingMinutes.title,
        heldAt: meetingMinutes.heldAt,
        clientId: meetingMinutes.clientId,
        summary: meetingMinutes.summary,
        decisions: meetingMinutes.decisions,
        actionItems: meetingMinutes.actionItems,
        rawText: meetingMinutes.rawText,
      })
      .from(meetingMinutes)
      .where(momWhere)
      .orderBy(desc(meetingMinutes.heldAt))
      .limit(10);

    if (moms.length) {
      sections.push(
        '## LIVE DATA — meeting_minutes (org MoM)\n' +
          moms
            .map((m) => {
              const held =
                m.heldAt instanceof Date ? m.heldAt.toISOString().slice(0, 10) : String(m.heldAt);
              const body = (m.summary || m.rawText || '').replace(/\s+/g, ' ').slice(0, 400);
              const decisions = Array.isArray(m.decisions) ? m.decisions.slice(0, 3).join('; ') : '';
              const actions = Array.isArray(m.actionItems)
                ? m.actionItems
                    .slice(0, 3)
                    .map((a) =>
                      typeof a === 'object' && a && 'text' in a
                        ? String((a as { text: unknown }).text)
                        : String(a),
                    )
                    .join('; ')
                : '';
              return `- [${held}] ${m.title} (client=${m.clientId ?? 'n/a'})\n  ${body}${decisions ? `\n  Decisions: ${decisions}` : ''}${actions ? `\n  Actions: ${actions}` : ''}`;
            })
            .join('\n'),
      );
    }
  }

  {
    const itemWhere = clientFilter
      ? and(
          eq(orgActionItem.organizationId, req.org_id),
          inArray(orgActionItem.status, ['open', 'missed']),
          inArray(orgActionItem.clientId, clientIds),
        )
      : and(
          eq(orgActionItem.organizationId, req.org_id),
          inArray(orgActionItem.status, ['open', 'missed']),
        );
    const items = await drizzle
      .select({
        text: orgActionItem.text,
        owner: orgActionItem.owner,
        due: orgActionItem.due,
        status: orgActionItem.status,
        clientId: orgActionItem.clientId,
      })
      .from(orgActionItem)
      .where(itemWhere)
      .orderBy(orgActionItem.due)
      .limit(20);

    if (items.length) {
      sections.push(
        '## LIVE DATA — org_action_item (open/missed)\n' +
          items
            .map(
              (i) =>
                `- [${i.status}] ${i.text} (owner=${i.owner ?? 'unassigned'}, due=${i.due ?? 'n/a'}, client=${i.clientId ?? 'n/a'})`,
            )
            .join('\n'),
      );
    }
  }

  if (caps.storyTicketsMode !== 'none') {
    const rows = await sql<
      {
        id: string;
        client_id: string;
        client_name: string;
        title: string;
        status: string;
        priority: string;
        tags: string[];
        summary: string | null;
      }[]
    >`
      SELECT t.id, t.client_id, c.name AS client_name, t.title, t.status, t.priority, t.tags, t.summary
      FROM ${story.table('tickets')} t
      JOIN ${story.table('clients')} c ON c.id = t.client_id
      WHERE t.status = 'open'
        ${clientFilter ? sql`AND t.client_id = ANY(${clientIds})` : sql``}
      ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.updated DESC
      LIMIT 25`;
    const filtered = rows.filter((r) => ticketMatchesRole(r.tags ?? [], req.access_role));
    if (filtered.length) {
      sections.push(
        '## LIVE DATA — demo story tickets (seeded Postgres, not Atlassian)\n' +
          filtered
            .map((r) => {
              const sum = (r.summary ?? '').replace(/\s+/g, ' ').slice(0, 160);
              return `- ${r.id} [${r.priority}] ${r.client_name}: ${r.title}${sum ? ` — ${sum}` : ''} (tags=${(r.tags ?? []).join(',')})`;
            })
            .join('\n'),
      );
    }
  } else {
    sections.push('## LIVE DATA — demo story tickets\n(redacted for this access_role)');
  }

  {
    const rows = await sql<
      {
        id: string;
        title: string;
        due: string;
        status: string;
        project_name: string;
        client_id: string | null;
        client_name: string | null;
      }[]
    >`
      SELECT t.id, t.title, t.due::text, t.status, p.name AS project_name,
             p.client_id, c.name AS client_name
      FROM ${story.table('tasks')} t
      JOIN ${story.table('projects')} p ON p.id = t.project_id
      LEFT JOIN ${story.table('clients')} c ON c.id = p.client_id
      WHERE t.status <> 'done'
        AND t.due < CURRENT_DATE
        ${clientFilter ? sql`AND (p.client_id = ANY(${clientIds}) OR p.client_id IS NULL)` : sql``}
      ORDER BY t.due ASC
      LIMIT 20`;
    if (rows.length) {
      sections.push(
        '## LIVE DATA — overdue tasks\n' +
          rows
            .map(
              (r) =>
                `- ${r.title} (due=${r.due}, status=${r.status}, project=${r.project_name}, client=${r.client_name ?? r.client_id ?? 'n/a'})`,
            )
            .join('\n'),
      );
    }
  }

  {
    const rows = await sql<
      { client_id: string; client_name: string; date: string; value: number }[]
    >`
      SELECT u.client_id, c.name AS client_name, u.date::text, u.value
      FROM ${story.table('usage_daily')} u
      JOIN ${story.table('clients')} c ON c.id = u.client_id
      WHERE u.dimension = 'total' AND u.segment = 'all'
        ${clientFilter ? sql`AND u.client_id = ANY(${clientIds})` : sql``}
      ORDER BY u.date DESC
      LIMIT 40`;
    if (rows.length) {
      const byClient = new Map<string, { name: string; points: { date: string; value: number }[] }>();
      for (const r of rows) {
        const cur = byClient.get(r.client_id) ?? { name: r.client_name, points: [] };
        if (cur.points.length < 5) cur.points.push({ date: r.date, value: r.value });
        byClient.set(r.client_id, cur);
      }
      sections.push(
        '## LIVE DATA — usage_daily (recent total/all)\n' +
          [...byClient.entries()]
            .map(
              ([id, v]) =>
                `- ${v.name} (${id}): ` +
                v.points.map((p) => `${p.date.slice(0, 10)}=${p.value}`).join(', '),
            )
            .join('\n'),
      );
    }
  }

  if (caps.sales) {
    const opps = await sql<
      {
        name: string;
        stage: string;
        amount: number;
        probability: number;
        client_id: string;
        expected_close: string | null;
      }[]
    >`
      SELECT name, stage, amount::float8 AS amount, probability::float8 AS probability,
             client_id, to_char(expected_close, 'YYYY-MM-DD') AS expected_close
      FROM ${sch}.sales_opportunity
      WHERE organization_id = ${req.org_id}
        AND stage IN ('lead', 'qualified', 'proposal', 'negotiation')
        ${clientFilter ? sql`AND client_id = ANY(${clientIds})` : sql``}
      ORDER BY amount DESC
      LIMIT 15`;
    if (opps.length) {
      sections.push(
        '## LIVE DATA — sales_opportunity (open pipeline)\n' +
          opps
            .map(
              (o) =>
                `- ${o.name} [${o.stage}] client=${o.client_id} amount=${o.amount} p=${o.probability} close=${o.expected_close ?? 'n/a'}`,
            )
            .join('\n'),
      );
    }
  } else {
    sections.push('## LIVE DATA — sales_opportunity\n(redacted for this access_role)');
  }

  const text = [
    `Org: ${req.org_id}`,
    `Access role: ${req.access_role}`,
    `Client scope: ${clientIds.length ? clientIds.join(', ') : '(all linked)'}`,
    '',
    ...sections,
  ].join('\n\n');

  return {
    ok: true,
    text: text.slice(0, 28_000),
    sections: sections.map((s) => s.split('\n')[0] ?? ''),
  };
}

function jiraStatusFromQuery(query?: string): 'open' | 'done' | 'all' {
  const q = (query ?? '').toLowerCase();
  if (/\b(closed|done|resolved|complete[d]?)\b/.test(q)) return 'done';
  if (/\b(open|active|unresolved|in progress|todo|to do)\b/.test(q)) return 'open';
  return 'all';
}

async function formatLiveJiraSection(
  userId: string | null,
  query?: string,
  accessRole?: AccessRole,
): Promise<string | null> {
  try {
    const access = await resolveJiraForSession(userId);
    if (!access) return null;
    const status = jiraStatusFromQuery(query);
    const raw = await searchRecentIssues(access.creds, {
      projectKey: access.projectKey,
      maxResults: 30,
      status,
    });
    const issues = filterJiraIssuesForRole(raw, accessRole);
    // If user asked for closed and got none, also pull open so the model can say so clearly.
    let extra: JiraIssue[] = [];
    if (status === 'done' && issues.length === 0) {
      const openRaw = await searchRecentIssues(access.creds, {
        projectKey: access.projectKey,
        maxResults: 15,
        status: 'open',
      });
      extra = filterJiraIssuesForRole(openRaw, accessRole);
    }
    if (!issues.length && !extra.length) {
      return `## LIVE DATA — Atlassian Jira (live)\nConnected (${access.source}${access.projectKey ? `, project ${access.projectKey}` : ''}) but no issues matched status=${status} for this access role.`;
    }
    const label =
      status === 'done' ? 'closed/done' : status === 'open' ? 'open' : 'recent';
    const lines = issues.slice(0, 25).map((i) => formatJiraLine(i));
    const extraLines =
      extra.length > 0
        ? `\nNo ${label} issues found. Currently open for reference:\n` +
          extra.slice(0, 15).map((i) => formatJiraLine(i)).join('\n')
        : '';
    return (
      `## LIVE DATA — Atlassian Jira (live)\n` +
      `Source: ${access.source}${access.projectKey ? ` · project ${access.projectKey}` : ''}` +
      `${access.displayName ? ` · ${access.displayName}` : ''} · filter=${label}\n` +
      `Prefer these keys over demo story tickets (H-T*, T-*, etc.).\n` +
      (lines.length ? lines.join('\n') : `(none in ${label})`) +
      extraLines
    );
  } catch (err) {
    log.warn('Live Jira for RAG failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return '## LIVE DATA — Atlassian Jira (live)\n(connector error while fetching issues — check Connectors / Jira credentials)';
  }
}

function formatJiraLine(i: JiraIssue): string {
  return `- ${i.key} [${i.priority ?? 'n/a'}] ${i.status} (${i.issueType}): ${i.summary}${i.assignee ? ` · assignee=${i.assignee}` : ''} · ${i.url}`;
}

async function fetchLiveJiraIssues(userId: string | null): Promise<JiraIssue[]> {
  try {
    const access = await resolveJiraForSession(userId);
    if (!access) return [];
    return await searchRecentIssues(access.creds, {
      projectKey: access.projectKey,
      maxResults: 40,
    });
  } catch (err) {
    log.warn('Jira index fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Documents to upsert into Chroma from live DB + optional Atlassian Jira. */
export async function buildIndexDocuments(
  orgId: string,
  clientIds: string[],
  opts?: { userId?: string },
): Promise<unknown[]> {
  if (getDbState() !== 'up' || !getDb() || !getDrizzle()) return [];
  const story = getDb()!;
  const drizzle = getDrizzle()!;
  const { sql } = story;
  const docs: unknown[] = [];
  const clientFilter = clientIds.length > 0;

  const liveIssues = await fetchLiveJiraIssues(opts?.userId ?? null);
  for (const i of liveIssues) {
    docs.push({
      id: `atlassian:${i.key}`,
      title: `${i.key} ${i.summary}`,
      text: `Live Atlassian Jira issue ${i.key}. Status ${i.status} (${i.statusCategory}), priority ${i.priority ?? 'n/a'}, type ${i.issueType}. Assignee: ${i.assignee ?? 'unassigned'}. Summary: ${i.summary}. URL: ${i.url}`,
      source_type: 'jira',
      org_id: orgId,
      client_id: '',
      date: (i.updated || i.created || '').slice(0, 10) || undefined,
      ticket_id: i.key,
      tags: ['atlassian', 'jira', i.issueType.toLowerCase()],
      access_tier: 'engineering',
    });
  }

  const tickets = await sql<
    {
      id: string;
      client_id: string;
      title: string;
      status: string;
      priority: string;
      tags: string[];
      summary: string | null;
      updated: string;
    }[]
  >`
    SELECT id, client_id, title, status, priority, tags, summary, updated::text
    FROM ${story.table('tickets')}
    WHERE ${clientFilter ? sql`client_id = ANY(${clientIds})` : sql`true`}
    ORDER BY updated DESC
    LIMIT 80`;

  for (const t of tickets) {
    const tier = tierForStoryTicket(t.tags ?? []);
    docs.push({
      id: `db-ticket:${t.id}`,
      title: `${t.id} ${t.title}`,
      text: `DEMO story ticket ${t.id} for client ${t.client_id} (seeded Postgres, not Atlassian). Status ${t.status}, priority ${t.priority}. Tags: ${(t.tags ?? []).join(', ')}. ${t.summary ?? t.title}`,
      source_type: 'ticket',
      org_id: orgId,
      client_id: t.client_id,
      date: t.updated.slice(0, 10),
      ticket_id: t.id,
      tags: [...(t.tags ?? []), 'demo-story'],
      access_tier: tier,
    });
  }

  const meetings = await sql<
    { id: string; client_id: string; title: string; notes: string | null; date: string; kind: string }[]
  >`
    SELECT id, client_id, title, notes, date::text, kind
    FROM ${story.table('meetings')}
    WHERE ${clientFilter ? sql`client_id = ANY(${clientIds})` : sql`true`}
    ORDER BY date DESC
    LIMIT 40`;

  for (const m of meetings) {
    docs.push({
      id: `db-meeting:${m.id}`,
      title: m.title,
      text: `Meeting (${m.kind}) on ${m.date.slice(0, 10)} for client ${m.client_id}. ${m.notes ?? m.title}`,
      source_type: 'mom',
      org_id: orgId,
      client_id: m.client_id,
      date: m.date.slice(0, 10),
      tags: ['meeting', m.kind],
      access_tier: 'public',
    });
  }

  const gmeets = await drizzle
    .select({
      id: googleMeeting.id,
      title: googleMeeting.title,
      startsAt: googleMeeting.startsAt,
      endsAt: googleMeeting.endsAt,
      status: googleMeeting.status,
      meetLink: googleMeeting.meetLink,
      clientId: googleMeeting.clientId,
      attendees: googleMeeting.attendees,
    })
    .from(googleMeeting)
    .where(eq(googleMeeting.organizationId, orgId))
    .orderBy(desc(googleMeeting.startsAt))
    .limit(60);

  for (const m of gmeets) {
    if (clientFilter && m.clientId && !clientIds.includes(m.clientId)) continue;
    const startIso =
      m.startsAt instanceof Date ? m.startsAt.toISOString() : String(m.startsAt);
    const endIso = m.endsAt instanceof Date ? m.endsAt.toISOString() : String(m.endsAt);
    const day = startIso.slice(0, 10);
    const emails = Array.isArray(m.attendees)
      ? m.attendees
          .map((a) =>
            typeof a === 'object' && a && 'email' in a
              ? String((a as { email: unknown }).email)
              : '',
          )
          .filter(Boolean)
          .join(', ')
      : '';
    docs.push({
      id: `gmeet:${m.id}`,
      title: m.title,
      text: [
        `Google Calendar meeting “${m.title}” pinned on ${day}.`,
        `Starts ${startIso}, ends ${endIso}.`,
        `Status: ${m.status}.`,
        m.meetLink ? `Meet link: ${m.meetLink}.` : '',
        emails ? `Attendees: ${emails}.` : '',
        m.clientId ? `Portfolio client: ${m.clientId}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      source_type: 'google_calendar',
      org_id: orgId,
      client_id: m.clientId || '',
      date: day,
      tags: ['meeting', 'google', 'calendar', m.status, day],
      access_tier: 'public',
    });
  }

  const moms = await drizzle
    .select({
      id: meetingMinutes.id,
      title: meetingMinutes.title,
      heldAt: meetingMinutes.heldAt,
      clientId: meetingMinutes.clientId,
      rawText: meetingMinutes.rawText,
      summary: meetingMinutes.summary,
    })
    .from(meetingMinutes)
    .where(eq(meetingMinutes.organizationId, orgId))
    .orderBy(desc(meetingMinutes.heldAt))
    .limit(40);

  for (const m of moms) {
    if (clientFilter && m.clientId && !clientIds.includes(m.clientId)) continue;
    const held =
      m.heldAt instanceof Date
        ? m.heldAt.toISOString().slice(0, 10)
        : String(m.heldAt).slice(0, 10);
    const body = (m.rawText || m.summary || m.title).slice(0, 12_000);
    const management =
      /\b(arr|renewal|discount|pipeline|forecast|quota|upsell)\b/i.test(m.title + ' ' + body);
    docs.push({
      id: `mom:${m.id}`,
      title: m.title,
      text: body,
      source_type: 'mom',
      org_id: orgId,
      client_id: m.clientId,
      date: held,
      tags: ['meeting', 'mom', ...(management ? ['management'] : [])],
      access_tier: management ? 'management' : 'public',
    });
  }

  {
    const sch = sql(env.DB_SCHEMA);
    const opps = await sql<
      {
        id: string;
        client_id: string;
        name: string;
        stage: string;
        amount: number;
        probability: number;
      }[]
    >`
      SELECT id, client_id, name, stage, amount::float8 AS amount, probability::float8 AS probability
      FROM ${sch}.sales_opportunity
      WHERE organization_id = ${orgId}
        ${clientFilter ? sql`AND client_id = ANY(${clientIds})` : sql``}
      ORDER BY amount DESC
      LIMIT 40`;
    for (const o of opps) {
      docs.push({
        id: `sales:${o.id}`,
        title: o.name,
        text: `Sales opportunity “${o.name}” for client ${o.client_id}. Stage ${o.stage}, amount ${o.amount}, probability ${o.probability}. Management-tier pipeline data.`,
        source_type: 'sales',
        org_id: orgId,
        client_id: o.client_id,
        tags: ['sales', 'pipeline', o.stage],
        access_tier: 'management',
      });
    }
  }

  docs.push({
    id: `schema:${orgId}`,
    title: 'Gestalt database schema reference',
    text: [
      'Tables: clients, meetings, google_meeting, meeting_minutes, org_action_item, tickets, usage_daily, tasks, projects, sales_opportunity, communications, people, releases.',
      'google_meeting stores Google Calendar events with pinned starts_at dates and Meet links.',
      'Chat combines vector retrieval with live SQL snapshots for current tickets, calendar meetings, MoM, usage, and overdue tasks.',
      'tickets = demo engineering issues; live Atlassian Jira is a separate connector.',
      'access_tier: public (CS), engineering (Jira/eng tickets), management (sales/renewals).',
    ].join(' '),
    source_type: 'schema',
    org_id: orgId,
    client_id: '',
    tags: ['schema', 'database'],
    access_tier: 'public',
  });

  return docs;
}
