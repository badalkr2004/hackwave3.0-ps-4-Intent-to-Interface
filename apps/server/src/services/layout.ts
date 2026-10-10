import { SIZE_BREAKS, SIZE_UNITS, ZONE_CAPACITY, type Size, type Zone } from '@gestalt/shared';

const SIZE_ORDER: readonly Size[] = ['S', 'M', 'L'];

export function sizeForScore(score: number): Size {
  if (score >= SIZE_BREAKS.L) return 'L';
  if (score >= SIZE_BREAKS.M) return 'M';
  return 'S';
}

/** Nearest supported size: round down if too large, up if too small, never below the smallest. */
export function clampSize(size: Size, supported: readonly Size[]): Size {
  if (supported.includes(size)) return size;
  const idx = SIZE_ORDER.indexOf(size);
  const ranks = supported.map((s) => SIZE_ORDER.indexOf(s)).sort((a, b) => a - b);
  const min = ranks[0]!;
  const max = ranks[ranks.length - 1]!;
  if (idx > max) return SIZE_ORDER[max]!;
  if (idx < min) return SIZE_ORDER[min]!;
  const below = ranks.filter((r) => r < idx);
  return SIZE_ORDER[below[below.length - 1] ?? min]!;
}

/** Supported sizes from `start` down to the smallest supported size. */
export function sizesDownFrom(start: Size, supported: readonly Size[]): Size[] {
  const idx = SIZE_ORDER.indexOf(start);
  return supported
    .filter((s) => SIZE_ORDER.indexOf(s) <= idx)
    .sort((a, b) => SIZE_ORDER.indexOf(b) - SIZE_ORDER.indexOf(a));
}

export interface PackCandidate {
  componentId: string;
  zone: Zone;
  order: number;
  score: number;
  pinned: boolean;
  desiredSize: Size;
  sizes: readonly Size[];
}

export interface PackedItem<C extends PackCandidate> {
  candidate: C;
  size: Size;
}

export interface PackResult<C extends PackCandidate> {
  placed: PackedItem<C>[];
  /** Candidates that did not fit, including unpinned panels evicted by a pin. */
  overflow: C[];
}

/** Deterministic priority: pinned first, then score descending, then id. */
export function byPriority(a: PackCandidate, b: PackCandidate): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.score - a.score || a.componentId.localeCompare(b.componentId);
}

/** Within a zone: placement-matrix order, ties by score descending, then id. */
export function byReadingOrder(a: PackCandidate, b: PackCandidate): number {
  return a.order - b.order || b.score - a.score || a.componentId.localeCompare(b.componentId);
}

/** Packs one zone's candidates into its size-unit budget. */
export function packZone<C extends PackCandidate>(
  zone: Zone,
  candidates: readonly C[],
): PackResult<C> {
  const capacity = ZONE_CAPACITY[zone];
  const placed: PackedItem<C>[] = [];
  const overflow: C[] = [];
  const used = () => placed.reduce((sum, p) => sum + SIZE_UNITS[p.size], 0);

  for (const c of [...candidates].sort(byPriority)) {
    const options = sizesDownFrom(c.desiredSize, c.sizes);
    const fit = options.find((s) => used() + SIZE_UNITS[s] <= capacity);
    if (fit) {
      placed.push({ candidate: c, size: fit });
      continue;
    }
    if (!c.pinned) {
      overflow.push(c);
      continue;
    }
    const smallest = options[options.length - 1] ?? c.desiredSize;
    while (used() + SIZE_UNITS[smallest] > capacity) {
      const evictable = placed
        .filter((p) => !p.candidate.pinned)
        .sort((a, b) => byPriority(b.candidate, a.candidate))[0];
      if (!evictable) break;
      placed.splice(placed.indexOf(evictable), 1);
      overflow.push(evictable.candidate);
    }
    if (used() + SIZE_UNITS[smallest] <= capacity) {
      const best = options.find((s) => used() + SIZE_UNITS[s] <= capacity) ?? smallest;
      placed.push({ candidate: c, size: best });
    } else {
      overflow.push(c);
    }
  }

  placed.sort((a, b) => byReadingOrder(a.candidate, b.candidate));
  return { placed, overflow };
}
