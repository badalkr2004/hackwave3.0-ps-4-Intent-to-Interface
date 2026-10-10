import type { Size } from '@gestalt/shared';

export type SkeletonVariant = 'list' | 'chart' | 'bars' | 'text' | 'buttons';

const ROWS: Record<Size, number> = { S: 2, M: 4, L: 6 };
const CHART_H: Record<Size, string> = { S: 'h-8', M: 'h-36', L: 'h-60' };

function Bar({ className }: { className: string }) {
  return (
    <div
      className={`h-3 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none ${className}`}
    />
  );
}

/** Skeleton geometry mirrors S/M/L panel body density. */
export function PanelSkeleton({ size, variant }: { size: Size; variant: SkeletonVariant }) {
  const rows = ROWS[size];
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {variant === 'chart' && (
        <div
          className={`w-full animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none ${CHART_H[size]}`}
        />
      )}
      {variant === 'buttons'
        ? Array.from({ length: Math.min(rows, 3) }, (_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none"
            />
          ))
        : Array.from({ length: variant === 'chart' ? 1 : rows }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Bar className={i % 2 === 0 ? 'w-full' : 'w-3/4'} />
              {variant !== 'bars' && <Bar className="w-1/2" />}
              {variant === 'bars' && (
                <div className="h-2 w-full animate-pulse rounded-full bg-surface-2 motion-reduce:animate-none" />
              )}
            </div>
          ))}
    </div>
  );
}
