import { X } from 'lucide-react';
import type { Exclusion, Need, UISpec } from '@gestalt/shared';
import { WHY_DRAWER_HEADING_ID } from './ids';
import { groupedExclusions, NEED_SOURCE_LABEL } from './why';

export function WhyDrawer({
  spec,
  onClose,
  onBringBack,
}: {
  spec: UISpec;
  onClose: () => void;
  onBringBack: (item: Exclusion) => void;
}) {
  const groups = groupedExclusions(spec.excluded);
  const needs = [...spec.needs].sort(
    (a, b) => b.priority - a.priority || a.type.localeCompare(b.type),
  );

  return (
    <aside
      aria-labelledby={WHY_DRAWER_HEADING_ID}
      className="sheet flex flex-col gap-5 border-l-[3px] border-l-accent p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2
            id={WHY_DRAWER_HEADING_ID}
            tabIndex={-1}
            className="font-display text-lg text-text"
          >
            Why you see this
          </h2>
          <p className="mt-1 text-sm text-muted">
            Short notes on what was chosen for this job — and what was set aside.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close explanation"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <section aria-labelledby="left-out-heading">
        <h3 id="left-out-heading" className="text-sm font-medium text-text">
          Set aside
        </h3>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Everything useful for this job is on screen.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g.reason}>
                <h4 className="text-xs font-medium text-muted">{g.heading}</h4>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {g.items.map((item) => (
                    <li
                      key={item.componentId}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span>
                        <span className="font-medium text-text">{item.title}</span>
                        <span className="text-muted"> — {item.detail}</span>
                      </span>
                      {(item.reason === 'dismissed' || item.reason === 'no_space') && (
                        <button
                          type="button"
                          onClick={() => onBringBack(item)}
                          className="min-h-8 shrink-0 rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-2"
                        >
                          Show again
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="prioritized-heading">
        <h3 id="prioritized-heading" className="text-sm font-medium text-text">
          What mattered most
        </h3>
        <ol className="mt-2 flex flex-col gap-2">
          {needs.map((n: Need, i) => (
            <li key={n.type} className="text-sm">
              <span className="text-muted tabular-nums">{i + 1}. </span>
              <span className="font-medium text-text">{n.question}</span>
              <span className="text-muted"> · {NEED_SOURCE_LABEL[n.source]}</span>
              {n.reason && (n.source === 'llm_adjusted' || n.source === 'llm_added') && (
                <span className="mt-0.5 block text-xs text-muted">{n.reason}</span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
