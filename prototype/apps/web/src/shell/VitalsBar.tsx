import { useMemo } from 'react';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import type { UISpec } from '@gestalt/shared';

interface Vital {
  label: string;
  value: string;
  icon: typeof Activity;
  tone?: 'default' | 'danger' | 'warn' | 'success';
}

/**
 * Executive Vitals Bar — compact key-metric strip rendered below the headline.
 * Extracts portfolio-level KPIs from the current spec panels.
 */
export function VitalsBar({ spec }: { spec: UISpec | null }) {
  const vitals = useMemo<Vital[]>(() => {
    if (!spec) return [];

    const out: Vital[] = [];
    const panels = spec.panels as Array<{ componentId: string; props: Record<string, unknown> }>;

    // Portfolio health
    const phPanel = panels.find((p) => p.componentId === 'portfolio_health');
    if (phPanel) {
      const ph = phPanel.props as { atRiskCount?: number; clients?: unknown[]; totalArr?: number };
      if (ph.atRiskCount != null && ph.clients) {
        out.push({
          label: 'At risk',
          value: `${ph.atRiskCount}/${ph.clients.length}`,
          icon: AlertTriangle,
          tone: ph.atRiskCount > 0 ? 'danger' : 'success',
        });
      }
      if (ph.totalArr != null) {
        const formatted =
          ph.totalArr >= 1_000_000
            ? `$${(ph.totalArr / 1_000_000).toFixed(1)}M`
            : `$${(ph.totalArr / 1_000).toFixed(0)}K`;
        out.push({ label: 'Total ARR', value: formatted, icon: TrendingUp });
      }
    }

    // Usage trend
    const utPanel = panels.find((p) => p.componentId === 'usage_trend');
    if (utPanel) {
      const ut = utPanel.props as { changePct?: number; series?: unknown[] };
      if (ut.changePct != null) {
        const sign = ut.changePct > 0 ? '+' : '';
        out.push({
          label: 'Usage Δ',
          value: `${sign}${ut.changePct.toFixed(1)}%`,
          icon: Activity,
          tone: ut.changePct < -5 ? 'danger' : ut.changePct < 0 ? 'warn' : 'success',
        });
      }
    }

    // Open issues count
    const oiPanel = panels.find((p) => p.componentId === 'open_issues');
    if (oiPanel) {
      const oi = oiPanel.props as { issues?: unknown[] };
      if (oi.issues) {
        out.push({
          label: 'Open issues',
          value: String(oi.issues.length),
          icon: Users,
          tone: oi.issues.length > 5 ? 'warn' : 'default',
        });
      }
    }

    return out;
  }, [spec]);

  if (vitals.length === 0) return null;

  const toneMap: Record<string, string> = {
    default: 'text-muted',
    danger: 'text-danger',
    warn: 'text-warn',
    success: 'text-success',
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      {vitals.map((v) => {
        const Icon = v.icon;
        const tone = toneMap[v.tone ?? 'default'];
        return (
          <div
            key={v.label}
            className="flex items-center gap-1.5 text-xs"
          >
            <Icon className={`size-3.5 ${tone}`} aria-hidden />
            <span className="font-medium text-text tabular-nums">{v.value}</span>
            <span className="text-muted">{v.label}</span>
          </div>
        );
      })}
    </div>
  );
}
