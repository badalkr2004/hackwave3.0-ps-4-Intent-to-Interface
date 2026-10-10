import { daysAgoLabel, formatShortDate } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { CommitmentBadge } from '../ui';

const STATUS_ORDER = { missed: 0, open: 1, done: 2 } as const;

export function LastMeetingRecap({ props, size }: PanelViewProps<'last_meeting_recap'>) {
  const { meeting } = props;
  const commitments = [...props.commitments].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
  const count = (s: keyof typeof STATUS_ORDER) => commitments.filter((c) => c.status === s).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="font-medium text-text">{meeting.title}</span>{' '}
        <span className="text-muted">· {daysAgoLabel(meeting.daysAgo)}</span>
      </p>
      <p className="text-xs text-muted">
        {count('missed')} missed · {count('open')} open · {count('done')} done
      </p>
      {size !== 'S' && (
        <>
          <ul className="flex flex-col gap-2">
            {commitments.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2">
                <span className="text-sm text-text">
                  {c.text}
                  <span className="block text-xs text-muted">Due {formatShortDate(c.due)}</span>
                </span>
                <CommitmentBadge status={c.status} />
              </li>
            ))}
          </ul>
          {meeting.notes && <p className="line-clamp-3 text-xs text-muted">{meeting.notes}</p>}
        </>
      )}
    </div>
  );
}
