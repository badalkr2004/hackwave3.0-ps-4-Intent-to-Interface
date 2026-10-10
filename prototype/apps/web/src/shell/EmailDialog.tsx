import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle, X } from 'lucide-react';
import type { EmailDraftState } from '../store/workspace';

export function EmailDialog({
  email,
  onClose,
}: {
  email: EmailDraftState | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copiedFrom, setCopiedFrom] = useState<EmailDraftState | null>(null);
  const copied = !!email && copiedFrom === email;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (email && !dialog.open) dialog.showModal();
    if (!email && dialog.open) dialog.close();
  }, [email]);

  const copy = async () => {
    if (email?.status !== 'ready') return;
    await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
    setCopiedFrom(email);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="email-dialog-title"
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-text shadow-panel backdrop:bg-bg/70"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <h2 id="email-dialog-title" className="text-md font-medium">
          {email?.title ?? 'Email draft'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="px-4 py-4 text-sm">
        {email?.status === 'loading' && (
          <p className="flex items-center gap-2 text-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Drafting from the facts in
            scope…
          </p>
        )}
        {email?.status === 'error' && (
          <p role="alert" className="rounded-sm bg-danger-bg p-2 text-danger">
            {email.error}
          </p>
        )}
        {email?.status === 'ready' && (
          <div className="flex flex-col gap-3">
            <p>
              <span className="text-muted">Subject: </span>
              <span className="font-medium">{email.subject}</span>
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{email.body}</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={email?.status !== 'ready'}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copied ? 'Copied' : 'Copy draft'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-md bg-accent px-3 text-sm font-medium text-surface"
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
