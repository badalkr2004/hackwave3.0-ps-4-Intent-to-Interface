import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Cable,
  Check,
  LoaderCircle,
  Plug,
  Unplug,
  Video,
} from 'lucide-react';
import { authClient } from '../lib/auth';
import { fetchMe } from '../lib/orgApi';
import {
  confirmGoogleConnect,
  connectJira,
  disconnectGoogle,
  disconnectJira,
  fetchConnectors,
  fetchJiraProjects,
  patchJiraSettings,
  type ConnectorCatalogItem,
  type GoogleConnector,
  type JiraConnector,
  type JiraProject,
} from '../lib/connectorsApi';
import { GoogleMeetSection } from './GoogleMeetSection';
import { JiraTickets } from './JiraTickets';

export function ConnectorsPage() {
  const [booting, setBooting] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ConnectorCatalogItem[]>([]);
  const [jira, setJira] = useState<JiraConnector | null>(null);
  const [google, setGoogle] = useState<GoogleConnector | null>(null);
  const [defaults, setDefaults] = useState({
    hasServerToken: false,
    baseUrl: '',
    email: '',
    projectKey: '',
  });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [projects, setProjects] = useState<JiraProject[]>([]);

  const refresh = async () => {
    const data = await fetchConnectors();
    setCatalog(data.catalog);
    setJira(data.jira);
    setGoogle(data.google);
    setDefaults(data.defaults);
    if (!data.jira.connected) {
      setBaseUrl((v) => v || data.defaults.baseUrl);
      setEmail((v) => v || data.defaults.email);
      setProjectKey((v) => v || data.defaults.projectKey);
    }
    if (data.jira.connected) {
      setProjectKey(data.jira.projectKey ?? '');
      try {
        const p = await fetchJiraProjects();
        setProjects(p.projects);
      } catch {
        setProjects([]);
      }
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchMe();
        setSignedIn(Boolean(me.user));
        setActiveOrgId(me.activeOrganizationId);
        if (!me.user) {
          window.location.replace('/login?next=/connectors');
          return;
        }
        await refresh();
        const params = new URLSearchParams(window.location.search);
        if (params.get('google_error') === '1' || params.get('error')) {
          const code = params.get('error') ?? 'link_failed';
          setError(`Google connect failed (${code}). Try Connect Google again.`);
          params.delete('google_error');
          params.delete('error');
          params.delete('error_description');
          window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${params.toString() ? `?${params}` : ''}`,
          );
        } else if (params.get('google') === '1') {
          try {
            const { google: g } = await confirmGoogleConnect();
            setGoogle(g);
            setNotice(`Google Meet connected as ${g.email ?? 'your account'}`);
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Google connect incomplete');
          }
          params.delete('google');
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
          window.history.replaceState({}, '', next);
        }
      } catch (e) {
        const err = e as Error & { code?: string; status?: number };
        if (err.code === 'AUTH_REQUIRED' || err.status === 401) {
          window.location.replace('/login?next=/connectors');
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const onConnectJira = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { jira: next } = await connectJira({
        baseUrl,
        email,
        projectKey: projectKey || undefined,
        apiToken: apiToken || undefined,
      });
      setJira(next);
      setApiToken('');
      setAdding(false);
      setNotice(`Connected as ${next.displayName ?? next.email}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Jira');
    } finally {
      setBusy(false);
    }
  };

  const onDisconnectJira = async () => {
    setBusy(true);
    setError(null);
    try {
      const { jira: next } = await disconnectJira();
      setJira(next);
      setProjects([]);
      setNotice('Jira disconnected.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  const onConnectGoogle = () => {
    setBusy(true);
    setError(null);
    // Already signed in — link Google to this user (do not use signIn.social).
    // Pass Calendar/Drive scopes explicitly so re-consent grants Meet permissions.
    void authClient.linkSocial({
      provider: 'google',
      callbackURL: '/connectors?google=1',
      errorCallbackURL: '/connectors?google_error=1',
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });
  };

  const onDisconnectGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { google: next } = await disconnectGoogle();
      setGoogle(next);
      setNotice('Google Meet disconnected from Gestalt (your Google sign-in may remain).');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect Google');
    } finally {
      setBusy(false);
    }
  };

  const onSaveProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const { jira: next } = await patchJiraSettings({ projectKey: projectKey || null });
      setJira(next);
      setNotice(projectKey ? `Default project set to ${projectKey}` : 'Default project cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save project');
    } finally {
      setBusy(false);
    }
  };

  if (booting || !signedIn) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {signedIn ? 'Loading connectors…' : 'Redirecting to sign in…'}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">Tools</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-text">Connectors</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Add tools Gestalt can use for live context and actions — Jira tickets, Google Meet
          scheduling, transcripts, and MoM.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="font-display text-xl text-text">
          Available tools
        </h2>
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {catalog.map((item) => {
            const isJira = item.id === 'jira';
            const isGoogle = item.id === 'google';
            return (
              <li
                key={item.id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-md bg-accent-bg text-accent-text">
                    {isGoogle ? (
                      <Video className="size-5" aria-hidden />
                    ) : (
                      <Cable className="size-5" aria-hidden />
                    )}
                  </span>
                  <div>
                    <p className="font-medium text-text">{item.name}</p>
                    <p className="mt-1 max-w-md text-sm text-muted">{item.description}</p>
                    {isJira && item.connected && jira?.displayName && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                        <Check className="size-3.5" aria-hidden />
                        Connected as {jira.displayName}
                        {jira.usingServerToken ? ' · using server API key' : ''}
                      </p>
                    )}
                    {isGoogle && item.connected && google?.email && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                        <Check className="size-3.5" aria-hidden />
                        Connected as {google.email}
                      </p>
                    )}
                    {isGoogle && !item.available && (
                      <p className="mt-1.5 text-xs text-warn">
                        Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.
                      </p>
                    )}
                    {isGoogle && google?.missingScopes && (
                      <p className="mt-1.5 text-xs text-warn">
                        Missing Calendar/Drive scopes — connect again and accept all permissions.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {isJira &&
                    (item.connected ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDisconnectJira()}
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
                      >
                        <Unplug className="size-4" aria-hidden />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="inline-flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-medium text-on-accent"
                      >
                        <Plug className="size-4" aria-hidden />
                        Add Jira
                      </button>
                    ))}
                  {isGoogle &&
                    (item.connected ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDisconnectGoogle()}
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
                      >
                        <Unplug className="size-4" aria-hidden />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !item.available}
                        onClick={onConnectGoogle}
                        className="inline-flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
                      >
                        {busy ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Plug className="size-4" aria-hidden />
                        )}
                        Connect Google
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {adding && !jira?.connected && (
        <section className="mt-10 max-w-xl border-t border-border pt-8" aria-labelledby="connect-jira">
          <h2 id="connect-jira" className="font-display text-xl text-text">
            Connect Jira
          </h2>
          <p className="mt-2 text-sm text-muted">
            Use your Atlassian site URL and account email.
            {defaults.hasServerToken
              ? ' A server API key is already configured — you can leave the token blank.'
              : ' Paste an Atlassian API token (Account → Security → API tokens).'}
          </p>
          <form onSubmit={(e) => void onConnectJira(e)} className="mt-6 flex flex-col gap-5">
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Site URL
              <input
                required
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-team.atlassian.net"
                className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Atlassian email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Default project key <span className="normal-case text-muted">(optional)</span>
              <input
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="ENG"
                className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              API token{' '}
              <span className="normal-case text-muted">
                {defaults.hasServerToken ? '(optional — server key available)' : '(required)'}
              </span>
              <input
                type="password"
                autoComplete="off"
                required={!defaults.hasServerToken}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={
                  defaults.hasServerToken ? 'Leave blank to use server key' : 'Atlassian API token'
                }
                className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 items-center gap-2 bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50"
              >
                {busy && <LoaderCircle className="size-4 animate-spin" />}
                Connect
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="inline-flex min-h-12 items-center px-4 text-sm text-muted hover:text-text"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {jira?.connected && (
        <>
          <section className="mt-10 max-w-xl border-t border-border pt-8" aria-labelledby="jira-settings">
            <h2 id="jira-settings" className="font-display text-xl text-text">
              Jira settings
            </h2>
            <p className="mt-2 text-sm text-muted">
              Site {jira.baseUrl}
              {jira.email ? ` · ${jira.email}` : ''}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-medium tracking-wide text-muted uppercase">
                Default project
                {projects.length > 0 ? (
                  <select
                    value={projectKey || jira.projectKey || ''}
                    onChange={(e) => setProjectKey(e.target.value)}
                    className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
                  >
                    <option value="">All recent issues</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.key}>
                        {p.key} — {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={projectKey || jira.projectKey || ''}
                    onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                    placeholder="ENG"
                    className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
                  />
                )}
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSaveProject()}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-border px-4 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
              >
                Save project
              </button>
            </div>
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <JiraTickets projectKey={jira.projectKey} />
          </section>
        </>
      )}

      {google?.connected && (
        <section className="mt-10 border-t border-border pt-8">
          <GoogleMeetSection orgId={activeOrgId} />
        </section>
      )}

      {notice && (
        <p role="status" className="mt-6 rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[960px] flex-col px-4 py-8 sm:px-8">
      <header className="mb-10 flex items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="font-display text-2xl tracking-tight text-text">Gestalt</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs tracking-[0.12em] text-muted uppercase">
            <Cable aria-hidden className="size-3.5" />
            Connectors
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/org" className="text-sm text-accent-text hover:underline">
            Organization
          </a>
          <a
            href="/"
            className="inline-flex min-h-10 items-center gap-2 text-sm text-accent-text hover:underline"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Workspace
          </a>
        </div>
      </header>
      {children}
    </div>
  );
}
