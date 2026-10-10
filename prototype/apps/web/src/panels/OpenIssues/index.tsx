import type { PanelViewProps } from '../types';
import { EmptyState, PriorityBadge, TruncatedList } from '../ui';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function OpenIssues({ props, size }: PanelViewProps<'open_issues'>) {
  const tickets = [...props.tickets].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.ageDays - b.ageDays,
  );
  if (tickets.length === 0) return <EmptyState message="No open issues for this scope." />;
  const limit = size === 'S' ? 2 : size === 'M' ? 5 : 12;
  const multiClient = new Set(tickets.map((t) => t.clientId)).size > 1;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        <span className="font-medium tabular text-text">{props.totalOpen} open</span> ·{' '}
        <span className="tabular">{props.highCount}</span> high priority
      </p>
      <TruncatedList
        items={tickets}
        limit={limit}
        label="Open issues"
        keyOf={(t) => t.id}
        renderItem={(t) => (
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-sm text-text">
              {t.title}
              <span className="block text-xs text-muted">
                <span className="font-mono">{t.id}</span>
                {multiClient && ` · ${t.clientName}`} · opened{' '}
                <span className="tabular">{t.ageDays}</span>d ago
                {size !== 'S' && t.tags.length > 0 && ` · ${t.tags.join(', ')}`}
              </span>
            </span>
            <PriorityBadge priority={t.priority} />
          </div>
        )}
      />
    </div>
  );
}
