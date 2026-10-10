import { CircleHelp } from 'lucide-react';

export function WhyToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Why lens"
      title="Why lens (?)"
      onClick={onToggle}
      className={`inline-flex size-11 items-center justify-center rounded-md border text-sm ${on ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-surface text-text hover:bg-surface-2'}`}
    >
      <CircleHelp aria-hidden className="size-4" />
    </button>
  );
}
