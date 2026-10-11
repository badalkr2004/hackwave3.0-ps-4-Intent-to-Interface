import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  createOrganization,
  fetchMe,
  joinOrganization,
  type OrgSummary,
} from '../lib/orgApi';
import {
  AuthField,
  EnterpriseShell,
  authGhostClass,
  authInputClass,
  authPrimaryClass,
} from './EnterpriseShell';

type Mode = 'create' | 'join';

export function OnboardPage() {
  const [mode, setMode] = useState<Mode>('create');
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (!me.authEnabled) {
          window.location.replace('/app');
          return;
        }
        if (!me.user) {
          window.location.replace('/login?next=/onboard');
          return;
        }
        if (me.orgs.length > 0) {
          window.location.replace('/app');
          return;
        }
        setUserName(me.user.name);
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) window.location.replace('/login?next=/onboard');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goWorkspace = (_org: OrgSummary) => {
    window.location.assign('/app');
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { org } = await createOrganization(orgName);
      goWorkspace(org);
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
      goWorkspace(org);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
        Preparing onboarding…
      </div>
    );
  }

  return (
    <EnterpriseShell
      lead="Onboard your organization"
      support="Every dashboard is scoped to one company. Create a new organization or join with an invite from a teammate."
      footer={
        <p>
          Signed in as {userName}.{' '}
          <a href="/org" className="font-medium text-accent-text underline-offset-4 hover:underline">
            Organization desk
          </a>
        </p>
      }
    >
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Step 2 of 2</p>
      <h2 className="mt-2 font-display text-2xl tracking-tight text-text">Organization access</h2>
      <p className="mt-2 text-sm text-muted">
        Without an organization, Gestalt will not load portfolio data. New organizations start empty;
        demo tenants (after seed) each have their own client portfolio.
      </p>

      <div className="mt-8 flex gap-6 border-b border-border">
        {(
          [
            ['create', 'Create organization'],
            ['join', 'Join with invite'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setError(null);
            }}
            className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
              mode === id
                ? 'border-accent font-medium text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'create' ? (
        <form onSubmit={(e) => void onCreate(e)} className="mt-10 flex flex-col gap-7">
          <AuthField label="Company name">
            <input
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={authInputClass}
              placeholder="Northwind Customer Success"
              minLength={2}
              maxLength={80}
            />
          </AuthField>
          <p className="text-sm leading-relaxed text-muted">
            You become the owner. Invite teammates from the organization desk after setup.
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={authPrimaryClass}>
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            Create organization & open workspace
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void onJoin(e)} className="mt-10 flex flex-col gap-7">
          <AuthField label="Invite code">
            <input
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className={`${authInputClass} font-mono tracking-[0.2em]`}
              placeholder="A1B2C3D4"
              minLength={4}
              maxLength={32}
            />
          </AuthField>
          <p className="text-sm leading-relaxed text-muted">
            Ask an admin for a code. It expires fourteen days after it is created.
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={authGhostClass}>
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            Join organization & open workspace
          </button>
        </form>
      )}
    </EnterpriseShell>
  );
}
