export function WhyToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Hide explanations' : 'Explain this view'}
      title="Explain this view (?)"
      onClick={onToggle}
      className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium ${on ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-surface text-text hover:bg-surface-2'}`}
    >
      {on ? 'Hide why' : 'Explain'}
    </button>
  );
}
