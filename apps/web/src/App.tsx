import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import type { HealthResponse } from '@gestalt/shared';
import { fetchHealth } from './lib/api';

type HealthState =
  { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error'; message: string };

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then((h) => setHealth({ kind: 'ok', health: h }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setHealth({ kind: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <>
      <a
        href="#workspace"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-sm text-text shadow-panel"
      >
        Skip to workspace
      </a>
      <header className="mx-auto max-w-[1400px] px-5 pb-4 pt-6">
        <h1 tabIndex={-1} className="text-2xl text-text">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted">Here is your portfolio at a glance.</p>
      </header>
      <main id="workspace" className="mx-auto max-w-[1400px] px-5 pb-6">
        <section
          aria-labelledby="bootstrap-heading"
          className="rounded-lg border border-border bg-surface p-4 shadow-panel"
        >
          <h2 id="bootstrap-heading" className="text-md text-text">
            Is the workspace engine connected?
          </h2>
          <div className="mt-3 text-sm">
            <HealthStatus state={health} />
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-[1400px] px-5 pb-6 text-xs text-muted">Gestalt</footer>
    </>
  );
}

function HealthStatus({ state }: { state: HealthState }) {
  if (state.kind === 'loading') {
    return (
      <p className="flex items-center gap-2 text-muted">
        <LoaderCircle aria-hidden className="size-4 animate-spin" /> Checking server…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-sm bg-danger-bg p-2 text-danger">
        <CircleAlert aria-hidden className="size-4" /> Server unreachable: {state.message}
      </p>
    );
  }
  const { health } = state;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      <dt className="text-muted">Server</dt>
      <dd className="flex items-center gap-2 text-success">
        <CircleCheck aria-hidden className="size-4" /> Connected
      </dd>
      <dt className="text-muted">LLM</dt>
      <dd>{health.llm === 'live' ? 'Live' : 'Offline mode (fixtures)'}</dd>
      <dt className="text-muted">Models</dt>
      <dd className="font-mono text-xs">
        {health.models.fast} · {health.models.write}
      </dd>
      <dt className="text-muted">Database</dt>
      <dd>{health.db === 'up' ? 'Up' : 'Down (fixture data)'}</dd>
    </dl>
  );
}
