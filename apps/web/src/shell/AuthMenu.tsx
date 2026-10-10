import { startTransition, useEffect, useState } from 'react';
import { Building2, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { authClient } from '../lib/auth';
import { fetchMe, type OrgSummary } from '../lib/orgApi';

type User = { id: string; name: string; email: string };

/**
 * Header auth control. Sign-in uses the enterprise /login page — not an inline card.
 */
export function AuthMenu({
  onAuthChange,
  activeOrg,
}: {
  onAuthChange?: () => void;
  activeOrg?: OrgSummary | null;
}) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<OrgSummary | null>(activeOrg ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrg(activeOrg ?? null);
  }, [activeOrg]);

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        startTransition(() => {
          setAuthEnabled(me.authEnabled);
          setUser(me.user);
          if (!activeOrg) {
            const next =
              me.orgs.find((o) => o.id === me.activeOrganizationId) ?? me.orgs[0] ?? null;
            setOrg(next);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          startTransition(() => {
            setAuthEnabled(false);
            setUser(null);
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrg]);

  if (!authEnabled) return null;

  const signOut = async () => {
    setBusy(true);
    try {
      await authClient.signOut();
      onAuthChange?.();
      window.location.assign('/login');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {org && (
          <span
            className="hidden max-w-[12rem] truncate text-xs text-muted sm:inline"
            title={org.name}
          >
            {org.name}
          </span>
        )}
        <a
          href="/org"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
        >
          <Building2 aria-hidden className="size-4" />
          <span className="hidden sm:inline">Organization</span>
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
        >
          {busy ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <LogOut aria-hidden className="size-4" />
          )}
          Sign out
        </button>
      </div>
    );
  }

  return (
    <a
      href="/login"
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
    >
      <LogIn aria-hidden className="size-4" />
      Sign in
    </a>
  );
}
