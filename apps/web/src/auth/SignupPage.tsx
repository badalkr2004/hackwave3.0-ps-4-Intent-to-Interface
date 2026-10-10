import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { authClient } from '../lib/auth';
import { fetchMe } from '../lib/orgApi';
import {
  AuthField,
  EnterpriseShell,
  authGhostClass,
  authInputClass,
  authPrimaryClass,
} from './EnterpriseShell';

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (!me.authEnabled) {
          window.location.replace('/');
          return;
        }
        if (me.user) {
          window.location.replace(me.orgs.length > 0 ? '/' : '/onboard');
          return;
        }
        setGoogleOAuth(Boolean(me.googleOAuth));
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.signUp.email({ name, email, password });
      if (err) throw new Error(err.message || 'Could not create account');
      window.location.assign('/onboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
        Checking session…
      </div>
    );
  }

  return (
    <EnterpriseShell
      lead="Set up access for your company"
      support="Create your account first. Next you will onboard an organization — the workspace never opens on shared demo data."
      footer={
        <p>
          Already have an account?{' '}
          <a href="/login" className="font-medium text-accent-text underline-offset-4 hover:underline">
            Sign in
          </a>
        </p>
      }
    >
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Get started</p>
      <h2 className="mt-2 font-display text-2xl tracking-tight text-text">Create your account</h2>
      <p className="mt-2 text-sm text-muted">You will create or join an organization next.</p>

      <form onSubmit={(e) => void submit(e)} className="mt-10 flex flex-col gap-7">
        <AuthField label="Full name">
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={authInputClass}
            placeholder="Priya Shah"
          />
        </AuthField>
        <AuthField label="Work email">
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="you@company.com"
          />
        </AuthField>
        <AuthField label="Password">
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="At least 8 characters"
          />
        </AuthField>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={authPrimaryClass}>
          {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          Continue to organization setup
        </button>
      </form>

      {googleOAuth && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void authClient.signIn.social({
              provider: 'google',
              callbackURL: '/onboard',
            });
          }}
          className={`${authGhostClass} mt-4`}
        >
          Continue with Google
        </button>
      )}
    </EnterpriseShell>
  );
}
