import { formatCurrency, inDaysLabel } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { Delta, EmptyState, HealthBadge, Meter } from '../ui';

export function PortfolioHealth({ props, size }: PanelViewProps<'portfolio_health'>) {
  const clients = [...props.clients].sort((a, b) => a.health - b.health);
  if (clients.length === 0) return <EmptyState />;
  const isL = size === 'L';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        <span className="font-medium text-text">
          {props.atRiskCount} of {clients.length}
        </span>{' '}
        clients at risk · {formatCurrency(props.totalArr)} ARR
      </p>
      <ul className="flex flex-col gap-3">
        {clients.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-text">{c.name}</span>
              <HealthBadge health={c.health} />
            </div>
            <Meter
              value={c.health}
              tone={c.health < 60 ? 'danger' : c.health < 75 ? 'warn' : 'success'}
            />
            {isL && (
              <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span>{c.plan}</span>
                <span>{formatCurrency(c.arr)} ARR</span>
                <span className="inline-flex items-center gap-1">
                  Usage <Delta pct={c.usageChangePct} />
                </span>
                {c.renewalInDays !== null && (
                  <span>Renewal {inDaysLabel(c.renewalInDays).toLowerCase()}</span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
