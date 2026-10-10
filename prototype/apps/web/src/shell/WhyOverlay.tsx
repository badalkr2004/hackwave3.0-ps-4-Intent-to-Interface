import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { NEED_QUESTIONS, type Need, type Receipt } from '@gestalt/shared';
import { needAdjustment, scoreLine } from './why';

function WhyDetails({
  receipt,
  needs,
  panelQuestion,
}: {
  receipt: Receipt;
  needs: Need[];
  /** Panel header text — never repeated inside the explanation. */
  panelQuestion: string;
}) {
  const needQ = NEED_QUESTIONS[receipt.need];
  const evidence = receipt.evidence.slice(0, 3);
  const adjustment = needAdjustment(needs, receipt.need);
  const showNeed = needQ !== panelQuestion;

  return (
    <div className="flex flex-col gap-1.5 text-sm leading-snug text-muted">
      {showNeed && <p className="text-text">{needQ}</p>}
      <p className="tabular-nums text-text">{scoreLine(receipt.score, receipt.size)}</p>
      {evidence.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {evidence.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
      {adjustment && <p>{adjustment}</p>}
    </div>
  );
}

/** Global lens: one-line strip under the panel header (no fill box). */
export function WhyOverlay({
  receipt,
  needs,
  panelQuestion,
}: {
  receipt: Receipt;
  needs: Need[];
  panelQuestion: string;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <div className="mx-4 mt-2 border-l-2 border-accent pl-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <p className="tabular-nums text-text">{scoreLine(receipt.score, receipt.size)}</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-accent-text underline-offset-2 hover:underline"
        >
          {open ? 'Hide details' : 'Details'}
        </button>
      </div>
      {open && (
        <div id={detailsId} className="mt-2">
          <WhyDetails receipt={receipt} needs={needs} panelQuestion={panelQuestion} />
        </div>
      )}
    </div>
  );
}

/** Per-panel progressive disclosure when global lens is off. */
export function WhyPopover({
  receipt,
  needs,
  panelQuestion,
}: {
  receipt: Receipt;
  needs: Need[];
  panelQuestion: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Why is this shown?"
        aria-expanded={open}
        aria-controls={panelId}
        title="Why is this shown?"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
      >
        <CircleHelp aria-hidden className="size-4" />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Why this panel is shown"
          className="absolute top-full right-0 z-40 mt-1 w-72 sheet p-3"
        >
          <WhyDetails receipt={receipt} needs={needs} panelQuestion={panelQuestion} />
        </div>
      )}
    </div>
  );
}
