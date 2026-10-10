import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { MANIFESTS_BY_ID, type GhostLayout, type Interpretation, type Size } from '@gestalt/shared';
import { confidenceWord } from './why';

const HEIGHT: Record<Size, string> = { S: 'h-4', M: 'h-7', L: 'h-10' };

function Mini({ layout }: { layout: GhostLayout }) {
  const cols: (keyof GhostLayout)[] = ['left', 'center', 'right'];
  const titles = cols.flatMap((zone) =>
    layout[zone].map((s) => MANIFESTS_BY_ID[s.componentId]?.title ?? s.componentId),
  );
  return (
    <div className="mt-3 grid grid-cols-3 gap-1 rounded-sm border border-border bg-bg p-1">
      <span className="sr-only">Preview of sections: {titles.join(', ')}</span>
      {cols.map((zone) => (
        <div key={zone} className="flex flex-col gap-1" aria-hidden>
          {layout[zone].map((slot) => (
            <div
              key={slot.componentId}
              title={MANIFESTS_BY_ID[slot.componentId]?.title ?? slot.componentId}
              className={`w-full rounded-sm bg-border ${HEIGHT[slot.size]}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GhostPreviews({
  interpretations,
  ghosts,
  onPick,
  onCancel,
}: {
  interpretations: Interpretation[];
  ghosts: Record<string, GhostLayout>;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const headingId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = listRef.current?.querySelector<HTMLButtonElement>('button[data-ghost]');
    first?.focus();
  }, [interpretations]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp'
    ) {
      return;
    }
    const buttons = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-ghost]') ?? []),
    ];
    const i = buttons.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : i - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  };

  return (
    <section aria-labelledby={headingId} onKeyDown={onKeyDown} className="sheet p-4 sm:p-5">
      <h2 id={headingId} className="font-display text-lg text-text">
        Which one did you mean?
      </h2>
      <p className="mt-1 text-sm text-muted">
        Pick the reading that matches. Press Escape to stay where you were.
      </p>
      <div ref={listRef} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {interpretations.map((i) => (
          <button
            key={i.id}
            type="button"
            data-ghost
            aria-label={`Choose: ${i.label}`}
            onClick={() => onPick(i.id)}
            className="flex min-h-11 flex-col rounded-md border border-border bg-bg p-4 text-left hover:border-accent"
          >
            <span className="text-sm font-medium text-text">{i.label}</span>
            <span className="mt-1 text-xs font-medium text-accent-text">
              {confidenceWord(interpretations, i.id)}
            </span>
            <span className="mt-2 text-sm text-muted">{i.rationale}</span>
            {ghosts[i.id] && <Mini layout={ghosts[i.id]!} />}
          </button>
        ))}
      </div>
    </section>
  );
}
