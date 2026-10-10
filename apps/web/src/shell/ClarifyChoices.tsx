import { useEffect, useRef } from 'react';
import type { Interpretation } from '@gestalt/shared';

// Minimal clarification picker; ghost layout previews replace this list in M4.
export function ClarifyChoices({
  interpretations,
  onPick,
}: {
  interpretations: Interpretation[];
  onPick: (id: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [interpretations]);

  return (
    <section
      aria-labelledby="clarify-heading"
      className="rounded-lg border border-accent bg-accent-bg p-4"
    >
      <h2
        id="clarify-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-md font-medium text-text"
      >
        Which did you mean?
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {interpretations.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onPick(i.id)}
              className="flex min-h-11 flex-col items-start rounded-md border border-border bg-surface px-3 py-2 text-left hover:border-accent"
            >
              <span className="text-sm font-medium text-text">{i.label}</span>
              <span className="text-xs text-muted">{i.rationale}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
