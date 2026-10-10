import { startTransition, useEffect, useId, useState, type FormEvent } from 'react';
import { LoaderCircle, LogIn, LogOut, UserRound } from 'lucide-react';
import { authClient } from '../lib/auth';
import { fetchMe } from '../lib/api';

type User = { id: string; name: string; email: string };

/**
 * Optional sign-in. The workspace works without an account; signing in persists pins/dismissals.
 */
export function AuthMenu({ onAuthChange }: { onAuthChange?: () => void }) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  const applyMe = (me: Awaited<ReturnType<typeof fetchMe>>) => {
    startTransition(() => {
      setAuthEnabled(me.authEnabled);
      setUser(me.user);
    });
  };

  const refresh = async () => {
    try {
      applyMe(await fetchMe());
    } catch {
      startTransition(() => {
        setAuthEnabled(false);
        setUser(null);
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (!cancelled) applyMe(me);
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
  }, []);

  if (!authEnabled) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const { error: err } = await authClient.signUp.email({ name, email, password });
        if (err) throw new Error(err.message || 'Could not create account');
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message || 'Could not sign in');
      }
      setOpen(false);
      setPassword('');
      await refresh();
      onAuthChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await authClient.signOut();
      await refresh();
      onAuthChange?.();
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="hidden max-w-[10rem] truncate text-xs text-muted sm:inline"
          title={user.email}
        >
          {user.name}
        </span>
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
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
      >
        <LogIn aria-hidden className="size-4" />
        Sign in
      </button>
      {open && (
        <form
          id={formId}
          onSubmit={(e) => void submit(e)}
          className="absolute top-full right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 shadow-panel"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-text">
            <UserRound aria-hidden className="size-4" />
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </p>
          <p className="mt-1 text-xs text-muted">
            Optional. Saves your pins and dismissals across reloads.
          </p>
          {mode === 'signup' && (
            <label className="mt-3 block text-xs text-muted">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-border bg-bg px-2 text-sm text-text"
              />
            </label>
          )}
          <label className="mt-3 block text-xs text-muted">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-md border border-border bg-bg px-2 text-sm text-text"
            />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Password
            <input
              required
              type="password"
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-md border border-border bg-bg px-2 text-sm text-text"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-surface"
            >
              {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
            <button
              type="button"
              className="text-xs text-accent-text underline"
              onClick={() => {
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                setError(null);
              }}
            >
              {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
