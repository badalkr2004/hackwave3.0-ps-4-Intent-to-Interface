import { Check, Circle } from 'lucide-react';
import type { WorkbenchData } from './extract';
import { useTaskState } from './taskState';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/format';

export function MeetingBriefCanvas({ data }: { data: WorkbenchData }) {
  const { checkedPoints, togglePoint } = useTaskState();
  const client = data.client?.client;
  const points = Array.isArray(data.talkingPoints?.points) ? data.talkingPoints.points : [];
  const openCommitments = (
    Array.isArray(data.lastMeeting?.commitments) ? data.lastMeeting.commitments : []
  ).filter((c) => c.status === 'open');
  const topIssues = (Array.isArray(data.issues?.tickets) ? data.issues.tickets : []).slice(0, 4);
  const recentComms = (Array.isArray(data.comms?.items) ? data.comms.items : []).slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Client brief</h2>
          {client ? (
            <div className="mt-3">
              <p className="font-display text-xl text-text">{client.name}</p>
              <p className="mt-1 text-sm text-muted">
                {client.plan} · {formatCurrency(client.arr)} ARR
                {client.contactName ? ` · ${client.contactName}` : ''}
                {client.contactTitle ? `, ${client.contactTitle}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant={client.health < 60 ? 'danger' : 'success'}>
                  Health {Math.round(client.health)}
                </Badge>
                {data.client?.usageChangePct != null && (
                  <Badge variant={data.client.usageChangePct < 0 ? 'warn' : 'accent'}>
                    Usage {data.client.usageChangePct > 0 ? '+' : ''}
                    {Math.round(data.client.usageChangePct)}%
                  </Badge>
                )}
                {(data.client?.highPriorityTickets ?? 0) > 0 && (
                  <Badge variant="danger">{data.client!.highPriorityTickets} high tickets</Badge>
                )}
                {client.renewalInDays != null && (
                  <Badge>Renewal in {client.renewalInDays}d</Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No client in scope — ask with a client name.</p>
          )}

          {data.lastMeeting && (
            <>
              <Separator className="my-4" />
              <h3 className="text-sm font-medium text-text">Last meeting</h3>
              <p className="mt-1 text-sm text-muted">
                {data.lastMeeting.meeting.title} · {data.lastMeeting.meeting.daysAgo}d ago
              </p>
              {data.lastMeeting.meeting.notes && (
                <p className="mt-2 text-sm text-text/90">{data.lastMeeting.meeting.notes}</p>
              )}
              {openCommitments.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {openCommitments.map((c) => (
                    <li key={c.id} className="text-13 text-warn">
                      Open: {c.text}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Talk track</h2>
            <Badge variant="accent">
              {points.filter((_, i) => checkedPoints[`tp-${i}`]).length}/{points.length} covered
            </Badge>
          </div>
          {points.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Talking points will appear as the workspace finishes writing.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {points.map((p, i) => {
                const key = `tp-${i}`;
                const on = Boolean(checkedPoints[key]);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => togglePoint(key)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                        on
                          ? 'border-accent/40 bg-accent-bg/40'
                          : 'border-border bg-bg/40 hover:border-border-strong',
                      )}
                    >
                      {on ? (
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      ) : (
                        <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                      )}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant={p.type === 'risk' ? 'warn' : 'default'}>{p.type}</Badge>
                          <span className={cn('text-sm font-medium', on && 'text-accent-text')}>
                            {p.headline}
                          </span>
                        </span>
                        <span className="mt-1 block text-13 text-muted">{p.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Risks to raise</h2>
          {topIssues.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No open issues in scope.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {topIssues.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-text">{t.title}</span>
                  <Badge variant={t.priority === 'high' ? 'danger' : 'default'}>{t.priority}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Recent signals</h2>
          {recentComms.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No recent communication loaded.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {recentComms.map((c) => (
                <li key={c.id}>
                  <p className="text-13 text-muted">
                    {c.channel} · {c.daysAgo}d · {c.sender}
                  </p>
                  <p className="text-sm text-text">{c.subject || c.snippet}</p>
                </li>
              ))}
            </ul>
          )}
          {points.some((p) => p.type === 'ask') && (
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const idx = points.findIndex((p) => p.type === 'ask');
                  if (idx >= 0) togglePoint(`tp-${idx}`);
                }}
              >
                Mark first ask as covered
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
