import type { WorkbenchData } from './extract';
import { Badge } from '../components/ui/badge';
import { formatCurrency } from '../lib/format';

export function OverviewCanvas({
  data,
  onPrompt,
}: {
  data: WorkbenchData;
  onPrompt: (text: string) => void;
}) {
  const portfolio = data.portfolio;
  const meetings = (Array.isArray(data.meetings?.meetings) ? data.meetings.meetings : []).slice(
    0,
    4,
  );
  const overdue = data.overdue;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl text-text">Your workspace</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Start from a generic overview. State a goal and the workbench reshapes into prep,
          investigation, or triage — with actions that move the work forward.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'Prepare me for the Acme meeting tomorrow',
            'Why did Acme usage drop?',
            'Show me everything overdue',
          ].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPrompt(p)}
              className="rounded-md border border-border bg-bg/50 px-3 py-2 text-13 text-muted transition-colors hover:border-accent/40 hover:text-text"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Portfolio ARR"
          value={portfolio ? formatCurrency(portfolio.totalArr) : '—'}
          hint={
            portfolio
              ? `${Array.isArray(portfolio.clients) ? portfolio.clients.length : 0} accounts`
              : 'Loading…'
          }
        />
        <StatCard
          label="At risk"
          value={portfolio ? String(portfolio.atRiskCount) : '—'}
          hint="Accounts needing attention"
          warn={(portfolio?.atRiskCount ?? 0) > 0}
        />
        <StatCard
          label="Overdue"
          value={overdue ? String(overdue.overdueCount) : '—'}
          hint={overdue?.scopeLabel ?? 'Across projects'}
          warn={(overdue?.overdueCount ?? 0) > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-13 font-medium tracking-wide text-muted uppercase">Upcoming</h3>
          {meetings.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No meetings in the near window.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-text">
                    {m.clientName} · {m.title}
                  </span>
                  <Badge>in {Math.max(0, Math.round(m.inHours))}h</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-13 font-medium tracking-wide text-muted uppercase">Accounts</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {(Array.isArray(portfolio?.clients) ? portfolio.clients : []).slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text">{c.name}</span>
                <Badge variant={c.health < 60 ? 'danger' : 'default'}>
                  {Math.round(c.health)} health
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-13 text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl tabular ${warn ? 'text-warn' : 'text-text'}`}>
        {value}
      </p>
      <p className="mt-1 text-13 text-muted">{hint}</p>
    </article>
  );
}
