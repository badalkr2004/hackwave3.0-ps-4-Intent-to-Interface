import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PanelProps, VizChart } from '@gestalt/shared';
import { formatCurrency, formatShortDate } from '../../lib/format';
import { analyticsUrlFor } from '../../lib/salesVizRequest';
import { useTokenColors } from '../../lib/useTokenColors';
import type { PanelViewProps } from '../types';
import { EmptyState } from '../ui';

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
};

const CHART_LABEL: Record<VizChart, string> = {
  pie: 'Pie',
  bars: 'Bars',
  trend: 'Trend',
  funnel: 'Funnel',
};

export function SalesPulse({ props, size }: PanelViewProps<'sales_pulse'>) {
  const colors = useTokenColors();
  const chart: VizChart = props.preferredChart ?? 'bars';
  const total = props.byStage.reduce((s, r) => s + r.amount, 0) || 1;
  const pieData = props.byStage
    .filter((s) => s.amount > 0)
    .map((s) => ({
      name: STAGE_LABEL[s.stage] ?? s.stage,
      value: s.amount,
      stage: s.stage,
    }));
  const barData = props.byStage
    .filter((s) => s.amount > 0)
    .map((s) => ({
      name: STAGE_LABEL[s.stage] ?? s.stage,
      amount: s.amount,
      stage: s.stage,
    }));
  const funnelData = [...barData].reverse();

  if (props.openDeals === 0 && props.pipelineValue === 0) {
    return <EmptyState message="No open pipeline for this organization." />;
  }

  const featured = chart !== 'bars' || size === 'L' || size === 'M';
  const chartH = featured ? (size === 'L' ? 200 : 160) : 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-snug text-text">{props.insight}</p>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Pipeline" value={formatCurrency(props.pipelineValue)} />
        <Metric label="Win rate" value={`${Math.round(props.winRate * 100)}%`} />
      </div>

      {chart === 'pie' && pieData.length > 0 && (
        <div className="w-full" style={{ height: Math.max(chartH, 180) }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={72}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell
                    key={entry.stage}
                    fill={i % 2 === 0 ? colors.accent : colors.muted}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {chart === 'bars' && barData.length > 0 && featured && (
        <div className={`w-full ${size === 'L' ? 'h-52' : 'h-40'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: colors.muted, fontSize: 12 }} />
              <YAxis
                tick={{ fill: colors.muted, fontSize: 12 }}
                tickFormatter={(v: number) => formatCurrency(v)}
                width={48}
              />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="amount" name="Pipeline" fill={colors.accent} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="amount"
                  position="top"
                  formatter={(v) => formatCurrency(Number(v))}
                  style={{ fill: colors.muted, fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chart === 'bars' && !featured && (
        <div className="flex h-2.5 overflow-hidden rounded-sm bg-surface-2" aria-hidden>
          {props.byStage.map((s) =>
            s.amount <= 0 ? null : (
              <div
                key={s.stage}
                title={`${STAGE_LABEL[s.stage] ?? s.stage}: ${formatCurrency(s.amount)}`}
                className="h-full bg-accent"
                style={{
                  width: `${(s.amount / total) * 100}%`,
                  opacity: 0.45 + (s.amount / total) * 0.55,
                }}
              />
            ),
          )}
        </div>
      )}

      {chart === 'funnel' && funnelData.length > 0 && (
        <div className="w-full" style={{ height: Math.max(chartH, 180) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={colors.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fill: colors.muted, fontSize: 11 }}
              />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="amount" name="Pipeline" fill={colors.accent} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chart === 'trend' && (
        <div className="w-full" style={{ height: Math.max(chartH, 160) }}>
          {props.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={props.trend}>
                <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: colors.muted, fontSize: 11 }}
                  tickFormatter={(v: string) => formatShortDate(v)}
                />
                <YAxis tick={{ fill: colors.muted, fontSize: 11 }} width={36} />
                <Tooltip labelFormatter={(v) => formatShortDate(String(v))} />
                <Line
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke={colors.accent}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted">No weekly marketing trend for this org yet.</p>
          )}
        </div>
      )}

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {props.byStage
          .filter((s) => s.amount > 0)
          .map((s) => (
            <li key={s.stage}>
              {STAGE_LABEL[s.stage] ?? s.stage} {formatCurrency(s.amount)}
            </li>
          ))}
      </ul>

      <p className="text-xs text-muted">
        Showing {CHART_LABEL[chart].toLowerCase()}
        {' · '}
        <a
          href={analyticsUrlFor({ chart })}
          className="font-medium text-accent-text underline-offset-2 hover:underline"
        >
          Open analytics explorer
        </a>
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-lg tracking-tight text-text">{value}</p>
    </div>
  );
}

export type SalesPulseProps = PanelProps<'sales_pulse'>;
