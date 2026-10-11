import { useId, useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Dot,
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

/** Compute a monotone-cubic Bézier path string for sparkline smoothness. */
function buildSparkPath(values: number[], w = 100, h = 30, padY = 1): string {
  if (values.length < 2) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / Math.max(1, values.length - 1)) * w,
    y: h - padY - ((v - min) / span) * (h - 2 * padY),
  }));
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const cpx = (prev.x + cur.x) / 2;
    d += ` C${cpx},${prev.y} ${cpx},${cur.y} ${cur.x},${cur.y}`;
  }
  return d;
}

function Sparkline({ series }: { series: Point[] }) {
  const values = series.map((p) => p.value);
  const d = buildSparkPath(values);
  const lastPt = values.length
    ? {
        x: 100,
        y:
          30 -
          1 -
          ((values[values.length - 1]! - Math.min(...values)) /
            (Math.max(...values) - Math.min(...values) || 1)) *
            28,
      }
    : null;

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="h-8 w-full"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* area fill */}
      <path
        d={`${d} L100,30 L0,30 Z`}
        fill="url(#spark-fill)"
      />
      {/* line */}
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-path"
      />
      {/* end dot */}
      {lastPt && (
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r="1.5"
          fill="var(--accent)"
          vectorEffect="non-scaling-stroke"
          className="sparkline-dot"
        >
          <animate
            attributeName="r"
            values="1.5;2.5;1.5"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}


function EndDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: Point;
  lastIndex: number;
  fill: string;
  labelColor: string;
}) {
  const { cx, cy, index, payload, lastIndex, fill, labelColor } = props;
  if (index !== lastIndex || cx == null || cy == null || !payload) return null;
  return (
    <g>
      <Dot cx={cx} cy={cy} r={4} fill={fill} stroke={fill} />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="end"
        fill={labelColor}
        fontSize={12}
        className="tabular"
      >
        {formatNumber(payload.value)}
      </text>
    </g>
  );
}

export function UsageTrend({ props, size }: PanelViewProps<'usage_trend'>) {
  const colors = useTokenColors();
  const patternId = `hatch-${useId().replace(/:/g, '')}`;
  const weeks = useMemo(() => weeklyRows(props.series), [props.series]);
  const { series } = props;
  const firstDate = series[0]?.date;
  const lastDate = series[series.length - 1]?.date;
  const values = series.map((p) => p.value);
  const yMin = values.length ? Math.min(...values) : 0;
  const yMax = values.length ? Math.max(...values) : 1;
  const pad = Math.max(1, (yMax - yMin) * 0.08);

  if (!firstDate || !lastDate) {
    return <EmptyState message="No usage data for this scope yet. Try another client or range." />;
  }

  const releases = props.releases.filter((r) => r.date >= firstDate && r.date <= lastDate);
  const tick = { fill: colors.muted, fontSize: 12 };
  const lastIndex = series.length - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Delta pct={props.changePct} className="text-xl tabular" />
        <p className="text-sm text-muted">{props.summary}</p>
      </div>

      {size === 'S' ? (
        <Sparkline series={series} />
      ) : (
        <div className="w-full">
          <ResponsiveContainer width="100%" height={size === 'L' ? 260 : 170}>
            <ComposedChart
              data={series}
              margin={{ top: 20, right: 12, bottom: 4, left: 0 }}
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
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={tick}
                stroke={colors.border}
                minTickGap={36}
              />
              <YAxis
                tick={tick}
                stroke={colors.border}
                width={44}
                domain={[Math.floor(yMin - pad), Math.ceil(yMax + pad)]}
                tickFormatter={(v: number) => formatNumber(v)}
              />
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
              {(size === 'L' || size === 'M') && (
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
                isAnimationActive={false}
                dot={(dotProps) => (
                  <EndDot
                    {...dotProps}
                    lastIndex={lastIndex}
                    fill={colors.accent}
                    labelColor={colors.text}
                  />
                )}
                activeDot={{ r: 4, fill: colors.accent }}
              />
              <Tooltip
                labelFormatter={(d) => formatShortDate(String(d))}
                formatter={(v) => [formatNumber(Number(v)), 'Daily active users']}
                contentStyle={{
                  background: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  fontSize: 13,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {size === 'L' && (
        <p className="text-xs text-muted">
          Dashed line: weekday-adjusted baseline. Vertical dashes: releases. Hatched area: the
          drop.
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
