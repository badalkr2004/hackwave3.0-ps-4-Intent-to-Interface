import { useEffect, useState, type FormEvent } from 'react';
import { Check, ExternalLink, LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import {
  createJiraIssue,
  fetchJiraIssues,
  resolveJiraIssue,
  type JiraIssue,
} from '../lib/connectorsApi';

function relativeTime(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 60) return `${Math.max(0, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function JiraTickets({
  compact = false,
  projectKey,
  readOnly = false,
}: {
  compact?: boolean;
  projectKey?: string;
  /** Hide create / resolve when the access role cannot write connectors. */
  readOnly?: boolean;
}) {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [showCreate, setShowCreate] = useState(!compact && !readOnly);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJiraIssues(compact ? 6 : 20);
      setIssues(data.issues);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const onResolve = async (issue: JiraIssue) => {
    setResolving(issue.key);
    setError(null);
    setNotice(null);
    try {
      const r = await resolveJiraIssue(issue.key);
      setNotice(`${r.key} → ${r.status}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve');
    } finally {
      setResolving(null);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const { issue } = await createJiraIssue({
        summary: summary.trim(),
        description: description.trim() || undefined,
        projectKey: projectKey || undefined,
      });
      setSummary('');
      setDescription('');
      setNotice(`Created ${issue.key}`);
      if (compact) setShowCreate(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create issue');
    } finally {
      setCreating(false);
    }
  };

  const openIssues = issues.filter((i) => i.statusCategory !== 'done');
  const shown = compact ? openIssues.slice(0, 5) : issues;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={`font-display text-text ${compact ? 'text-lg' : 'text-xl'}`}>
            Jira tickets
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {projectKey ? `Project ${projectKey} · ` : ''}
            Recent issues from your connected site
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compact && !readOnly && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
            >
              <Plus className="size-3.5" aria-hidden />
              New
            </button>
          )}
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {showCreate && !readOnly && (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="flex flex-col gap-3 border-t border-border pt-4"
        >
          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Summary
            <input
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short issue title"
              className="mt-1.5 min-h-11 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          {!compact && (
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional context"
                className="mt-1.5 w-full resize-y border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={creating || !summary.trim()}
            className="inline-flex min-h-11 w-fit items-center gap-2 bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create ticket
          </button>
        </form>
      )}

      {notice && (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading && issues.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading tickets…
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">
          {readOnly ? 'No recent tickets in your access scope.' : 'No recent tickets. Create one above.'}
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border" aria-label="Jira issues">
          {shown.map((issue) => {
            const isDone = issue.statusCategory === 'done';
            return (
              <li key={issue.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-text">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-accent-text hover:underline"
                    >
                      {issue.key}
                    </a>
                    <span className="mx-1.5 text-muted">·</span>
                    {issue.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {issue.status}
                    {issue.priority ? ` · ${issue.priority}` : ''}
                    {issue.assignee ? ` · ${issue.assignee}` : ' · Unassigned'}
                    {issue.updated ? ` · ${relativeTime(issue.updated)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 px-2 text-xs text-muted hover:text-text"
                    aria-label={`Open ${issue.key} in Jira`}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Open
                  </a>
                  {!readOnly && !isDone && (
                    <button
                      type="button"
                      disabled={resolving === issue.key}
                      onClick={() => void onResolve(issue)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-text hover:bg-surface-2 disabled:opacity-50"
                    >
                      {resolving === issue.key ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5 text-success" />
                      )}
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
