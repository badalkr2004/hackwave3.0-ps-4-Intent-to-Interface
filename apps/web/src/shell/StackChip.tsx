import { ArrowLeft } from 'lucide-react';

export function StackChip({
  previousHeadline,
  onBack,
}: {
  previousHeadline: string | null;
  onBack: () => void;
}) {
  if (!previousHeadline) return null;
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs text-text hover:bg-surface-2"
    >
      <ArrowLeft aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">Back to {previousHeadline}</span>
    </button>
  );
}
