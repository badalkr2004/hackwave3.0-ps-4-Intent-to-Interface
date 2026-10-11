import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCopy, ExternalLink, KeyRound, LoaderCircle, Trash2 } from 'lucide-react';
import {
  fetchMcpSetup,
  issueMcpToken,
  revokeMcpToken,
  type McpIssuedAccess,
  type McpSetupStatus,
} from '../lib/connectorsApi';

type CopyKey = 'cursor' | 'claude' | 'cli' | 'generic' | 'custom' | 'token';
type ClientTab = 'cursor' | 'claude' | 'generic' | 'custom';

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function McpSetupPanel() {
  const [status, setStatus] = useState<McpSetupStatus | null>(null);
  const [issued, setIssued] = useState<McpIssuedAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const [tab, setTab] = useState<ClientTab>('cursor');

  const reload = useCallback(async () => {
    setStatus(await fetchMcpSetup());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load MCP setup');
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const flash = (which: CopyKey) => {
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const onConnectIde = async () => {
    setBusy(true);
    setError(null);
    try {
      const access = await issueMcpToken({ name: 'IDE', expiresInDays: 90 });
      setIssued(access);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create IDE access');
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await revokeMcpToken(id);
      if (issued?.meta.id === id) setIssued(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted">Loading IDE access…</p>;
  }

  if (!status) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error ?? 'Unavailable'}
      </p>
    );
  }

  const jsonForTab =
    tab === 'cursor'
      ? issued?.cursorConfigJson
      : tab === 'claude'
        ? issued?.claudeCodeConfigJson
        : tab === 'generic'
          ? issued?.genericStdioConfigJson
          : issued?.customClientHintJson;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-md bg-accent-bg text-accent-text">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-text">IDE / MCP access</p>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Connect your <strong className="font-medium text-text">active organization</strong> to
            Cursor, Claude Code, or any MCP client. One personal token unlocks org data for
            intent-based reports — no user ids to copy.
          </p>
        </div>
      </div>

      {status.ready ? (
        <p className="text-sm text-success">
          Active org ready. Create an IDE token to install into your MCP client.
        </p>
      ) : (
        <div className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn" role="status">
          <p className="font-medium">Select an organization first</p>
          <ul className="mt-1 list-disc pl-5">
            {status.readyIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="mt-2">
            <a href="/org" className="underline hover:text-text">
              Open Organization
            </a>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !status.ready}
          onClick={() => void onConnectIde()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="size-4" aria-hidden />
          )}
          {issued ? 'Create new IDE token' : 'Connect IDE access'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {issued && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm text-success">{issued.notice}</p>

          <div
            className="flex flex-wrap gap-1 border-b border-border"
            role="tablist"
            aria-label="MCP client"
          >
            {(
              [
                ['cursor', 'Cursor'],
                ['claude', 'Claude Code'],
                ['generic', 'Other hosts'],
                ['custom', 'Custom client'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-10 px-3 text-sm ${
                  tab === id
                    ? 'border-b-2 border-accent text-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'cursor' && (
            <div className="flex flex-col gap-2">
              <a
                href={issued.cursorInstallLink}
                className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent"
              >
                <ExternalLink className="size-4" aria-hidden />
                Add to Cursor
              </a>
              <p className="text-xs text-muted">
                Opens Cursor’s install prompt with your org token (no user id).
              </p>
            </div>
          )}

          {tab === 'claude' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  void copyText(issued.claudeCliCommand).then(() => flash('cli'))
                }
                className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2"
              >
                {copied === 'cli' ? (
                  <Check className="size-4" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
                {copied === 'cli' ? 'Copied' : 'Copy Claude CLI command'}
              </button>
              <p className="text-xs text-muted">
                Or save the JSON below as project <code className="text-xs">.mcp.json</code>.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">
                {tab === 'cursor'
                  ? 'Manual Cursor JSON'
                  : tab === 'claude'
                    ? 'Claude Code .mcp.json'
                    : tab === 'generic'
                      ? 'Generic MCP host JSON'
                      : 'Custom client auth hint'}
              </p>
              {jsonForTab && (
                <button
                  type="button"
                  onClick={() =>
                    void copyText(jsonForTab).then(() =>
                      flash(
                        tab === 'cursor'
                          ? 'cursor'
                          : tab === 'claude'
                            ? 'claude'
                            : tab === 'generic'
                              ? 'generic'
                              : 'custom',
                      ),
                    )
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2"
                >
                  <ClipboardCopy className="size-4" aria-hidden />
                  Copy
                </button>
              )}
            </div>
            {jsonForTab && (
              <pre className="max-h-48 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-xs text-text whitespace-pre-wrap break-all">
                {jsonForTab}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyText(issued.token).then(() => flash('token'))}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2"
            >
              {copied === 'token' ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
              {copied === 'token' ? 'Token copied' : 'Copy raw token'}
            </button>
            <span className="font-mono text-xs text-muted break-all">{issued.token}</span>
          </div>
        </div>
      )}

      {status.tokens.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Your IDE tokens</p>
          <ul className="mt-3 divide-y divide-border">
            {status.tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="text-text">
                    {t.name}{' '}
                    <span className="font-mono text-xs text-muted">{t.tokenPrefix}…</span>
                  </p>
                  <p className="text-xs text-muted">
                    {t.active ? 'Active' : 'Revoked/expired'} · org {t.organizationId}
                    {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}` : ''}
                  </p>
                </div>
                {t.active && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRevoke(t.id)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
