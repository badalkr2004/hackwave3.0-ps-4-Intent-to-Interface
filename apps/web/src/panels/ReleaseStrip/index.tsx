import { useState } from 'react';
import { OctagonAlert, Rocket } from 'lucide-react';
import { daysAgoLabel, formatShortDate, inDaysLabel } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { Badge, EmptyState } from '../ui';

type Marker =
  { kind: 'release'; id: string; date: string } | { kind: 'anomaly'; id: 'anomaly'; date: string };

export function ReleaseStrip({ props, size }: PanelViewProps<'release_strip'>) {
  const releases = [...props.releases].sort((a, b) => a.date.localeCompare(b.date));
  const [selectedId, setSelectedId] = useState<string | null>(
    props.correlatedReleaseId ?? releases.filter((r) => r.released).at(-1)?.id ?? null,
  );
  if (releases.length === 0) return <EmptyState message="No releases in this window." />;

  const correlated = releases.find((r) => r.id === props.correlatedReleaseId) ?? null;
  const selected = releases.find((r) => r.id === selectedId) ?? null;
  const summary = correlated
    ? `${correlated.version} shipped ${daysAgoLabel(correlated.daysAgo).toLowerCase()}, just before the drop started${props.anomalyStart ? ` on ${formatShortDate(props.anomalyStart)}` : ''}.`
    : 'No release lines up with the change.';

  if (size === 'S') return <p className="text-sm text-text">{summary}</p>;

  const markers: Marker[] = [
    ...releases.map((r) => ({ kind: 'release' as const, id: r.id, date: r.date })),
    ...(props.anomalyStart
      ? [{ kind: 'anomaly' as const, id: 'anomaly' as const, date: props.anomalyStart }]
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'release' ? -1 : 1));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text">{summary}</p>
      <ol
        aria-label="Release timeline"
        className="relative grid auto-cols-fr grid-flow-col items-start gap-1"
      >
        <span aria-hidden className="absolute top-4 right-0 left-0 h-px bg-border" />
        {markers.map((m) => {
          if (m.kind === 'anomaly') {
            return (
              <li
                key={m.id}
                className="relative flex min-w-0 flex-col items-center gap-1 text-center"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-danger-bg text-danger">
                  <OctagonAlert aria-hidden className="size-4" />
                </span>
                <span className="text-xs font-medium text-danger">Drop starts</span>
                <span className="text-xs text-muted">{formatShortDate(m.date)}</span>
              </li>
            );
          }
          const r = releases.find((x) => x.id === m.id)!;
          const isSel = r.id === selectedId;
          return (
            <li key={r.id} className="relative flex min-w-0 flex-col items-center">
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => setSelectedId(r.id)}
                className={`flex min-h-8 w-full flex-col items-center gap-1 rounded-md px-1 pb-1 text-center ${isSel ? 'bg-accent-bg' : 'hover:bg-surface-2'}`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full border ${r.released ? 'border-accent bg-surface text-accent' : 'border-dashed border-border-strong bg-surface text-muted'}`}
                >
                  <Rocket aria-hidden className="size-4" />
                </span>
                <span className="text-xs font-medium text-text">{r.version}</span>
                <span className="text-xs text-muted">
                  {r.released ? formatShortDate(r.date) : `Planned ${formatShortDate(r.date)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {selected && (
        <div className="rounded-md bg-surface-2 p-3 text-sm" aria-live="polite">
          <p className="flex flex-wrap items-center gap-2 font-medium text-text">
            {selected.version}
            <span className="text-xs font-normal text-muted">
              {selected.released ? daysAgoLabel(selected.daysAgo) : inDaysLabel(-selected.daysAgo)}
            </span>
            {selected.id === props.correlatedReleaseId && (
              <Badge tone="danger" icon={OctagonAlert}>
                Lines up with drop
              </Badge>
            )}
          </p>
          {selected.notes && <p className="mt-1 text-muted">{selected.notes}</p>}
          {selected.features.length > 0 && (
            <p className="mt-1 text-xs text-muted">Touched: {selected.features.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
