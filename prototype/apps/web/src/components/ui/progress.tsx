import { cn } from '../../lib/utils';

/** Lightweight progress bar (no Radix) — avoids rare client runtime issues. */
export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
