import { useId, useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PanelProps } from '@gestalt/shared';
import { formatNumber, formatShortDate } from '../../lib/format';
import { useTokenColors } from '../../lib/useTokenColors';
import type { PanelViewProps } from '../types';
import { Delta, EmptyState } from '../ui';

type Point = PanelProps<'usage_trend'>['series'][number];

function weeklyRows(series: Point[]) {
  const rows: { from: string; to: string; avg: number }[] = [];
  for (let end = series.length; end > 0; end -= 7) {
    const week = series.slice(Math.max(0, end - 7), end);
    const first = week[0];
    const last = week[week.length - 1];
    if (!first || !last) continue;
    rows.unshift({
      from: first.date,
      to: last.date,
      avg: week.reduce((a, p) => a + p.value, 0) / week.length,
    });
  }
  return rows;
}

function Sparkline({ series }: { series: Point[] }) {
  const values = series.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map(
      (v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`,
    )
    .join(' ');
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="h-8 w-full text-accent"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function UsageTrend({ props, size }: PanelViewProps<'usage_trend'>) {
  const colors = useTokenColors();
  const patternId = `hatch-${useId().replace(/:/g, '')}`;
  const weeks = useMemo(() => weeklyRows(props.series), [props.series]);
  const { series } = props;
  const firstDate = series[0]?.date;
  const lastDate = series[series.length - 1]?.date;

  if (!firstDate || !lastDate) return <EmptyState message="No usage data for this scope." />;

  const releases = props.releases.filter((r) => r.date >= firstDate && r.date <= lastDate);
  const tick = { fill: colors.muted, fontSize: 12 };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Delta pct={props.changePct} className="text-xl" />
        <p className="text-sm text-muted">{props.summary}</p>
      </div>

      {size === 'S' ? (
        <Sparkline series={series} />
      ) : (
        <div aria-hidden className="w-full">
          <ResponsiveContainer width="100%" height={size === 'L' ? 260 : 170}>
            <ComposedChart
              data={series}
              margin={{ top: 16, right: 8, bottom: 0, left: -12 }}
              accessibilityLayer={false}
            >
              <defs>
                <pattern
                  id={patternId}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill={colors.danger} fillOpacity={0.06} />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke={colors.danger}
                    strokeWidth="2"
                    strokeOpacity={0.3}
                  />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke={colors.border} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={tick}
                stroke={colors.border}
                minTickGap={40}
              />
              <YAxis tick={tick} stroke={colors.border} width={44} />
              {props.anomalyStart && (
                <ReferenceArea
                  x1={props.anomalyStart}
                  x2={lastDate}
                  fill={`url(#${patternId})`}
                  label={{
                    value: 'Drop',
                    position: 'insideTopRight',
                    fill: colors.danger,
                    fontSize: 12,
                  }}
                />
              )}
              {releases.map((r) => (
                <ReferenceLine
                  key={r.id}
                  x={r.date}
                  stroke={colors.text}
                  strokeDasharray="3 3"
                  label={{ value: r.version, position: 'top', fill: colors.text, fontSize: 12 }}
                />
              ))}
              {size === 'L' && (
                <Line
                  dataKey="baseline"
                  name="Baseline"
                  stroke={colors.muted}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              <Line
                dataKey="value"
                name="Daily active users"
                stroke={colors.accent}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                labelFormatter={(d) => formatShortDate(String(d))}
                formatter={(v) => formatNumber(Number(v))}
                contentStyle={{
                  background: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  fontSize: 12,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {size === 'L' && (
        <p className="text-xs text-muted">
          Dashed grey line: weekday-adjusted baseline. Dashed vertical lines: releases. Hatched
          area: the drop.
        </p>
      )}

      <table className="sr-only">
        <caption>Weekly average daily active users, {props.scopeLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Average daily active users</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.from}>
              <th scope="row">
                {formatShortDate(w.from)} to {formatShortDate(w.to)}
              </th>
              <td>{formatNumber(w.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
