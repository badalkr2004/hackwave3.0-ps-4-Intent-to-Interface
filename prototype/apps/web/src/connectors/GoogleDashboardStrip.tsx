import { useEffect, useState } from 'react';
import { LoaderCircle, Video } from 'lucide-react';
import { fetchConnectors, type GoogleConnector } from '../lib/connectorsApi';
import { GoogleMeetSection } from './GoogleMeetSection';

export function GoogleDashboardStrip({
  signedIn = true,
  orgId,
}: {
  signedIn?: boolean;
  orgId?: string | null;
}) {
  const [google, setGoogle] = useState<GoogleConnector | null>(null);
  const [checked, setChecked] = useState(!signedIn);

  useEffect(() => {
    if (!signedIn) {
      setChecked(true);
      setGoogle(null);
      return;
    }
    let cancelled = false;
    void fetchConnectors()
      .then((data) => {
        if (!cancelled) setGoogle(data.google);
      })
      .catch(() => {
        if (!cancelled) setGoogle(null);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
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
          Checking Google Meet…
        </p>
      </section>
    );
  }

  if (!google?.connected) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-start gap-2.5">
          <Video className="mt-0.5 size-4 text-muted" aria-hidden />
          <div>
            <p className="text-sm font-medium text-text">Google Meet</p>
            <p className="text-sm text-muted">
              Connect Google to schedule Meet calls and pull transcripts into MoM.
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
    <section className="border-t border-border pt-5" aria-label="Google Meet connector">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-muted uppercase">
          <Video className="size-3.5" aria-hidden />
          Connected tool · Google Meet
        </p>
        <a href="/connectors" className="text-sm text-accent-text hover:underline">
          Manage
        </a>
      </div>
      <GoogleMeetSection compact orgId={orgId} />
    </section>
  );
}
