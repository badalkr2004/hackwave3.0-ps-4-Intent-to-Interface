import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Short line under the brand on the visual plane. */
  lead: string;
  /** Supporting copy on the visual plane. */
  support: string;
  footer?: ReactNode;
};

/**
 * Full-viewport enterprise auth/onboarding shell: brand-dominant visual plane + form column.
 */
export function EnterpriseShell({ children, lead, support, footer }: Props) {
  return (
    <div className="auth-shell relative min-h-screen lg:grid lg:grid-cols-2">
      <aside
        className="auth-plane relative flex min-h-96 flex-col justify-between overflow-hidden px-8 py-10 sm:px-12 lg:min-h-screen lg:px-14 lg:py-14"
        aria-hidden={false}
      >
        <p className="auth-fade relative font-display text-3xl tracking-tight text-text sm:text-4xl">
          Gestalt
        </p>

        <div className="auth-fade-late relative mt-10 max-w-md lg:mt-0 lg:mb-8">
          <h1 className="font-display text-2xl leading-tight tracking-tight text-text sm:text-3xl">
            {lead}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">{support}</p>
        </div>

        <p className="relative hidden text-xs tracking-wide text-muted uppercase lg:block">
          Organization workspace
        </p>
      </aside>

      <main className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
        <div className="auth-fade mx-auto w-full max-w-md">{children}</div>
        {footer && (
          <div className="auth-fade-late mx-auto mt-10 w-full max-w-md text-sm text-muted">
            {footer}
          </div>
        )}
      </main>
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const authInputClass =
  'min-h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-text outline-none transition-[border-color] duration-150 placeholder:text-muted focus:border-accent';

export const authPrimaryClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 bg-accent px-5 text-sm font-medium tracking-wide text-on-accent transition-opacity duration-150 hover:opacity-95 disabled:opacity-60';

export const authGhostClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 border border-border bg-transparent px-5 text-sm font-medium text-text transition-colors duration-150 hover:bg-surface-2 disabled:opacity-60';
