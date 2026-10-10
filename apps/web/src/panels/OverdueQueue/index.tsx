import { formatShortDate, overdueLabel } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { EmptyState, TaskStatusBadge, TruncatedList } from '../ui';

export function OverdueQueue({ props, size }: PanelViewProps<'overdue_queue'>) {
  const tasks = [...props.tasks].sort(
    (a, b) => b.overdueDays - a.overdueDays || a.id.localeCompare(b.id),
  );
  if (tasks.length === 0) return <EmptyState message="Nothing is overdue. Nice." />;

  const header = (
    <p className="text-sm text-muted">
      <span className="font-medium text-danger">{props.overdueCount} overdue</span> ·{' '}
      {props.scopeLabel}
    </p>
  );

  if (size === 'S') {
    const top = tasks[0]!;
    return (
      <div className="flex flex-col gap-2">
        {header}
        <p className="text-sm text-text">
          Most late: {top.title}{' '}
          <span className="text-muted">({overdueLabel(top.overdueDays)})</span>
        </p>
      </div>
    );
  }

  if (size === 'M') {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <TruncatedList
          items={tasks}
          limit={6}
          label="Overdue work"
          keyOf={(t) => t.id}
          renderItem={(t) => (
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm text-text">
                {t.title}
                <span className="block text-xs text-muted">
                  {t.projectName} · {t.ownerName ?? 'Unassigned'} ·{' '}
                  <span className="text-danger">{overdueLabel(t.overdueDays)}</span>
                </span>
              </span>
              <TaskStatusBadge status={t.status} />
            </div>
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Overdue tasks, most overdue first</caption>
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">
                Task
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Owner
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Due
              </th>
              <th scope="col" className="py-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-3 font-normal text-text">
                  {t.title}
                  <span className="block text-xs text-muted">
                    {t.id} · {t.projectName}
                  </span>
                </th>
                <td className="py-2 pr-3 text-text">{t.ownerName ?? 'Unassigned'}</td>
                <td className="py-2 pr-3">
                  <span className="text-text">{formatShortDate(t.due)}</span>
                  <span className="block text-xs text-danger">{overdueLabel(t.overdueDays)}</span>
                </td>
                <td className="py-2">
                  <TaskStatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
