import type { Size } from '@gestalt/shared';

export type SkeletonVariant = 'list' | 'chart' | 'bars' | 'text' | 'buttons';

const ROWS: Record<Size, number> = { S: 2, M: 4, L: 6 };

function Bar({ w }: { w: string }) {
  return (
    <div
      className="h-3 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none"
      style={{ width: w }}
    />
  );
}

export function PanelSkeleton({ size, variant }: { size: Size; variant: SkeletonVariant }) {
  const rows = ROWS[size];
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {variant === 'chart' && size !== 'S' && (
        <div
          className={`w-full animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none ${size === 'L' ? 'h-60' : 'h-36'}`}
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
              <Bar w={`${85 - ((i * 17) % 40)}%`} />
              {variant !== 'bars' && <Bar w={`${55 - ((i * 11) % 25)}%`} />}
              {variant === 'bars' && <div className="h-2 w-full rounded-full bg-surface-2" />}
            </div>
          ))}
    </div>
  );
}
