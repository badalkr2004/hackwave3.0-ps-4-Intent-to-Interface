import { Calendar, Sparkles, X } from 'lucide-react';

export interface MeetingAlertProps {
  meeting: {
    title: string;
    clientName: string;
    inHours: number;
    clientId: string;
  };
  onPrep: () => void;
  onDismiss: () => void;
}

export function MeetingAlertBanner({ meeting, onPrep, onDismiss }: MeetingAlertProps) {
  const timeLabel =
    meeting.inHours <= 1
      ? 'starting soon'
      : meeting.inHours <= 24
        ? `in ~${Math.round(meeting.inHours)}h`
        : 'tomorrow';

  return (
    <aside
      aria-label="Upcoming calendar event"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-surface px-4 py-2.5 text-sm shadow-panel transition-all animate-in fade-in"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-accent-bg px-2 py-0.5 text-11 font-semibold uppercase tracking-wider text-accent-text shrink-0">
          <Calendar className="size-3" aria-hidden />
          Upcoming Event
        </span>
        <span className="truncate text-muted">
          <strong className="font-medium text-text">{meeting.title}</strong> with{' '}
          <span className="text-text">{meeting.clientName}</span> ({timeLabel})
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onPrep}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-on-accent transition-all duration-150 hover:opacity-95 active:scale-95"
        >
          <Sparkles className="size-3.5" aria-hidden />
          <span>Prep workspace</span>
        </button>
        <button
          type="button"
          aria-label="Dismiss upcoming meeting alert"
          title="Dismiss"
          onClick={onDismiss}
          className="inline-flex size-7 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-text"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
