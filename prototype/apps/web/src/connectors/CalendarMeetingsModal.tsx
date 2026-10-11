import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Video,
  X,
} from 'lucide-react';
import {
  fetchGoogleMeetings,
  syncGoogleMeeting,
  type GoogleMeeting,
} from '../lib/connectorsApi';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function dayKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function CalendarMeetingsModal({
  open,
  onClose,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  /** Bump to reload after scheduling. */
  refreshKey?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [meetings, setMeetings] = useState<GoogleMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGoogleMeetings();
      setMeetings(data.meetings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load calendar meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, refreshKey]);

  const filtered = useMemo(() => {
    if (!filterDate) return meetings;
    return meetings.filter((m) => dayKey(m.startsAt) === filterDate);
  }, [meetings, filterDate]);

  const pinnedDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of meetings) {
      const d = dayKey(m.startsAt);
      if (d) set.add(d);
    }
    return [...set].sort();
  }, [meetings]);

  const onSync = async (m: GoogleMeeting) => {
    setBusyId(m.id);
    setError(null);
    try {
      const { meeting } = await syncGoogleMeeting(m.id);
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? meeting : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(100vw-1.5rem,36rem)] rounded-xl border border-border bg-surface p-0 text-text shadow-panel backdrop:bg-canvas/50"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="flex max-h-[min(85vh,640px)] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-text">
              <CalendarDays className="size-4 text-accent" aria-hidden />
              Calendar meetings
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Google Calendar events scheduled via Gestalt — filter by pinned meeting date.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-3">
          <label className="min-w-[10rem] flex-1 text-xs font-medium tracking-wide text-muted uppercase">
            Filter by date
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="mt-1.5 min-h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilterDate('')}
            disabled={!filterDate}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2 disabled:opacity-40"
          >
            All dates
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>

        {pinnedDates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-2.5">
            <span className="w-full text-[10px] tracking-wide text-muted uppercase">
              Pinned meeting dates
            </span>
            {pinnedDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDate(d)}
                className={
                  filterDate === d
                    ? 'rounded-md bg-accent-bg px-2 py-1 text-[11px] font-medium text-accent-text'
                    : 'rounded-md border border-border px-2 py-1 text-[11px] text-text hover:bg-surface-2'
                }
              >
                {d}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error && (
            <p role="alert" className="mb-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {loading && meetings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Loading calendar…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted">
              {filterDate
                ? `No meetings pinned on ${filterDate}.`
                : 'No Google Calendar meetings yet. Use Schedule meeting to create one.'}
            </p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Calendar meetings">
              {filtered.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">{m.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="font-medium text-accent-text">{dayKey(m.startsAt)}</span>
                        {' · '}
                        {formatWhen(m.startsAt)} · {m.status}
                        {m.attendees.length > 0 ? ` · ${m.attendees.length} invited` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.meetLink && (
                        <a
                          href={m.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-text hover:bg-surface-2"
                        >
                          <Video className="size-3.5" aria-hidden />
                          Join
                        </a>
                      )}
                      {m.htmlLink && (
                        <a
                          href={m.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center gap-1 px-2 text-xs text-muted hover:text-text"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                          Calendar
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => void onSync(m)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
                      >
                        {busyId === m.id ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        Sync
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
