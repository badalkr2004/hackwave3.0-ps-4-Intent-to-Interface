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
      className="inline-flex min-h-8 max-w-full items-center gap-2 text-sm text-accent-text hover:underline"
    >
      <ArrowLeft aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">Back to {previousHeadline}</span>
    </button>
  );
}
