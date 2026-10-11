import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { fetchMe, type AccessCapabilities, type OrgSummary } from '../lib/orgApi';

export type AccessState =
  | { status: 'loading' }
  | { status: 'open'; authEnabled: false }
  | {
      status: 'ready';
      authEnabled: true;
      user: { id: string; name: string; email: string };
      orgs: OrgSummary[];
      activeOrganizationId: string | null;
      activeOrg: OrgSummary | null;
      scopeLabel: string | null;
      capabilities: AccessCapabilities | null;
    };

/**
 * Ensures the workspace only boots when auth is off, or the user is signed in with an org.
 * Otherwise redirects to /login or /onboard — never loads dashboard data.
 */
export function useAccessGate(): AccessState {
  const [state, setState] = useState<AccessState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (!me.authEnabled) {
          setState({ status: 'open', authEnabled: false });
          return;
        }
        if (!me.user) {
          window.location.replace('/login');
          return;
        }
        if (me.orgs.length === 0) {
          window.location.replace('/onboard');
          return;
        }
        const activeOrg =
          me.orgs.find((o) => o.id === me.activeOrganizationId) ?? me.orgs[0] ?? null;
        setState({
          status: 'ready',
          authEnabled: true,
          user: me.user,
          orgs: me.orgs,
          activeOrganizationId: me.activeOrganizationId ?? activeOrg?.id ?? null,
          activeOrg,
          scopeLabel: me.scopeLabel ?? null,
          capabilities: me.capabilities ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) window.location.replace('/login');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function AccessLoading({ label = 'Verifying access…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-sm text-muted">
      <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function AccessGate({
  children,
}: {
  children: (access: Extract<AccessState, { status: 'ready' | 'open' }>) => ReactNode;
}) {
  const access = useAccessGate();
  if (access.status === 'loading') return <AccessLoading />;
  return <>{children(access)}</>;
}
