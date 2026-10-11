import { useEffect, useState, type FormEvent } from 'react';
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  RefreshCw,
  Video,
} from 'lucide-react';
import { fetchClients } from '../lib/orgApi';
import {
  fetchGoogleMeetings,
  generateGoogleMom,
  scheduleGoogleMeeting,
  syncGoogleMeeting,
  type GoogleMeeting,
} from '../lib/connectorsApi';

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

export function GoogleMeetSection({
  compact = false,
  orgId,
}: {
  compact?: boolean;
  orgId?: string | null;
}) {
  const [meetings, setMeetings] = useState<GoogleMeeting[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return toLocalInputValue(d);
  });
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return toLocalInputValue(d);
  });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGoogleMeetings();
      setMeetings(data.meetings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    void fetchClients(orgId)
      .then((c) => {
        setClients(c.clients);
        setClientId((prev) => prev || c.clients[0]?.id || '');
      })
      .catch(() => setClients([]));
  }, [orgId]);

  const onSchedule = async (e: FormEvent) => {
    e.preventDefault();
    setScheduling(true);
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
      setMeetings((prev) => [meeting, ...prev]);
      setTitle('');
      setAttendees('');
      setDescription('');
      setNotice(`Scheduled “${meeting.title}”${meeting.meetLink ? ' · Meet link ready' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule');
    } finally {
      setScheduling(false);
    }
  };

  const onSync = async (m: GoogleMeeting) => {
    setBusyId(m.id);
    setError(null);
    try {
      const { meeting } = await syncGoogleMeeting(m.id);
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? meeting : x)));
      setNotice(
        meeting.hasTranscript
          ? `Synced ${meeting.title} · transcript found`
          : `Synced ${meeting.title}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusyId(null);
    }
  };

  const onMom = async (m: GoogleMeeting) => {
    const cid = m.clientId || clientId;
    if (!cid) {
      setError('Pick a portfolio client before generating MoM.');
      return;
    }
    setBusyId(m.id);
    setError(null);
    try {
      const { meeting, mom } = await generateGoogleMom(m.id, cid);
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? meeting : x)));
      setNotice(
        `MoM “${mom.title}” saved with ${mom.commitmentsCreated} action items. Review them in Organization.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate MoM');
    } finally {
      setBusyId(null);
    }
  };

  const shown = compact ? meetings.slice(0, 4) : meetings;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={`font-display text-text ${compact ? 'text-lg' : 'text-xl'}`}>
            Google Meet
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            Schedule invites, join via Meet, sync recordings, generate MoM
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {!compact && (
        <form
          onSubmit={(e) => void onSchedule(e)}
          className="flex flex-col gap-3 border-t border-border pt-4"
        >
          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Acme QBR"
              className="mt-1.5 min-h-11 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Starts
              <input
                required
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1.5 min-h-11 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Ends
              <input
                required
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1.5 min-h-11 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="text-xs font-medium tracking-wide text-muted uppercase">
            Attendees <span className="normal-case text-muted">(emails, comma-separated)</span>
            <input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alex@acme.com, jordan@you.com"
              className="mt-1.5 min-h-11 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          {clients.length > 0 && (
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Portfolio client
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1.5 min-h-11 w-full border-0 border-b border-border-strong bg-transparent px-0 text-sm text-text outline-none focus:border-accent"
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
              className="mt-1.5 w-full resize-y border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={scheduling || !title.trim()}
            className="inline-flex min-h-11 w-fit items-center gap-2 bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {scheduling ? <LoaderCircle className="size-4 animate-spin" /> : <Video className="size-4" />}
            Schedule Meet
          </button>
        </form>
      )}

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

      {loading && meetings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading meetings…
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">
          {compact
            ? 'No Google Calendar meetings yet. Use Schedule meeting on the dashboard.'
            : 'No meetings yet. Schedule one above.'}
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border" aria-label="Google meetings">
          {shown.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{m.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatWhen(m.startsAt)} · {m.status}
                    {m.attendees.length > 0 ? ` · ${m.attendees.length} invited` : ''}
                    {m.hasTranscript ? ' · transcript ready' : ''}
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
                  {m.recordingUrl && (
                    <a
                      href={m.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 px-2 text-xs text-muted hover:text-text"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      Recording
                    </a>
                  )}
                  {!compact && (
                    <>
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
                      <button
                        type="button"
                        disabled={busyId === m.id || Boolean(m.meetingMinutesId)}
                        onClick={() => void onMom(m)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
                      >
                        <FileText className="size-3.5" />
                        {m.meetingMinutesId ? 'MoM saved' : 'Generate MoM'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {compact && meetings.length > 4 && (
        <p className="text-xs text-muted">Showing latest 4 · open Calendar meetings for the full list</p>
      )}
    </div>
  );
}
