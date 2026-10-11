import type { ReactNode } from 'react';
import { Ban, Clock3 } from 'lucide-react';
import type { WorkbenchData } from './extract';
import { useTaskState } from './taskState';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export function TriageCanvas({ data }: { data: WorkbenchData }) {
  const { snoozedTasks, clearedBlockers, snoozeTask, clearBlocker } = useTaskState();
  const overdueList = Array.isArray(data.overdue?.tasks) ? data.overdue.tasks : [];
  const blockerList = Array.isArray(data.blockers?.tasks) ? data.blockers.tasks : [];
  const tasks = overdueList.filter((t) => !snoozedTasks[t.id]);
  const blocked = blockerList.filter((t) => t.status === 'blocked' && !clearedBlockers[t.id]);
  const canWait = overdueList.filter((t) => snoozedTasks[t.id]);
  const people = Array.isArray(data.workload?.people) ? data.workload.people : [];

  const dueNow = tasks.filter((t) => t.overdueDays >= 3 || t.status === 'blocked');
  const soon = tasks.filter((t) => !dueNow.includes(t));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Badge variant="danger">{dueNow.length} due now</Badge>
        <Badge variant="warn">{blocked.length} blocked</Badge>
        <Badge>{soon.length} in queue</Badge>
        <Badge variant="success">{canWait.length} snoozed</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <QueueColumn
          title="Blocked"
          empty="No blockers on the path"
          tone="danger"
        >
          {blocked.map((t) => (
            <article key={t.id} className="rounded-md border border-danger/30 bg-danger-bg/30 p-3">
              <p className="text-sm font-medium text-text">{t.title}</p>
              <p className="mt-1 text-13 text-muted">
                {t.ownerName ?? 'Unowned'} · {t.overdueDays}d overdue
              </p>
              <Button size="sm" className="mt-3" variant="secondary" onClick={() => clearBlocker(t.id)}>
                <Ban aria-hidden className="size-3.5" />
                Mark unblocked
              </Button>
            </article>
          ))}
        </QueueColumn>

        <QueueColumn title="Due now" empty="Nothing burning" tone="warn">
          {dueNow.map((t) => (
            <article key={t.id} className="rounded-md border border-border bg-bg/40 p-3">
              <p className="text-sm font-medium text-text">{t.title}</p>
              <p className="mt-1 text-13 text-muted">
                {t.projectName} · {t.ownerName ?? 'Unowned'} · {t.overdueDays}d
              </p>
              <Button size="sm" className="mt-3" variant="ghost" onClick={() => snoozeTask(t.id)}>
                <Clock3 aria-hidden className="size-3.5" />
                Snooze
              </Button>
            </article>
          ))}
        </QueueColumn>

        <QueueColumn title="Can wait" empty="Queue is clean" tone="default">
          {[...soon, ...canWait].map((t) => (
            <article
              key={t.id}
              className={cn(
                'rounded-md border border-border p-3',
                snoozedTasks[t.id] ? 'bg-success-bg/20 opacity-70' : 'bg-bg/40',
              )}
            >
              <p className="text-sm font-medium text-text">{t.title}</p>
              <p className="mt-1 text-13 text-muted">
                {t.projectName} · {t.overdueDays}d
              </p>
              {!snoozedTasks[t.id] && (
                <Button size="sm" className="mt-3" variant="ghost" onClick={() => snoozeTask(t.id)}>
                  <Clock3 aria-hidden className="size-3.5" />
                  Snooze
                </Button>
              )}
            </article>
          ))}
        </QueueColumn>
      </div>

      {people.length > 0 && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Workload</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <li key={p.id} className="rounded-md border border-border bg-bg/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text">{p.name}</p>
                  <Badge variant={p.capacityPct >= 90 ? 'danger' : p.capacityPct >= 75 ? 'warn' : 'default'}>
                    {Math.round(p.capacityPct)}%
                  </Badge>
                </div>
                <p className="mt-1 text-13 text-muted">
                  {p.role} · {p.openTasks} open · {p.overdueTasks} overdue
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      p.capacityPct >= 90 ? 'bg-danger' : p.capacityPct >= 75 ? 'bg-warn' : 'bg-accent',
                    )}
                    style={{ width: `${Math.min(100, p.capacityPct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QueueColumn({
  title,
  empty,
  tone,
  children,
}: {
  title: string;
  empty: string;
  tone: 'danger' | 'warn' | 'default';
  children: ReactNode;
}) {
  const count = Array.isArray(children)
    ? children.filter(Boolean).length
    : children
      ? 1
      : 0;
  return (
    <section className="flex min-h-48 flex-col rounded-lg border border-border bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-13 font-medium tracking-wide text-muted uppercase">{title}</h2>
        <Badge variant={tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'default'}>
          {count}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {count === 0 ? <p className="text-sm text-muted">{empty}</p> : children}
      </div>
    </section>
  );
}
