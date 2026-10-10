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
      className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 shadow-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={WHY_DRAWER_HEADING_ID} tabIndex={-1} className="text-md font-medium text-text">
          Why this layout
        </h2>
        <button
          type="button"
          aria-label="Close why lens"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <section aria-labelledby="left-out-heading">
        <h3 id="left-out-heading" className="text-sm font-medium text-text">
          Left out
        </h3>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing was left out of this layout.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g.reason}>
                <h4 className="text-xs font-medium tracking-wide text-muted uppercase">
                  {g.heading}
                </h4>
                <ul className="mt-1 flex flex-col gap-1">
                  {g.items.map((item) => (
                    <li
                      key={item.componentId}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span>
                        <span className="font-medium text-text">{item.title}</span>
                        <span className="text-muted">: {item.detail}</span>
                      </span>
                      {(item.reason === 'dismissed' || item.reason === 'no_space') && (
                        <button
                          type="button"
                          onClick={() => onBringBack(item)}
                          className="min-h-8 shrink-0 rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-2"
                        >
                          Bring back
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
          How I prioritized
        </h3>
        <ol className="mt-2 flex flex-col gap-1.5">
          {needs.map((n: Need) => (
            <li key={n.type} className="text-sm">
              <span className="font-medium text-text">{n.question}</span>
              <span className="text-muted">
                {' '}
                · {n.priority.toFixed(2)} · {NEED_SOURCE_LABEL[n.source]}
              </span>
              {n.reason && (n.source === 'llm_adjusted' || n.source === 'llm_added') && (
                <span className="block text-xs text-muted">{n.reason}</span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
