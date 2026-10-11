import { useMemo, useState } from 'react';
import { MANIFESTS, Shape, type ComponentId, type Panel } from '@gestalt/shared';
import { PanelActionsContext, type PanelActions } from '../panels/types';
import { PanelFrame } from '../shell/PanelFrame';
import { ZoneGrid } from '../shell/ZoneGrid';
import { EMPTY_PROPS, fixturePanel, fixtureSpec } from './fixtures';

type View = 'compositions' | 'components';

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-border bg-surface p-1"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`min-h-8 rounded-sm px-3 text-sm capitalize ${o === value ? 'bg-accent-bg font-medium text-accent-text' : 'text-muted hover:text-text'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function shapeFromUrl(): Shape {
  const q = new URLSearchParams(window.location.search).get('shape');
  return Shape.options.includes(q as Shape) ? (q as Shape) : 'overview';
}

function Compositions() {
  const [shape, setShape] = useState<Shape>(shapeFromUrl);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const spec = useMemo(() => fixtureSpec(shape), [shape]);

  const selectShape = (next: Shape) => {
    setShape(next);
    const url = new URL(window.location.href);
    url.searchParams.set('shape', next);
    window.history.replaceState(null, '', url);
  };
  const panels = spec.panels
    .filter((p) => !dismissed.has(p.id))
    .map((p) => ({ ...p, pinned: pinned.has(p.id) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Task shape" options={Shape.options} value={shape} onChange={selectShape} />
        {dismissed.size > 0 && (
          <button
            type="button"
            onClick={() => setDismissed(new Set())}
            className="min-h-8 rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2"
          >
            Bring back {dismissed.size} dismissed
          </button>
        )}
      </div>
      <div>
        <p className="text-xl font-medium text-text">{spec.intent.headline}</p>
        <p className="text-sm text-muted">{spec.intent.summary}</p>
      </div>
      <ZoneGrid
        panels={panels}
        receipts={spec.receipts}
        needs={spec.needs}
        onTogglePin={(id, on) =>
          setPinned((s) => {
            const next = new Set(s);
            if (on) next.add(id);
            else next.delete(id);
            return next;
          })
        }
        onDismiss={(id) => setDismissed((s) => new Set(s).add(id))}
      />
    </div>
  );
}

function Components() {
  const variants = (
    id: ComponentId,
    sizes: readonly Panel['size'][],
  ): { label: string; panel: Panel }[] => [
    ...sizes.map((size) => ({ label: `Size ${size}`, panel: fixturePanel('diagnose', id, size) })),
    {
      label: 'Loading',
      panel: fixturePanel('diagnose', id, sizes[sizes.length - 1]!, { status: 'loading' }),
    },
    { label: 'Empty', panel: fixturePanel('diagnose', id, sizes[0]!, { props: EMPTY_PROPS[id] }) },
    {
      label: 'Invalid props',
      panel: fixturePanel('diagnose', id, sizes[0]!, { props: { broken: true } }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {MANIFESTS.map((m) => {
        const id = m.id as ComponentId;
        return (
          <section key={id} aria-labelledby={`gallery-${id}`} className="flex flex-col gap-3">
            <h2 id={`gallery-${id}`} className="text-lg font-medium text-text">
              {m.title} <span className="font-mono text-xs text-muted">{id}</span>
            </h2>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {variants(id, m.sizes).map(({ label, panel }) => (
                <div key={label} className="flex flex-col gap-1">
                  <p className="text-xs text-muted">{label}</p>
                  <PanelFrame
                    panel={{ ...panel, id: `${id}-${label.replace(/\W+/g, '-').toLowerCase()}` }}
                    lensOn={false}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function Gallery() {
  const [view, setView] = useState<View>('compositions');
  const [lastAction, setLastAction] = useState('');
  const actions: PanelActions = useMemo(
    () => ({ runAction: (a) => setLastAction(`Action triggered: ${a.label}`) }),
    [],
  );

  return (
    <PanelActionsContext.Provider value={actions}>
      <a
        href="#gallery"
        className="sr-only-focusable fixed top-4 left-4 z-50 rounded-md bg-surface px-4 py-2 text-sm text-text shadow-panel"
      >
        Skip to gallery
      </a>
      <header className="content-shell mx-auto flex w-full flex-wrap items-end justify-between gap-4 px-5 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-medium text-text">Component gallery</h1>
          <p className="text-sm text-muted">
            Dev route: fixture compositions and every panel at each size and state.
          </p>
        </div>
        <Segmented
          label="Gallery view"
          options={['compositions', 'components'] as const}
          value={view}
          onChange={setView}
        />
      </header>
      <main id="gallery" className="content-shell mx-auto w-full px-5 pb-10">
        {view === 'compositions' ? <Compositions /> : <Components />}
      </main>
      <footer className="content-shell mx-auto w-full px-5 pb-6 text-xs text-muted">
        <p aria-live="polite">{lastAction}</p>
        <a href="/app" className="text-accent-text underline">
          Back to app
        </a>
      </footer>
    </PanelActionsContext.Provider>
  );
}
