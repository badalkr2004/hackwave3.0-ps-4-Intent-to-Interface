import { useEffect, useState } from 'react';
import { CalendarDays, CalendarPlus, LoaderCircle, Video } from 'lucide-react';
import { fetchConnectors, type GoogleConnector } from '../lib/connectorsApi';
import { fetchMe, type AccessCapabilities } from '../lib/orgApi';
import { CalendarMeetingsModal } from './CalendarMeetingsModal';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';

export function GoogleDashboardStrip({
  signedIn = true,
  orgId,
}: {
  signedIn?: boolean;
  orgId?: string | null;
}) {
  const [google, setGoogle] = useState<GoogleConnector | null>(null);
  const [caps, setCaps] = useState<AccessCapabilities | null>(null);
  const [checked, setChecked] = useState(!signedIn);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [listRefresh, setListRefresh] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setChecked(true);
      setGoogle(null);
      setCaps(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setCaps(me.capabilities ?? null);
        if (me.capabilities && !me.capabilities.googleCalendar) {
          setGoogle(null);
          return;
        }
        const data = await fetchConnectors();
        if (!cancelled) setGoogle(data.google);
      } catch {
        if (!cancelled) {
          setGoogle(null);
          setCaps(null);
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!signedIn) return null;

  if (!checked) {
    return (
      <section className="border-t border-border pt-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Checking Google Calendar…
        </p>
      </section>
    );
  }

  if (caps && !caps.googleCalendar) return null;

  const canWrite = Boolean(caps?.writeConnectors);

  if (!google?.connected) {
    if (!canWrite) return null;
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-start gap-2.5">
          <Video className="mt-0.5 size-4 text-muted" aria-hidden />
          <div>
            <p className="text-sm font-medium text-text">Google Calendar & Meet</p>
            <p className="text-sm text-muted">
              Connect Google to schedule meetings, pin dates, and ground chat on your calendar.
            </p>
          </div>
        </div>
        <a
          href="/connectors"
          className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2"
        >
          Connect Google
        </a>
      </section>
    );
  }

  return (
    <section className="border-t border-border pt-5" aria-label="Google Calendar connector">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-muted uppercase">
          <Video className="size-3.5" aria-hidden />
          Connected tool · Google Calendar
          {!canWrite ? ' · view only' : ''}
        </p>
        {canWrite ? (
          <a href="/connectors" className="text-sm text-accent-text hover:underline">
            Manage
          </a>
        ) : (
          <span className="text-xs text-muted">Scheduling requires manager access</span>
        )}
      </div>

      <p className="mb-3 text-sm text-muted">
        {canWrite
          ? 'Schedule on Google Calendar with a pinned date, or browse meetings already on your calendar. Dates are indexed for Gestalt chat.'
          : 'Browse meetings in your access scope. Dates stay available to Gestalt chat.'}
      </p>

      <div className="flex flex-wrap gap-2">
        {canWrite && (
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-95"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Schedule meeting
          </button>
        )}
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text hover:bg-surface-2"
        >
          <CalendarDays className="size-4" aria-hidden />
          Calendar meetings
        </button>
      </div>

      {canWrite && (
        <ScheduleMeetingModal
          open={scheduleOpen}
          orgId={orgId}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => setListRefresh((n) => n + 1)}
        />
      )}
      <CalendarMeetingsModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        refreshKey={listRefresh}
      />
    </section>
  );
}
