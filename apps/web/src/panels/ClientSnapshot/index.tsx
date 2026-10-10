import { formatCurrency, inDaysLabel } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { Delta, HealthBadge, SentimentBadge, Stat } from '../ui';

export function ClientSnapshot({ props, size }: PanelViewProps<'client_snapshot'>) {
  const { client } = props;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-medium text-text">{client.name}</p>
        <HealthBadge health={client.health} />
      </div>
      <p className="text-xs text-muted">
        {client.plan} · {formatCurrency(client.arr)} ARR
        {client.renewalInDays !== null &&
          ` · Renewal ${inDaysLabel(client.renewalInDays).toLowerCase()}`}
      </p>
      {size !== 'S' && (
        <dl className="grid grid-cols-2 gap-3">
          {client.contactName && (
            <Stat label="Main contact">
              {client.contactName}
              {client.contactTitle && (
                <span className="block text-xs text-muted">{client.contactTitle}</span>
              )}
            </Stat>
          )}
          <Stat label="Open tickets">
            {props.openTickets}
            {props.highPriorityTickets > 0 && (
              <span className="text-xs text-muted"> ({props.highPriorityTickets} high)</span>
            )}
          </Stat>
          <Stat label="Usage vs baseline">
            <Delta pct={props.usageChangePct} />
          </Stat>
          <Stat label="Recent sentiment">
            {props.recentSentiment === null ? (
              'No data'
            ) : (
              <SentimentBadge value={props.recentSentiment} />
            )}
          </Stat>
        </dl>
      )}
    </div>
  );
}
