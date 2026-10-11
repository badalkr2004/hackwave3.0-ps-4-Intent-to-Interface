import { buildAnalyticsReport } from './analytics';
import { listActionItems } from './orgActions';
import { listClientsForOrg, listMom, requireMember } from './orgs';
import { listGoogleMeetings } from './googleMeet';
import { jiraCredentialsForUser } from './connectors';
import { searchRecentIssues } from './jira';

export type IntentReport = {
  intent: string;
  organizationId: string;
  generatedAt: string;
  summary: string;
  sections: Record<string, unknown>;
};

/**
 * Intent-oriented org report for MCP clients.
 * Uses the token's bound org + membership; pulls the relevant slices of org data.
 */
export async function buildOrgIntentReport(
  userId: string,
  organizationId: string,
  intent: string,
): Promise<IntentReport> {
  await requireMember(userId, organizationId);
  const q = intent.trim().toLowerCase() || 'overview';
  const want = (keys: string[]) => keys.some((k) => q.includes(k));

  const sections: Record<string, unknown> = {};
  const notes: string[] = [];

  const includeAll =
    want(['overview', 'full', 'everything', 'all', 'report', 'summary']) || q.length < 8;

  if (includeAll || want(['client', 'portfolio', 'account', 'customer'])) {
    sections.clients = await listClientsForOrg(organizationId, userId);
    notes.push('portfolio clients');
  }

  if (includeAll || want(['mom', 'minutes', 'meeting notes', 'decision'])) {
    const moms = await listMom(organizationId, userId, 8);
    sections.meetingMinutes = moms.map((m) => ({
      id: m.id,
      title: m.title,
      heldAt: m.heldAt,
      clientId: m.clientId,
      summary: m.summary?.slice(0, 800),
      decisions: m.decisions,
      actionItemCount: Array.isArray(m.actionItems) ? m.actionItems.length : 0,
    }));
    notes.push('meeting minutes');
  }

  if (includeAll || want(['action', 'todo', 'commitment', 'sla', 'overdue', 'task'])) {
    const status = want(['open', 'overdue', 'todo'])
      ? 'open'
      : want(['done', 'closed'])
        ? 'done'
        : 'all';
    sections.actionItems = await listActionItems(organizationId, userId, {
      status: status as 'open' | 'done' | 'missed' | 'all',
    });
    notes.push('action items');
  }

  if (includeAll || want(['analytics', 'pipeline', 'sales', 'forecast', 'kpi', 'marketing'])) {
    sections.analytics = await buildAnalyticsReport(organizationId, userId, { range: '90d' });
    notes.push('analytics');
  }

  if (includeAll || want(['meet', 'calendar', 'schedule', 'google'])) {
    try {
      sections.googleMeetings = await listGoogleMeetings(userId);
      notes.push('google meetings');
    } catch (e) {
      sections.googleMeetingsError = e instanceof Error ? e.message : 'unavailable';
    }
  }

  if (includeAll || want(['jira', 'ticket', 'issue', 'bug'])) {
    try {
      const { creds, projectKey } = await jiraCredentialsForUser(userId);
      sections.jiraIssues = await searchRecentIssues(creds, {
        projectKey,
        maxResults: 15,
      });
      notes.push('jira issues');
    } catch (e) {
      sections.jiraError = e instanceof Error ? e.message : 'unavailable';
    }
  }

  if (Object.keys(sections).length === 0) {
    sections.clients = await listClientsForOrg(organizationId, userId);
    sections.actionItems = await listActionItems(organizationId, userId, { status: 'open' });
    notes.push('default clients + open action items');
  }

  return {
    intent: intent.trim() || 'overview',
    organizationId,
    generatedAt: new Date().toISOString(),
    summary: `Org report for “${intent.trim() || 'overview'}” including: ${notes.join(', ')}.`,
    sections,
  };
}
