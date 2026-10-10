import type { PanelViewProps } from '../types';
import { EmptyState, PriorityBadge } from '../ui';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function OpenIssues({ props, size }: PanelViewProps<'open_issues'>) {
  const tickets = [...props.tickets].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.ageDays - b.ageDays,
  );
  if (tickets.length === 0) return <EmptyState message="No open issues." />;
  const shown = size === 'S' ? tickets.slice(0, 2) : tickets;
  const multiClient = new Set(tickets.map((t) => t.clientId)).size > 1;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        <span className="font-medium text-text">{props.totalOpen} open</span> · {props.highCount}{' '}
        high priority
      </p>
      <ul className="flex flex-col gap-2">
        {shown.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-sm text-text">
              {t.title}
              <span className="block text-xs text-muted">
                {t.id}
                {multiClient && ` · ${t.clientName}`} · opened {t.ageDays}d ago
                {size !== 'S' && t.tags.length > 0 && ` · ${t.tags.join(', ')}`}
              </span>
            </span>
            <PriorityBadge priority={t.priority} />
          </li>
        ))}
      </ul>
      {size === 'S' && tickets.length > shown.length && (
        <p className="text-xs text-muted">+{tickets.length - shown.length} more</p>
      )}
    </div>
  );
}
