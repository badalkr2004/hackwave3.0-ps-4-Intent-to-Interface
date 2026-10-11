import { capabilitiesFor, filterJiraIssuesForRole } from '../services/accessPolicy';
import { resolveJiraForSession } from '../services/connectors';
import { searchRecentIssues } from '../services/jira';
import { clamp01, defineModule } from './types';

/** Minimum open issues before the panel bids for space (unless focused — handled in compose). */
const MIN_OPEN_TO_BID = 1;

export default defineModule({
  id: 'jira_tickets',
  async loader(ctx) {
    const caps = capabilitiesFor(ctx.accessRole);
    if (!caps.jiraLive) return null;

    const access = await resolveJiraForSession(ctx.userId);
    if (!access) return null;

    const raw = await searchRecentIssues(access.creds, {
      projectKey: access.projectKey,
      maxResults: 20,
    });
    const issues = filterJiraIssuesForRole(raw, ctx.accessRole);
    const open = issues.filter((i) => i.statusCategory !== 'done');
    // Insufficient signal → sit out of the auction (compose can still force-focus).
    if (open.length < MIN_OPEN_TO_BID && issues.length === 0) return null;

    const highCount = open.filter((i) => /highest|high|critical/i.test(i.priority ?? '')).length;

    return {
      connected: true,
      baseUrl: access.creds.baseUrl,
      projectKey: access.projectKey ?? null,
      displayName: access.displayName ?? null,
      issues,
      total: issues.length,
      openCount: open.length,
      highCount,
      focused: false,
    };
  },
  signal: (p) => {
    if (!p.connected || p.total === 0) return 0;
    const openShare = p.openCount / Math.max(p.total, 1);
    const highShare = p.openCount ? p.highCount / p.openCount : 0;
    // Enough open work → compete; a few high-priority tickets raise urgency.
    const base = 0.35 + 0.4 * openShare + 0.25 * highShare;
    return clamp01(p.focused ? Math.max(base, 0.95) : base);
  },
  evidence: (p) => {
    const lines = [
      `${p.openCount} open Jira issue${p.openCount === 1 ? '' : 's'}${
        p.projectKey ? ` in ${p.projectKey}` : ''
      }`,
    ];
    if (p.highCount > 0) lines.push(`${p.highCount} high / critical priority`);
    const top = p.issues.find((i) => i.statusCategory !== 'done');
    if (top) lines.push(`Latest: ${top.key} — ${top.summary}`);
    return lines;
  },
});
