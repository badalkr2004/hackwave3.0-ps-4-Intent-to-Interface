import { startTransition, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { authClient } from '../lib/auth';
import { fetchMe, type OrgSummary } from '../lib/orgApi';

type User = { id: string; name: string; email: string };

/**
 * Avatar menu on the right: Organization, Analytics, Sign out.
 * Workspace name is shown once in the page header, not here.
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
  const [fetchedOrg, setFetchedOrg] = useState<OrgSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const org = activeOrg ?? fetchedOrg;

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        startTransition(() => {
          setAuthEnabled(me.authEnabled);
          setUser(me.user);
          const next =
            me.orgs.find((o) => o.id === me.activeOrganizationId) ?? me.orgs[0] ?? null;
          setFetchedOrg(next);
        });
      })
      .catch(() => {
        if (!cancelled) {
          startTransition(() => {
            setAuthEnabled(false);
            setUser(null);
            setFetchedOrg(null);
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

  if (!user) {
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

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-text hover:bg-surface-2"
      >
        <span
          aria-hidden
          className="inline-flex size-8 items-center justify-center rounded-full bg-accent-bg text-13 font-medium text-accent-text"
        >
          {initials || '?'}
        </span>
        <ChevronDown aria-hidden className={`size-3.5 text-muted ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-40 mt-1 w-56 sheet py-1"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-text">{user.name}</p>
            <p className="truncate text-13 text-muted">{user.email}</p>
            {org && <p className="mt-0.5 truncate text-13 text-muted">{org.name}</p>}
          </div>
          <a
            role="menuitem"
            href="/org"
            className="block px-3 py-2 text-sm text-text hover:bg-surface-2"
          >
            Organization
          </a>
          <a
            role="menuitem"
            href="/analytics"
            className="block px-3 py-2 text-sm text-text hover:bg-surface-2"
          >
            Analytics
          </a>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text hover:bg-surface-2 disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <LogOut aria-hidden className="size-4" />
            )}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
