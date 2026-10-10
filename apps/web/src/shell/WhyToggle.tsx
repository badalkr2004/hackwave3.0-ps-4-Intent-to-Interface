/** Global Why lens switch — labeled, role=switch. */
export function WhyToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Show why"
      title="Show why (?)"
      onClick={onToggle}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 ${on ? 'border-accent bg-accent' : 'border-border-strong bg-surface-2'}`}
      >
        <span
          className={`size-3.5 rounded-full bg-surface shadow-panel transition-transform duration-150 ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </span>
      <span className="font-medium">{on ? 'Showing why' : 'Show why'}</span>
    </button>
  );
}
