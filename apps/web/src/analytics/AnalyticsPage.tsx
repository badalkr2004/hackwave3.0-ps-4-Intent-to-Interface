import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  LoaderCircle,
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Filter,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchAnalytics,
  fetchMe,
  type AnalyticsRange,
  type AnalyticsReport,
  type OrgSummary,
} from '../lib/orgApi';
import { formatCurrency, formatNumber, formatShortDate } from '../lib/format';
import { isVizChart, type VizChart } from '../lib/salesVizRequest';
import { useTokenColors } from '../lib/useTokenColors';

type ChartMode = VizChart;
type TableMode = 'deals' | 'campaigns';

function chartFromUrl(): ChartMode {
  const chart = new URLSearchParams(window.location.search).get('chart');
  return isVizChart(chart) ? chart : 'trend';
}

function rangeFromUrl(): AnalyticsRange {
  const range = new URLSearchParams(window.location.search).get('range');
  return range === '30d' || range === 'ytd' ? range : '90d';
}

function clientFromUrl(): string {
  return new URLSearchParams(window.location.search).get('clientId') ?? '';
}

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  paid_search: 'Paid search',
  social: 'Social',
  event: 'Event',
  partner: 'Partner',
  content: 'Content',
  referral: 'Referral',
};

export function AnalyticsPage() {
  const colors = useTokenColors();
  const [booting, setBooting] = useState(true);
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [range, setRange] = useState<AnalyticsRange>(rangeFromUrl);
  const [clientId, setClientId] = useState<string>(clientFromUrl);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>(chartFromUrl);
  const [stageFocus, setStageFocus] = useState<string | null>(null);
  const [channelFocus, setChannelFocus] = useState<string | null>(null);
  const [tableMode, setTableMode] = useState<TableMode>('deals');

  // Keep URL in sync so "pie chart" links and shared URLs stay accurate.
  useEffect(() => {
    const q = new URLSearchParams();
    q.set('chart', chartMode);
    q.set('range', range);
    if (clientId) q.set('clientId', clientId);
    const next = `${window.location.pathname}?${q.toString()}`;
    window.history.replaceState(null, '', next);
  }, [chartMode, range, clientId]);

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (!me.authEnabled || !me.user) {
          window.location.replace('/login?next=/analytics');
          return;
        }
        if (me.orgs.length === 0) {
          window.location.replace('/onboard');
          return;
        }
        const active =
          me.orgs.find((o) => o.id === me.activeOrganizationId) ?? me.orgs[0] ?? null;
        setOrg(active);
        setBooting(false);
      })
      .catch(() => {
        if (!cancelled) window.location.replace('/login?next=/analytics');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void fetchAnalytics(org.id, { range, clientId: clientId || null })
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setClients(r.byClient.map((c) => ({ id: c.clientId, name: c.clientName })));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load analytics');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org?.id, range, clientId]);

  const filteredDeals = useMemo(() => {
    if (!report) return [];
    return report.opportunities.filter((o) => {
      if (stageFocus && o.stage !== stageFocus) return false;
      if (channelFocus && o.sourceChannel !== channelFocus) return false;
      return true;
    });
  }, [report, stageFocus, channelFocus]);

  const filteredCampaigns = useMemo(() => {
    if (!report) return [];
    return report.campaigns.filter((c) => {
      if (channelFocus && c.channel !== channelFocus) return false;
      return true;
    });
  }, [report, channelFocus]);

  const pieData = useMemo(
    () =>
      (report?.byStage ?? [])
        .filter((s) => s.amount > 0 && s.stage !== 'lost')
        .map((s) => ({ name: STAGE_LABEL[s.stage] ?? s.stage, value: s.amount, stage: s.stage })),
    [report],
  );

  const barData = useMemo(
    () =>
      (report?.byClient ?? []).map((c) => ({
        name: c.clientName.split(' ')[0] ?? c.clientName,
        pipeline: c.pipeline,
        won: c.won,
        clientId: c.clientId,
      })),
    [report],
  );

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
        Opening analytics…
      </div>
    );
  }

  const k = report?.kpis;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:underline"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Workspace
          </a>
          <p className="mt-3 font-display text-3xl tracking-tight text-text">Analytics</p>
          <p className="mt-1 text-sm text-muted">
            {org?.name ?? 'Organization'} · sales pipeline & marketing performance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted">
            Range
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as AnalyticsRange)}
              className="mt-1 min-h-10 block rounded-md border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="ytd">Year to date</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Client
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setStageFocus(null);
                setChannelFocus(null);
              }}
              className="mt-1 min-h-10 block min-w-[10rem] rounded-md border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {busy && !report ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading report…
        </p>
      ) : report && k ? (
        <div className="auth-fade mt-8 flex flex-col gap-10">
          <p className="auth-fade-late max-w-2xl font-display text-xl leading-snug tracking-tight text-text sm:text-2xl">
            {report.insight}
          </p>

          <dl className="grid grid-cols-2 gap-6 border-b border-border pb-8 sm:grid-cols-4">
            <Kpi label="Open pipeline" value={formatCurrency(k.pipelineValue)} />
            <Kpi label="Weighted forecast" value={formatCurrency(k.weightedForecast)} />
            <Kpi label="Win rate" value={`${Math.round(k.winRate * 100)}%`} />
            <Kpi label="Campaign spend" value={formatCurrency(k.campaignSpend)} />
          </dl>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg text-text">Performance</h2>
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Chart type">
                {(
                  [
                    ['trend', 'Trend', LineIcon],
                    ['bars', 'Bars', BarChart3],
                    ['pie', 'Pie', PieIcon],
                    ['funnel', 'Funnel', Filter],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={chartMode === id}
                    onClick={() => setChartMode(id)}
                    className={`inline-flex min-h-9 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors ${
                      chartMode === id
                        ? 'border-accent font-medium text-text'
                        : 'border-transparent text-muted hover:text-text'
                    }`}
                  >
                    <Icon aria-hidden className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'trend' ? (
                  <LineChart data={report.trend}>
                    <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: colors.muted, fontSize: 11 }}
                      tickFormatter={(v: string) => formatShortDate(v)}
                    />
                    <YAxis tick={{ fill: colors.muted, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke={colors.accent}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      name="Spend"
                      stroke={colors.muted}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                ) : chartMode === 'bars' ? (
                  <BarChart data={barData}>
                    <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: colors.muted, fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: colors.muted, fontSize: 11 }}
                      tickFormatter={(v: number) => formatCurrency(v)}
                    />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      contentStyle={{
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="pipeline"
                      name="Pipeline"
                      fill={colors.accent}
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(d) => {
                        const id = (d as { clientId?: string }).clientId;
                        if (id) setClientId(id);
                      }}
                    />
                    <Bar dataKey="won" name="Won" fill={colors.muted} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : chartMode === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(_, i) => {
                        const row = pieData[i];
                        if (row) setStageFocus((s) => (s === row.stage ? null : row.stage));
                      }}
                    >
                      {pieData.map((entry, i) => (
                        <Cell
                          key={entry.stage}
                          fill={i % 2 === 0 ? colors.accent : colors.muted}
                          opacity={stageFocus && stageFocus !== entry.stage ? 0.35 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                  </PieChart>
                ) : (
                  <BarChart data={report.funnel} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid stroke={colors.border} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: colors.muted, fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="step"
                      width={100}
                      tick={{ fill: colors.muted, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                      }}
                    />
                    <Bar dataKey="count" name="Count" fill={colors.accent} radius={[0, 4, 4, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {(stageFocus || channelFocus) && (
              <p className="mt-2 text-xs text-muted">
                Filter active
                {stageFocus ? `: stage ${STAGE_LABEL[stageFocus] ?? stageFocus}` : ''}
                {channelFocus ? `: channel ${CHANNEL_LABEL[channelFocus] ?? channelFocus}` : ''}.{' '}
                <button
                  type="button"
                  className="text-accent-text underline"
                  onClick={() => {
                    setStageFocus(null);
                    setChannelFocus(null);
                  }}
                >
                  Clear
                </button>
              </p>
            )}
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <section>
              <h2 className="font-display text-lg text-text">Win / loss reasons</h2>
              {report.winLoss.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No lost deals in this range.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {report.winLoss.map((w) => (
                    <li
                      key={w.reason}
                      className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm"
                    >
                      <span className="text-text">{w.reason}</span>
                      <span className="shrink-0 text-muted">
                        {w.count} · {formatCurrency(w.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="font-display text-lg text-text">Channel mix</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {report.byChannel.map((c) => (
                  <li key={c.channel}>
                    <button
                      type="button"
                      onClick={() =>
                        setChannelFocus((ch) => (ch === c.channel ? null : c.channel))
                      }
                      className={`flex w-full items-baseline justify-between gap-3 border-b border-border py-2 text-left text-sm hover:text-accent-text ${
                        channelFocus === c.channel ? 'text-accent-text' : 'text-text'
                      }`}
                    >
                      <span>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                      <span className="shrink-0 text-muted">
                        {formatCurrency(c.spend)} · {formatNumber(c.leads)} leads
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg text-text">Detail</h2>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setTableMode('deals')}
                  className={
                    tableMode === 'deals' ? 'font-medium text-text' : 'text-muted hover:text-text'
                  }
                >
                  Deals ({filteredDeals.length})
                </button>
                <span className="text-border-strong">|</span>
                <button
                  type="button"
                  onClick={() => setTableMode('campaigns')}
                  className={
                    tableMode === 'campaigns'
                      ? 'font-medium text-text'
                      : 'text-muted hover:text-text'
                  }
                >
                  Campaigns ({filteredCampaigns.length})
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {tableMode === 'deals' ? (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Deal</th>
                      <th className="py-2 pr-3 font-medium">Client</th>
                      <th className="py-2 pr-3 font-medium">Stage</th>
                      <th className="py-2 pr-3 font-medium">Amount</th>
                      <th className="py-2 font-medium">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map((o) => (
                      <tr
                        key={o.id}
                        className="cursor-pointer border-b border-border/70 hover:bg-surface-2/50"
                        onClick={() => {
                          setClientId(o.clientId);
                          setStageFocus(o.stage);
                        }}
                      >
                        <td className="py-2.5 pr-3 text-text">{o.name}</td>
                        <td className="py-2.5 pr-3 text-muted">{o.clientName}</td>
                        <td className="py-2.5 pr-3 text-muted">
                          {STAGE_LABEL[o.stage] ?? o.stage}
                        </td>
                        <td className="py-2.5 pr-3 text-text">{formatCurrency(o.amount)}</td>
                        <td className="py-2.5 text-muted">
                          {o.expectedClose ? formatShortDate(o.expectedClose) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Campaign</th>
                      <th className="py-2 pr-3 font-medium">Channel</th>
                      <th className="py-2 pr-3 font-medium">Spend</th>
                      <th className="py-2 pr-3 font-medium">Leads</th>
                      <th className="py-2 font-medium">Attributed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-border/70 hover:bg-surface-2/50"
                        onClick={() => setChannelFocus(c.channel)}
                      >
                        <td className="py-2.5 pr-3 text-text">{c.name}</td>
                        <td className="py-2.5 pr-3 text-muted">
                          {CHANNEL_LABEL[c.channel] ?? c.channel}
                        </td>
                        <td className="py-2.5 pr-3 text-text">{formatCurrency(c.spend)}</td>
                        <td className="py-2.5 pr-3 text-muted">{formatNumber(c.leads)}</td>
                        <td className="py-2.5 text-muted">
                          {formatCurrency(c.revenueAttributed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-2xl tracking-tight text-text">{value}</dd>
    </div>
  );
}
