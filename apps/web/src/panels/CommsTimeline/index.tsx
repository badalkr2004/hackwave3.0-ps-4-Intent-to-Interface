import { ArrowDownLeft, ArrowUpRight, Hash, Mail } from 'lucide-react';
import { daysAgoLabel } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { EmptyState, SentimentBadge } from '../ui';

export function CommsTimeline({ props, size }: PanelViewProps<'comms_timeline'>) {
  const items = [...props.items].sort((a, b) => a.daysAgo - b.daysAgo);
  if (items.length === 0) return <EmptyState message="No recent communication." />;
  const shown = size === 'S' ? items.slice(0, 2) : items;

  return (
    <ol className="flex flex-col gap-3 border-l border-border pl-3">
      {shown.map((c) => {
        const Channel = c.channel === 'email' ? Mail : Hash;
        const Direction = c.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={c.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Channel aria-hidden className="size-3.5" />
                <span className="sr-only">{c.channel === 'email' ? 'Email' : 'Slack'}</span>
                <Direction aria-hidden className="size-3.5" />
                <span className="font-medium text-text">{c.sender}</span>
                <span>
                  · {c.direction === 'inbound' ? 'received' : 'sent'}{' '}
                  {daysAgoLabel(c.daysAgo).toLowerCase()}
                </span>
              </span>
              <SentimentBadge value={c.sentiment} />
            </div>
            {c.subject && size !== 'S' && (
              <p className="text-xs font-medium text-text">{c.subject}</p>
            )}
            <p className="text-sm text-text">{c.snippet}</p>
          </li>
        );
      })}
    </ol>
  );
}
