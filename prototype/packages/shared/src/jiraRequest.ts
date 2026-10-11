/**
 * Detects asks about Jira / Atlassian tickets so compose can boost the
 * jira_tickets registry module into the auction.
 */
export function parseJiraRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\bjira\b/i.test(t) ||
    /\batlassian\b/i.test(t) ||
    /\b(kanban|sprint board)\b/i.test(t) ||
    /\bjira[\s-]*(tickets?|issues?)\b/i.test(t)
  );
}

export function jiraHeadline(): string {
  return 'Jira tickets';
}

export function jiraSummary(): string {
  return 'Recent Jira issues from your connected site, ready to review, create, or resolve.';
}
