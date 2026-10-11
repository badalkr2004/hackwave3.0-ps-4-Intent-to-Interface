import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarPlus, LoaderCircle, Video, X } from 'lucide-react';
import { fetchClients } from '../lib/orgApi';
import { scheduleGoogleMeeting } from '../lib/connectorsApi';

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d);
}

function defaultEnd(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return toLocalInputValue(d);
}

export function ScheduleMeetingModal({
  open,
  orgId,
  onClose,
  onScheduled,
}: {
  open: boolean;
  orgId?: string | null;
  onClose: () => void;
  onScheduled?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => defaultStart().slice(0, 10));
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !orgId) return;
    void fetchClients(orgId)
      .then((c) => {
        setClients(c.clients);
        setClientId((prev) => prev || c.clients[0]?.id || '');
      })
      .catch(() => setClients([]));
  }, [open, orgId]);

  /** Keep datetime pinned to the selected calendar date. */
  const pinDateToTimes = (date: string) => {
    setMeetingDate(date);
    const startTime = startsAt.slice(11) || '10:00';
    const endTime = endsAt.slice(11) || '11:00';
    setStartsAt(`${date}T${startTime}`);
    setEndsAt(`${date}T${endTime}`);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const emails = attendees
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const { meeting } = await scheduleGoogleMeeting({
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        attendees: emails,
        description: description.trim() || undefined,
        clientId: clientId || null,
      });
      setNotice(
        `Scheduled “${meeting.title}” on ${new Date(meeting.startsAt).toLocaleDateString()} · pinned in calendar & chat context`,
      );
      setTitle('');
      setAttendees('');
      setDescription('');
      onScheduled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule meeting');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(100vw-1.5rem,32rem)] rounded-xl border border-border bg-surface p-0 text-text shadow-panel backdrop:bg-canvas/50"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <form className="flex flex-col" onSubmit={(e) => void onSubmit(e)}>
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-text">
              <CalendarPlus className="size-4 text-accent" aria-hidden />
              Schedule meeting
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Creates a Google Calendar event with a Meet link. The date is pinned to the meeting
              and indexed for Gestalt chat.
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

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vertex QBR"
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
            />
          </label>

          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Meeting date
            <input
              required
              type="date"
              value={meetingDate}
              onChange={(e) => pinDateToTimes(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Starts
              <input
                required
                type="datetime-local"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  if (e.target.value.length >= 10) setMeetingDate(e.target.value.slice(0, 10));
                }}
                className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Ends
              <input
                required
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Attendees <span className="normal-case text-muted">(emails)</span>
            <input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alex@client.com, you@company.com"
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
            />
          </label>

          {clients.length > 0 && (
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Portfolio client
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-canvas px-3 text-sm text-text outline-none focus:border-accent"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Agenda <span className="normal-case text-muted">(optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-y rounded-md border border-border bg-canvas px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </label>

          {notice && (
            <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Video className="size-4" aria-hidden />
            )}
            Schedule on Google Calendar
          </button>
        </footer>
      </form>
    </dialog>
  );
}
