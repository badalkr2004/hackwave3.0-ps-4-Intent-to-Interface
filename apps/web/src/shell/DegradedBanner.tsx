import { WifiOff } from 'lucide-react';

/** Visible when any stage fell back to fixtures or rules (Section 10). */
export function DegradedBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-md border border-border bg-warn-bg px-3 py-2 text-sm text-warn"
    >
      <WifiOff aria-hidden className="size-4 shrink-0" />
      Some content used offline mode. Layout and facts still come from your data; prose may be
      canned.
    </p>
  );
}
