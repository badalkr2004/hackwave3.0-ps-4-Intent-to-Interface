import { useEffect, useId, useState } from 'react';
import type { StatusStage } from '@gestalt/shared';

const MAGIC_LINES = [
  'Personalizing things…',
  'Your intent is converting to interface…',
  'Components are bidding…',
  'Pulling the right panels forward…',
  'Arranging boxes to fit your ask…',
  'Tuning the workspace…',
] as const;

const STAGE_LINES: Record<StatusStage, string> = {
  parsing: 'Reading your request…',
  fetching: 'Pulling in the facts…',
  planning: 'Picking what helps…',
  composing: 'Arranging workspace…',
  writing: 'Writing the notes…',
};

const STARS = [
  { left: '18%', top: '22%', delay: '0s', scale: 0.7 },
  { left: '78%', top: '26%', delay: '0.9s', scale: 0.55 },
  { left: '24%', top: '72%', delay: '1.5s', scale: 0.6 },
  { left: '72%', top: '70%', delay: '0.4s', scale: 0.5 },
  { left: '50%', top: '14%', delay: '1.2s', scale: 0.45 },
  { left: '86%', top: '48%', delay: '1.8s', scale: 0.55 },
] as const;

const TILES = [
  { variant: 'list' as const, w: 'w-32', h: 'h-24', anim: 'compose-tile-a' },
  { variant: 'chart' as const, w: 'w-36', h: 'h-24', anim: 'compose-tile-b' },
  { variant: 'bars' as const, w: 'w-28', h: 'h-28', anim: 'compose-tile-c' },
  { variant: 'text' as const, w: 'w-36', h: 'h-20', anim: 'compose-tile-d' },
] as const;

function MiniSkeleton({ variant }: { variant: (typeof TILES)[number]['variant'] }) {
  if (variant === 'chart') {
    return (
      <div className="flex h-full flex-col justify-end gap-1.5 p-2.5">
        <div className="compose-shimmer h-2 w-1/2 rounded-sm" />
        <div className="flex flex-1 items-end gap-1 pt-1">
          <div className="compose-shimmer h-[40%] flex-1 rounded-sm" />
          <div className="compose-shimmer h-[70%] flex-1 rounded-sm" />
          <div className="compose-shimmer h-[55%] flex-1 rounded-sm" />
          <div className="compose-shimmer h-[85%] flex-1 rounded-sm" />
        </div>
      </div>
    );
  }
  if (variant === 'bars') {
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-2.5">
        <div className="compose-shimmer h-2 w-full rounded-full" />
        <div className="compose-shimmer h-2 w-4/5 rounded-full" />
        <div className="compose-shimmer h-2 w-3/5 rounded-full" />
        <div className="compose-shimmer h-2 w-2/3 rounded-full" />
      </div>
    );
  }
  if (variant === 'text') {
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-2.5">
        <div className="compose-shimmer h-2.5 w-3/4 rounded-sm" />
        <div className="compose-shimmer h-2 w-full rounded-sm" />
        <div className="compose-shimmer h-2 w-5/6 rounded-sm" />
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2 p-2.5">
      <div className="compose-shimmer h-2.5 w-2/3 rounded-sm" />
      <div className="compose-shimmer h-2 w-full rounded-sm" />
      <div className="compose-shimmer h-2 w-4/5 rounded-sm" />
      <div className="compose-shimmer mt-auto h-2 w-1/2 rounded-sm" />
    </div>
  );
}

function Star({
  left,
  top,
  delay,
  scale,
}: {
  left: string;
  top: string;
  delay: string;
  scale: number;
}) {
  return (
    <span aria-hidden className="pointer-events-none absolute" style={{ left, top }}>
      <span className="compose-star inline-block text-accent-text" style={{ animationDelay: delay }}>
        <svg
          width={14 * scale}
          height={14 * scale}
          viewBox="0 0 14 14"
          fill="currentColor"
          aria-hidden
        >
          <path d="M7 0.5L8.2 5.2L13 6.5L8.2 7.8L7 12.5L5.8 7.8L1 6.5L5.8 5.2L7 0.5Z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * Full-screen compose theater. Visible only while `open` is true —
 * unmounts immediately when work finishes (no artificial wait).
 */
export function ComposeOverlay({
  open,
  stage,
}: {
  open: boolean;
  stage: StatusStage | null;
}) {
  const labelId = useId();
  const [lineIndex, setLineIndex] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) {
      setLineIndex(0);
      setTick(0);
      return;
    }
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setLineIndex((i) => (i + 1) % MAGIC_LINES.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  // Prefer live stage line briefly when it advances; otherwise cycle magic copy.
  const stageLine = stage ? STAGE_LINES[stage] : null;
  const line =
    stageLine && tick % 2 === 0 ? stageLine : MAGIC_LINES[lineIndex % MAGIC_LINES.length];

  return (
    <div
      className="compose-overlay fixed inset-0 z-[60] flex items-center justify-center px-5"
      role="status"
      aria-live="polite"
      aria-labelledby={labelId}
    >
      <div className="compose-overlay-veil absolute inset-0" aria-hidden />

      <div className="compose-stage pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <div className="compose-stage-inner relative">
          {STARS.map((s, i) => (
            <Star key={i} {...s} />
          ))}
          {TILES.map((tile, i) => (
            <div
              key={i}
              className={`compose-tile absolute rounded-md border border-border/70 bg-surface/85 shadow-panel backdrop-blur-sm ${tile.w} ${tile.h} ${tile.anim}`}
              style={{ animationDelay: `${i * -2.4}s` }}
            >
              <MiniSkeleton variant={tile.variant} />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center gap-3 text-center">
        <div className="compose-orb" aria-hidden>
          <span className="compose-orb-core" />
          <span className="compose-orb-ring" />
        </div>
        <p
          id={labelId}
          key={`${line}-${tick}`}
          className="compose-line font-display text-lg tracking-tight text-text sm:text-xl"
        >
          {line}
        </p>
        <p className="text-13 text-muted">Shaping your workspace</p>
      </div>
    </div>
  );
}
