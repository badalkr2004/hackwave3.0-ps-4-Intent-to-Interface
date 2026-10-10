import { useMemo } from 'react';
import type { PanelProps } from '@gestalt/shared';
import { overdueLabel } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { EmptyState, TaskStatusBadge } from '../ui';

type Task = PanelProps<'blocker_chain'>['tasks'][number];

/** Groups tasks into columns by dependency depth (0 = no in-set dependencies). */
function layer(tasks: Task[]): Task[][] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  const visit = (t: Task, seen: Set<string>): number => {
    const known = depth.get(t.id);
    if (known !== undefined) return known;
    if (seen.has(t.id)) return 0;
    seen.add(t.id);
    const deps = t.dependsOn.map((id) => byId.get(id)).filter((d): d is Task => !!d);
    const d = deps.length ? 1 + Math.max(...deps.map((x) => visit(x, seen))) : 0;
    depth.set(t.id, d);
    return d;
  };
  tasks.forEach((t) => visit(t, new Set()));
  const cols: Task[][] = [];
  for (const t of tasks) (cols[depth.get(t.id) ?? 0] ??= []).push(t);
  return cols.map((c) => c.sort((a, b) => a.id.localeCompare(b.id)));
}

function summarize(tasks: Task[]): string {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    if (t.status !== 'blocked') continue;
    const late = t.dependsOn.map((id) => byId.get(id)).find((d) => d && d.overdueDays > 0);
    if (late)
      return `${t.id} is blocked by ${late.id}, which is ${overdueLabel(late.overdueDays)}.`;
  }
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  return blocked
    ? `${blocked} blocked ${blocked === 1 ? 'task' : 'tasks'}.`
    : 'Nothing is blocked.';
}

function Connector() {
  return (
    <svg aria-hidden viewBox="0 0 24 12" className="w-6 shrink-0 self-center text-border-strong">
      <path d="M0 6h20m-5-4 5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function BlockerChain({ props, size }: PanelViewProps<'blocker_chain'>) {
  const linked = useMemo(() => {
    const dependedOn = new Set(props.tasks.flatMap((t) => t.dependsOn));
    return size === 'L'
      ? props.tasks
      : props.tasks.filter((t) => t.dependsOn.length > 0 || dependedOn.has(t.id));
  }, [props.tasks, size]);
  const columns = useMemo(() => layer(linked), [linked]);
  if (linked.length === 0) return <EmptyState message="No task dependencies in this scope." />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text">
        {summarize(props.tasks)} <span className="text-muted">· {props.projectName}</span>
      </p>
      <div
        role="region"
        aria-label="Dependency chain, scroll horizontally"
        tabIndex={0}
        className="overflow-x-auto pb-1"
      >
        <ol
          aria-label="Dependency chain, left to right"
          className="flex min-w-max items-stretch gap-1"
        >
          {columns.map((col, i) => (
            <li key={i} className="flex items-stretch gap-1">
              {i > 0 && <Connector />}
              <div className="flex w-44 flex-col justify-center">
                <ul className="flex flex-col gap-2">
                  {col.map((t) => (
                    <li
                      key={t.id}
                      className={`rounded-md border p-2 text-sm ${t.status === 'blocked' ? 'border-danger' : t.overdueDays > 0 ? 'border-warn' : 'border-border'}`}
                    >
                      <p className="text-xs text-muted">{t.id}</p>
                      <p className="font-medium text-text">{t.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <TaskStatusBadge status={t.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {t.ownerName ?? 'Unassigned'}
                        {t.overdueDays > 0 && (
                          <span className="text-danger"> · {overdueLabel(t.overdueDays)}</span>
                        )}
                      </p>
                      {t.dependsOn.length > 0 && (
                        <p className="mt-1 text-xs text-muted">Waits on {t.dependsOn.join(', ')}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
