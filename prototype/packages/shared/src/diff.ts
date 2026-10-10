import type { Diff, UISpec } from './schemas';

/** Panel ids are component ids, so a kept panel keeps its identity across compositions. */
export function computeDiff(
  prev: Pick<UISpec, 'panels'> | null,
  next: Pick<UISpec, 'panels'>,
): Diff | null {
  if (!prev) return null;
  const before = new Map(prev.panels.map((p) => [p.id, p]));
  const after = new Map(next.panels.map((p) => [p.id, p]));
  const added = next.panels.filter((p) => !before.has(p.id)).map((p) => p.id);
  const removed = prev.panels.filter((p) => !after.has(p.id)).map((p) => p.id);
  const kept = next.panels.filter((p) => before.has(p.id)).map((p) => p.id);
  const moved = kept.filter((id) => {
    const a = before.get(id)!;
    const b = after.get(id)!;
    return a.zone !== b.zone || a.size !== b.size;
  });
  return { added, removed, kept, moved };
}
