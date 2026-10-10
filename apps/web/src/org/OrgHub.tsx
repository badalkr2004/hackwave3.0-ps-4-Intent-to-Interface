import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardList,
  FileUp,
  LoaderCircle,
  ScrollText,
  UserPlus,
} from 'lucide-react';
import {
  createInvite,
  createOrganization,
  fetchActionItems,
  fetchAudit,
  fetchClients,
  fetchMe,
  fetchMom,
  fetchOrgs,
  fileToBase64,
  joinOrganization,
  pasteMom,
  patchActionItem,
  rollActionSla,
  setActiveOrganization,
  uploadMom,
  type ActionItem,
  type AuditItem,
  type MomItem,
  type OrgSummary,
} from '../lib/orgApi';

type Client = { id: string; name: string; health: number };
type Tab = 'minutes' | 'actions' | 'audit';

/**
 * Organization desk: onboard a company, ingest MOM (paste/upload), track action items, audit.
 */
export function OrgHub() {
  const [booting, setBooting] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [mom, setMom] = useState<MomItem[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [tab, setTab] = useState<Tab>('minutes');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const active = orgs.find((o) => o.id === activeId) ?? orgs[0] ?? null;

  const refresh = async () => {
    const me = await fetchMe();
    setAuthEnabled(me.authEnabled);
    setSignedIn(Boolean(me.user));
    if (!me.user) {
      setOrgs([]);
      setActiveId(null);
      return;
    }
    const data = await fetchOrgs();
    setOrgs(data.orgs);
    setActiveId(data.activeOrganizationId ?? data.orgs[0]?.id ?? null);
  };

  const loadOrgData = async (orgId: string) => {
    const [c, m, a, au] = await Promise.all([
      fetchClients(orgId),
      fetchMom(orgId),
      fetchActionItems(orgId, 'all'),
      fetchAudit(orgId),
    ]);
    setClients(c.clients);
    setMom(m.items);
    setActions(a.items);
    setAudit(au.items);
    setClientId((prev) => prev || c.clients[0]?.id || '');
  };

  useEffect(() => {
    void refresh()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!booting && authEnabled && !signedIn) {
      window.location.replace('/login?next=/org');
    }
  }, [booting, authEnabled, signedIn]);

  useEffect(() => {
    if (!active) {
      setClients([]);
      setMom([]);
      setActions([]);
      setAudit([]);
      return;
    }
    let cancelled = false;
    void loadOrgData(active.id).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load org data');
    });
    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { org } = await createOrganization(orgName);
      setOrgName('');
      setNotice(`Created ${org.name}. Opening workspace…`);
      await refresh();
      setActiveId(org.id);
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create organization');
      setBusy(false);
    }
  };

  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { org } = await joinOrganization(joinCode);
      setJoinCode('');
      setNotice(`Joined ${org.name}. Opening workspace…`);
      await refresh();
      setActiveId(org.id);
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
      setBusy(false);
    }
  };

  const onInvite = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const { invite } = await createInvite(active.id);
      setInviteCode(invite.code);
      setNotice('Share this code with a teammate. It expires in 14 days.');
      await loadOrgData(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite');
    } finally {
      setBusy(false);
    }
  };

  const onPasteMom = async (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { mom: saved } = await pasteMom(active.id, {
        clientId,
        rawText,
        title: title || undefined,
      });
      setRawText('');
      setTitle('');
      setNotice(
        `Saved “${saved.title}” with ${saved.commitmentsCreated} action items. Prep that client in the workspace to use them.`,
      );
      await loadOrgData(active.id);
      setTab('actions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save minutes');
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file || !active || !clientId) return;
    setBusy(true);
    setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const { mom: saved, kind } = await uploadMom(active.id, {
        clientId,
        filename: file.name,
        contentBase64,
        mime: file.type,
        title: title || undefined,
      });
      setNotice(
        `Imported ${kind} “${saved.title}” for ${saved.clientName} · ${saved.commitmentsCreated} actions.`,
      );
      await loadOrgData(active.id);
      setTab('actions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import file');
    } finally {
      setBusy(false);
    }
  };

  const onActionStatus = async (item: ActionItem, status: ActionItem['status']) => {
    if (!active) return;
    setBusy(true);
    try {
      await patchActionItem(active.id, item.id, { status });
      await loadOrgData(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update action');
    } finally {
      setBusy(false);
    }
  };

  const onRollSla = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await rollActionSla(active.id);
      setNotice(r.updated ? `Marked ${r.updated} overdue items as missed.` : 'No overdue open items.');
      await loadOrgData(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not roll SLA');
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading organization desk…
        </p>
      </Shell>
    );
  }

  if (!authEnabled) {
    return (
      <Shell>
        <p className="text-sm text-muted">
          Sign-in is not configured. Add Better Auth secrets and a database, then restart the
          server.
        </p>
      </Shell>
    );
  }

  if (!signedIn) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Redirecting to sign in…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {!active ? (
        <div className="flex flex-col gap-10">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
              Organization onboarding
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight text-text">
              Establish your company space
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              The workspace only opens for members of an organization. Create one for your team, or
              join with an invite code.
            </p>
          </div>

          <div className="grid gap-10 border-t border-border pt-8 lg:grid-cols-2 lg:gap-16">
            <form onSubmit={(e) => void onCreate(e)} className="flex flex-col gap-5">
              <div>
                <h3 className="font-display text-xl text-text">Create organization</h3>
                <p className="mt-1 text-sm text-muted">
                  You become the owner. Portfolio data stays inside this tenant.
                </p>
              </div>
              <label className="text-xs font-medium tracking-wide text-muted uppercase">
                Company name
                <input
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none focus:border-accent"
                  placeholder="Northwind Customer Success"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-5 text-sm font-medium text-on-accent"
              >
                {busy && <LoaderCircle className="size-4 animate-spin" />}
                Create organization
              </button>
            </form>

            <form onSubmit={(e) => void onJoin(e)} className="flex flex-col gap-5">
              <div>
                <h3 className="font-display text-xl text-text">Join with an invite</h3>
                <p className="mt-1 text-sm text-muted">Enter the code from an admin or owner.</p>
              </div>
              <label className="text-xs font-medium tracking-wide text-muted uppercase">
                Invite code
                <input
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="mt-2 min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 font-mono text-base tracking-[0.2em] text-text outline-none focus:border-accent"
                  placeholder="A1B2C3D4"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-border px-5 text-sm font-medium text-text hover:bg-surface-2/60"
              >
                Join organization
              </button>
            </form>
          </div>

          <p className="text-sm text-muted">
            Prefer the guided flow?{' '}
            <a href="/onboard" className="text-accent-text underline-offset-2 hover:underline">
              Open organization onboarding
            </a>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.08em] text-muted uppercase">
                Organization
              </p>
              <h2 className="font-display text-2xl text-text">{active.name}</h2>
              <p className="mt-1 text-sm text-muted">
                You are {active.role}. Minutes become commitments that improve meeting prep.
              </p>
            </div>
            {(active.role === 'owner' || active.role === 'admin') && (
              <button
                type="button"
                onClick={() => void onInvite()}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
              >
                <UserPlus aria-hidden className="size-4" />
                Invite teammate
              </button>
            )}
          </div>

          {inviteCode && (
            <p className="sheet px-4 py-3 text-sm text-text">
              Invite code:{' '}
              <span className="font-mono text-lg tracking-widest text-accent-text">{inviteCode}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {(
              [
                ['minutes', 'Minutes'],
                ['actions', 'Action items'],
                ['audit', 'Audit'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-9 rounded-md px-3 text-sm ${tab === id ? 'bg-accent-bg font-medium text-accent-text' : 'text-muted hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'minutes' && (
            <div className="flex flex-col gap-6">
              <form onSubmit={(e) => void onPasteMom(e)} className="sheet flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <ClipboardList aria-hidden className="size-4 text-accent" />
                  <h3 className="font-display text-lg text-text">Add meeting minutes</h3>
                </div>
                <p className="text-sm text-muted">
                  Paste notes or upload .txt / .md / .vtt / .html / .docx. Use Attendees, Decisions,
                  and Action items sections when you can.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-muted">
                    Client
                    <select
                      required
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-text"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted">
                    Title (optional)
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-text"
                      placeholder="Q4 business review"
                    />
                  </label>
                </div>
                <label className="text-xs text-muted">
                  Minutes
                  <textarea
                    required
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={9}
                    className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text"
                    placeholder={`Title: Acme weekly sync
Attendees:
Rohan Mehta, Priya Shah
Decisions:
- Prioritize export hotfix
Action items:
- Send status update (Dev Patel) due 2026-10-15`}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy || !clientId}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent"
                  >
                    {busy && <LoaderCircle className="size-4 animate-spin" />}
                    Save minutes
                  </button>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2">
                    <FileUp aria-hidden className="size-4" />
                    Upload file
                    <input
                      type="file"
                      accept=".txt,.md,.markdown,.vtt,.html,.htm,.docx,text/plain,text/markdown,text/vtt,text/html"
                      className="sr-only"
                      onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </form>

              <section className="flex flex-col gap-3">
                <h3 className="font-display text-lg text-text">Recent minutes</h3>
                {mom.length === 0 ? (
                  <p className="text-sm text-muted">No minutes yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {mom.map((m) => (
                      <li key={m.id} className="sheet px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium text-text">{m.title}</p>
                          <p className="text-xs text-muted">
                            {new Date(m.heldAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted">{m.summary}</p>
                        <p className="mt-2 text-xs text-muted">
                          {(m.actionItems?.length ?? 0)} action items ·{' '}
                          {(m.decisions?.length ?? 0)} decisions
                          {m.clientId
                            ? ` · ${clients.find((c) => c.id === m.clientId)?.name ?? m.clientId}`
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'actions' && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg text-text">Action items</h3>
                {(active.role === 'owner' || active.role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => void onRollSla()}
                    disabled={busy}
                    className="text-xs text-accent-text underline-offset-2 hover:underline"
                  >
                    Mark overdue as missed
                  </button>
                )}
              </div>
              {actions.length === 0 ? (
                <p className="text-sm text-muted">No action items yet — ingest minutes first.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {actions.map((a) => (
                    <li key={a.id} className="sheet flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text">{a.text}</p>
                        <p className="mt-1 text-xs text-muted">
                          {a.owner ? `Owner: ${a.owner}` : 'Unassigned'}
                          {a.due ? ` · Due ${a.due}` : ''}
                          {a.clientId
                            ? ` · ${clients.find((c) => c.id === a.clientId)?.name ?? a.clientId}`
                            : ''}
                          {' · '}
                          <SlaChip sla={a.sla} />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        {a.status !== 'done' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onActionStatus(a, 'done')}
                            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-xs text-text hover:bg-surface-2"
                          >
                            <Check className="size-3.5" /> Done
                          </button>
                        )}
                        {a.status !== 'open' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onActionStatus(a, 'open')}
                            className="min-h-9 rounded-md border border-border px-2 text-xs text-muted hover:text-text"
                          >
                            Reopen
                          </button>
                        )}
                        {a.status === 'open' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onActionStatus(a, 'missed')}
                            className="min-h-9 rounded-md border border-border px-2 text-xs text-danger"
                          >
                            Missed
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'audit' && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ScrollText aria-hidden className="size-4 text-accent" />
                <h3 className="font-display text-lg text-text">Audit log</h3>
              </div>
              {audit.length === 0 ? (
                <p className="text-sm text-muted">No events yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {audit.map((ev) => (
                    <li key={ev.id} className="border-b border-border py-2 text-sm last:border-0">
                      <span className="font-medium text-text">{ev.action}</span>
                      <span className="text-muted">
                        {' '}
                        · {ev.entityType}
                        {ev.entityId ? ` · ${ev.entityId}` : ''}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {orgs.length > 1 && (
            <label className="text-xs text-muted">
              Switch organization
              <select
                value={active.id}
                onChange={(e) => {
                  const next = e.target.value;
                  setActiveId(next);
                  void setActiveOrganization(next)
                    .then(() => setNotice('Active organization updated. Reload the workspace to refresh data.'))
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : 'Could not switch organization'),
                    );
                }}
                className="mt-1 min-h-11 max-w-sm rounded-md border border-border bg-bg px-3 text-sm text-text"
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {notice && (
        <p role="status" className="mt-4 rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Shell>
  );
}

function SlaChip({ sla }: { sla: string }) {
  const label =
    sla === 'overdue'
      ? 'Overdue'
      : sla === 'due_today'
        ? 'Due today'
        : sla === 'on_track'
          ? 'On track'
          : sla === 'done'
            ? 'Done'
            : sla === 'missed'
              ? 'Missed'
              : sla;
  const tone =
    sla === 'overdue' || sla === 'missed'
      ? 'text-danger'
      : sla === 'due_today'
        ? 'text-warn'
        : sla === 'done'
          ? 'text-success'
          : 'text-muted';
  return <span className={tone}>{label}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[960px] flex-col px-4 py-8 sm:px-8">
      <header className="mb-10 flex items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="font-display text-2xl tracking-tight text-text">Gestalt</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs tracking-[0.12em] text-muted uppercase">
            <Building2 aria-hidden className="size-3.5" />
            Organization desk
          </p>
        </div>
        <a
          href="/"
          className="inline-flex min-h-10 items-center gap-2 text-sm text-accent-text hover:underline"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Workspace
        </a>
      </header>
      {children}
    </div>
  );
}
