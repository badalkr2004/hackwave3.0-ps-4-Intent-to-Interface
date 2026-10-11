import { useState, type FormEvent } from 'react';
import { Check, ExternalLink, LoaderCircle, Plus } from 'lucide-react';
import {
  createJiraIssue,
  resolveJiraIssue,
  type JiraIssue,
} from '../../lib/connectorsApi';
import type { PanelViewProps } from '../types';
import { EmptyState } from '../ui';

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

export function JiraTicketsPanel({ props, size }: PanelViewProps<'jira_tickets'>) {
  const [issues, setIssues] = useState(props.issues);
  const [openCount, setOpenCount] = useState(props.openCount);
  const [resolving, setResolving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(Boolean(props.focused && size !== 'S'));
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!props.connected) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState message="Jira is not connected for this workspace." />
        <a
          href="/connectors"
          className="inline-flex min-h-10 w-fit items-center rounded-md border border-border px-3 text-sm text-accent-text hover:bg-surface-2"
        >
          Open Connectors
        </a>
      </div>
    );
  }

  const limit = size === 'S' ? 3 : size === 'M' ? 6 : 12;
  const shown = issues.slice(0, limit);

  const onResolve = async (issue: JiraIssue) => {
    setResolving(issue.key);
    setError(null);
    setNotice(null);
    try {
      const r = await resolveJiraIssue(issue.key);
      setIssues((prev) =>
        prev.map((i) =>
          i.key === issue.key
            ? { ...i, status: r.status, statusCategory: 'done' }
            : i,
        ),
      );
      setOpenCount((n) => Math.max(0, n - 1));
      setNotice(`${r.key} → ${r.status}`);
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
        projectKey: props.projectKey ?? undefined,
      });
      setIssues((prev) => [issue, ...prev]);
      setOpenCount((n) => n + 1);
      setSummary('');
      setNotice(`Created ${issue.key}`);
      if (size === 'S') setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create issue');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          <span className="font-medium tabular text-text">{openCount} open</span>
          {props.highCount > 0 && (
            <>
              {' '}
              · <span className="tabular">{props.highCount}</span> high
            </>
          )}
          {props.projectKey && <> · {props.projectKey}</>}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-text hover:bg-surface-2"
          >
            <Plus className="size-3.5" aria-hidden />
            New
          </button>
          <a
            href="/connectors"
            className="text-xs text-accent-text hover:underline"
          >
            Manage
          </a>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={(e) => void onCreate(e)} className="flex flex-col gap-2 border-t border-border pt-3">
          <input
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="New issue summary"
            className="min-h-10 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={creating || !summary.trim()}
            className="inline-flex min-h-9 w-fit items-center gap-1.5 bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-50"
          >
            {creating ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Create in Jira
          </button>
        </form>
      )}

      {notice && <p className="text-xs text-success">{notice}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <EmptyState message="No recent Jira tickets for this project." />
      ) : (
        <ul className="flex flex-col gap-2.5" aria-label="Jira issues">
          {shown.map((issue) => {
            const isDone = issue.statusCategory === 'done';
            return (
              <li key={issue.id} className="flex items-start justify-between gap-2">
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
                    <span className="mx-1 text-muted">·</span>
                    {issue.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {issue.status}
                    {issue.priority ? ` · ${issue.priority}` : ''}
                    {issue.updated ? ` · ${relativeTime(issue.updated)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-8 items-center px-1.5 text-muted hover:text-text"
                    aria-label={`Open ${issue.key}`}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                  {!isDone && size !== 'S' && (
                    <button
                      type="button"
                      disabled={resolving === issue.key}
                      onClick={() => void onResolve(issue)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
                    >
                      {resolving === issue.key ? (
                        <LoaderCircle className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3 text-success" />
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
