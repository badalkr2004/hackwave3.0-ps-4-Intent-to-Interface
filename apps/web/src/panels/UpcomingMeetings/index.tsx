import { CalendarClock } from 'lucide-react';
import { capitalize, meetingWhen } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { Badge, EmptyState } from '../ui';

export function UpcomingMeetings({ props, size }: PanelViewProps<'upcoming_meetings'>) {
  const meetings = [...props.meetings].sort((a, b) => a.inHours - b.inHours);
  if (meetings.length === 0) return <EmptyState message="No meetings coming up." />;
  const shown = size === 'S' ? meetings.slice(0, 1) : meetings.slice(0, 5);

  return (
    <ul className="flex flex-col gap-3">
      {shown.map((m) => (
        <li key={m.id} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">{m.title}</span>
            {m.inHours >= 0 && m.inHours <= 48 && (
              <Badge tone="warn" icon={CalendarClock}>
                Within 48h
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted">
            {m.clientName} · {m.kind === 'qbr' ? 'QBR' : capitalize(m.kind)} ·{' '}
            {meetingWhen(m.startsAt, m.inHours)}
          </p>
        </li>
      ))}
      {size === 'S' && meetings.length > 1 && (
        <li className="text-xs text-muted">+{meetings.length - 1} more this week</li>
      )}
    </ul>
  );
}
