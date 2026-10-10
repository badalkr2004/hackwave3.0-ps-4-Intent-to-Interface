import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { MANIFESTS_BY_ID, type UISpec } from '@gestalt/shared';

const AUTO_COLLAPSE_MS = 8000;

const titleOf = (id: string) => MANIFESTS_BY_ID[id]?.title ?? id;

interface Row {
  id: string;
  title: string;
  detail: string;
}

function rows(spec: UISpec) {
  const diff = spec.diff!;
  const reasonFor = (id: string) => spec.receipts.find((r) => r.panelId === id)?.reason ?? '';
  const added: Row[] = diff.added.map((id) => ({ id, title: titleOf(id), detail: reasonFor(id) }));
  const removed: Row[] = diff.removed.map((id) => {
    const ex = spec.excluded.find((e) => e.componentId === id);
    return {
      id,
      title: ex?.title ?? titleOf(id),
      detail: ex && ex.reason !== 'not_relevant' ? ex.detail : 'No longer needed for this job.',
    };
  });
  const moved = new Set(diff.moved);
  const kept: Row[] = diff.kept.map((id) => ({
    id,
    title: titleOf(id),
    detail: moved.has(id) ? 'Moved or resized' : 'Same place',
  }));
  return { added, removed, kept };
}

function Section({ heading, items }: { heading: string; items: Row[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted">{heading}</h3>
      <ul className="flex flex-col gap-1">
        {items.map((r) => (
          <li key={r.id} className="text-sm">
            <span className="font-medium text-text">{r.title}</span>
            {r.detail && <span className="text-muted"> — {r.detail}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Plain “what changed” disclosure under the brief so nothing shifts in silence.
 * Remount per composition (key by spec id and version) so it starts collapsed.
 */
export function DiffRibbon({ spec }: { spec: UISpec }) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open || focused || hovered) return;
    const t = setTimeout(() => setOpen(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(t);
  }, [open, focused, hovered]);

  if (!spec.diff) return null;
  const { added, removed, kept } = rows(spec);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div
      className="relative"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-8 items-center gap-2 rounded-md border border-border bg-bg px-3 text-xs text-muted hover:border-border-strong hover:text-text"
      >
        <span>
          What changed ·{' '}
          <span className="text-success">{added.length} new</span>
          {' · '}
          {removed.length} aside · {kept.length} same
        </span>
        <ChevronDown
          aria-hidden
          className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={listId}
        hidden={!open}
        className="absolute top-full left-0 z-30 mt-2 flex w-[min(560px,calc(100vw-2.5rem))] flex-col gap-3 sheet p-4"
      >
        <Section heading="New here" items={added} />
        <Section heading="Set aside" items={removed} />
        <Section heading="Still here" items={kept} />
      </div>
    </div>
  );
}
