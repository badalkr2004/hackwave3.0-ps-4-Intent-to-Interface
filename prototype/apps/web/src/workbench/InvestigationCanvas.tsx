import { Check, X } from 'lucide-react';
import type { WorkbenchData } from './extract';
import { useTaskState } from './taskState';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export function InvestigationCanvas({ data }: { data: WorkbenchData }) {
  const { hypothesisVerdicts, setHypothesis } = useTaskState();
  const usage = data.usage;
  const release = usage?.releases?.[0];
  const hyps = Array.isArray(data.hypotheses?.hypotheses) ? data.hypotheses.hypotheses : [];
  const tickets = (Array.isArray(data.issues?.tickets) ? data.issues.tickets : []).slice(0, 3);
  const lastSeries = (Array.isArray(usage?.series) ? usage.series : []).slice(-8);

  const chain = [
    {
      id: 'release',
      title: release ? `Release ${release.version}` : 'Release window',
      detail: release
        ? `Shipped ${release.date}${usage?.anomalyStart ? ` · anomaly from ${usage.anomalyStart}` : ''}`
        : 'Looking for correlated release…',
      tone: 'default' as const,
    },
    {
      id: 'metric',
      title: usage ? `${usage.scopeLabel} usage` : 'Usage signal',
      detail:
        usage?.changePct != null
          ? `${usage.changePct > 0 ? '+' : ''}${Math.round(usage.changePct)}% vs baseline — ${usage.summary}`
          : usage?.summary || 'Pulling usage trend…',
      tone: (usage?.changePct != null && usage.changePct < 0 ? 'warn' : 'accent') as 'warn' | 'accent',
    },
    {
      id: 'tickets',
      title: tickets.length ? `${tickets.length} related tickets` : 'Ticket trail',
      detail: tickets.length
        ? tickets.map((t) => t.title).join(' · ')
        : 'No matching open tickets in scope',
      tone: tickets.length ? ('danger' as const) : ('default' as const),
    },
    {
      id: 'comms',
      title: 'Customer signal',
      detail:
        data.comms?.items?.[0]?.snippet ??
        'Comms will fill in as evidence loads',
      tone: 'default' as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Evidence chain</h2>
        <ol className="mt-4 flex flex-col gap-0">
          {chain.map((node, i) => (
            <li key={node.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < chain.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-3 left-[7px] h-[calc(100%-4px)] w-px bg-border"
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 border-bg',
                  node.tone === 'warn' && 'bg-warn',
                  node.tone === 'danger' && 'bg-danger',
                  node.tone === 'accent' && 'bg-accent',
                  node.tone === 'default' && 'bg-border-strong',
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{node.title}</p>
                <p className="mt-0.5 text-13 text-muted">{node.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        {lastSeries.length > 0 && (
          <div className="mt-4 flex h-16 items-end gap-1 rounded-md border border-border bg-bg/50 px-3 py-2">
            {lastSeries.map((p) => {
              const max = Math.max(...lastSeries.map((s) => s.value), 1);
              const h = Math.max(8, Math.round((p.value / max) * 100));
              const broken = usage?.anomalyStart && p.date >= usage.anomalyStart;
              return (
                <div
                  key={p.date}
                  title={`${p.date}: ${p.value}`}
                  className={cn('flex-1 rounded-sm', broken ? 'bg-warn/80' : 'bg-accent/70')}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Hypotheses</h2>
          {data.hypotheses?.generatedWithoutAi && <Badge>Offline draft</Badge>}
        </div>
        {hyps.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Hypotheses appear once diagnosis copy is ready.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {hyps.map((h, i) => {
              const key = `h-${i}`;
              const verdict = hypothesisVerdicts[key] ?? null;
              return (
                <li
                  key={key}
                  className={cn(
                    'rounded-md border p-3 transition-colors',
                    verdict === 'accepted' && 'border-success/50 bg-success-bg/40',
                    verdict === 'rejected' && 'border-border bg-bg/30 opacity-60',
                    !verdict && 'border-border bg-bg/40',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-text">{h.title}</p>
                        <Badge variant={h.confidence === 'high' ? 'accent' : 'default'}>
                          {h.confidence}
                        </Badge>
                      </div>
                      <p className="mt-1 text-13 text-muted">{h.explanation}</p>
                      <p className="mt-2 text-13 text-accent-text">Confirm: {h.howToConfirm}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={verdict === 'accepted' ? 'default' : 'secondary'}
                        onClick={() => setHypothesis(key, 'accepted')}
                      >
                        <Check aria-hidden className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant={verdict === 'rejected' ? 'danger' : 'ghost'}
                        onClick={() => setHypothesis(key, 'rejected')}
                      >
                        <X aria-hidden className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
