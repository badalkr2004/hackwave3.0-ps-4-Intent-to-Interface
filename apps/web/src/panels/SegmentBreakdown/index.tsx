import { formatNumber, formatPct } from '../../lib/format';
import type { PanelViewProps } from '../types';
import { EmptyState } from '../ui';

export function SegmentBreakdown({ props, size }: PanelViewProps<'segment_breakdown'>) {
  const groups = props.groups.filter((g) => g.segments.length > 0);
  if (groups.length === 0) return <EmptyState message="No segment data for this scope." />;
  const maxAbs = Math.max(
    10,
    ...groups.flatMap((g) => g.segments.map((s) => Math.abs(s.deltaPct))),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{props.summary}</p>
      <div className={`grid gap-4 ${size === 'L' ? 'sm:grid-cols-2' : ''}`}>
        {groups.map((g) => {
          const segments = [...g.segments].sort((a, b) => a.deltaPct - b.deltaPct);
          return (
            <section key={g.dimension} aria-label={`Change by ${g.label.toLowerCase()}`}>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                {g.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {segments.map((s, i) => {
                  const width = (Math.abs(s.deltaPct) / maxAbs) * 100;
                  const down = s.deltaPct < 0;
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm"
                    >
                      <span className="truncate text-text">
                        {s.label}
                        {i === 0 && down && <span className="sr-only"> (largest drop)</span>}
                      </span>
                      <span aria-hidden className="h-3 rounded-sm bg-surface-2">
                        <span
                          className={`block h-full rounded-sm ${down ? (i === 0 ? 'bg-danger' : 'bg-border-strong') : 'bg-success'}`}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span
                        className={`text-right font-medium tabular-nums ${down && i === 0 ? 'text-danger' : 'text-text'}`}
                      >
                        {formatPct(s.deltaPct)}
                        {size === 'L' && (
                          <span className="block text-xs font-normal text-muted">
                            {formatNumber(s.before)} → {formatNumber(s.after)} DAU
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
