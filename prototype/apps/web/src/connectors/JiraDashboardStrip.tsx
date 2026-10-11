import { useEffect, useState } from 'react';
import { Cable, LoaderCircle } from 'lucide-react';
import { fetchConnectors, type JiraConnector } from '../lib/connectorsApi';
import { fetchMe, type AccessCapabilities, type AccessRole } from '../lib/orgApi';
import { JiraTickets } from './JiraTickets';

/** Compact Jira block on the main workspace when the connector is active. */
export function JiraDashboardStrip({ signedIn = true }: { signedIn?: boolean }) {
  const [jira, setJira] = useState<JiraConnector | null>(null);
  const [caps, setCaps] = useState<AccessCapabilities | null>(null);
  const [accessRole, setAccessRole] = useState<AccessRole | null>(null);
  const [checked, setChecked] = useState(!signedIn);

  useEffect(() => {
    if (!signedIn) {
      setChecked(true);
      setJira(null);
      setCaps(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setCaps(me.capabilities ?? null);
        setAccessRole(me.accessRole ?? null);
        if (me.capabilities && !me.capabilities.jiraLive) {
          setJira(null);
          return;
        }
        const data = await fetchConnectors();
        if (!cancelled) setJira(data.jira);
      } catch {
        if (!cancelled) {
          setJira(null);
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
          Checking connectors…
        </p>
      </section>
    );
  }

  // Interns (and any role without jiraLive) do not see the Jira strip.
  if (caps && !caps.jiraLive) return null;

  if (!jira?.connected) {
    if (caps && !caps.writeConnectors) return null;
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-start gap-2.5">
          <Cable className="mt-0.5 size-4 text-muted" aria-hidden />
          <div>
            <p className="text-sm font-medium text-text">Connectors</p>
            <p className="text-sm text-muted">
              Add Jira to pull ticket context and resolve issues from this dashboard.
            </p>
          </div>
        </div>
        <a
          href="/connectors"
          className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2"
        >
          Add tool
        </a>
      </section>
    );
  }

  return (
    <section className="border-t border-border pt-5" aria-label="Jira connector">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-muted uppercase">
          <Cable className="size-3.5" aria-hidden />
          Connected tool · Jira
          {accessRole === 'developer' ? ' · read-only' : ''}
        </p>
        {caps?.writeConnectors ? (
          <a href="/connectors" className="text-sm text-accent-text hover:underline">
            Manage
          </a>
        ) : (
          <span className="text-xs text-muted">View only for your access role</span>
        )}
      </div>
      <JiraTickets
        compact
        projectKey={jira.projectKey}
        readOnly={!caps?.writeConnectors}
      />
    </section>
  );
}
