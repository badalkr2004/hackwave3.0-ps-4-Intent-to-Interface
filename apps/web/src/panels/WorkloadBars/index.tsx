import { OctagonAlert } from 'lucide-react';
import type { PanelViewProps } from '../types';
import { Badge, EmptyState, Meter } from '../ui';

const SCALE_MAX = 200;

export function WorkloadBars({ props, size }: PanelViewProps<'workload_bars'>) {
  const people = [...props.people].sort((a, b) => b.capacityPct - a.capacityPct);
  if (people.length === 0) return <EmptyState message="No people in this scope." />;
  const over = people.filter((p) => p.capacityPct > 100);
  const shown = size === 'S' ? people.slice(0, 2) : people;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {over.length === 0 ? (
          'Everyone is within capacity.'
        ) : (
          <>
            <span className="font-medium text-danger">{over.length} over capacity</span>
            {' · '}
            {over.map((p) => p.name.split(' ')[0]).join(', ')}
          </>
        )}
      </p>
      <ul className="flex flex-col gap-3">
        {shown.map((p) => {
          const isOver = p.capacityPct > 100;
          return (
            <li key={p.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-text">
                  {p.name}
                  {size !== 'S' && <span className="text-xs text-muted"> · {p.role}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums text-text">{p.capacityPct}%</span>
                  {isOver && (
                    <Badge tone="danger" icon={OctagonAlert}>
                      Over capacity
                    </Badge>
                  )}
                </span>
              </div>
              <Meter
                value={p.capacityPct}
                max={SCALE_MAX}
                marker={100}
                tone={isOver ? 'danger' : 'accent'}
              />
              {size !== 'S' && (
                <p className="text-xs text-muted">
                  {p.openTasks} open tasks
                  {p.overdueTasks > 0 && (
                    <span className="text-danger"> · {p.overdueTasks} overdue</span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">Vertical line marks 100% capacity.</p>
    </div>
  );
}
