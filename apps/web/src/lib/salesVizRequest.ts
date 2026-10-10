import {
  chartFromText,
  isVizChart,
  parseSalesVizRequest,
  type VizChart,
} from '@gestalt/shared';

export type { VizChart };
export { chartFromText, isVizChart, parseSalesVizRequest };

export function analyticsUrlFor(opts: {
  chart?: VizChart;
  range?: string;
  clientId?: string;
}): string {
  const q = new URLSearchParams();
  if (opts.chart) q.set('chart', opts.chart);
  if (opts.range) q.set('range', opts.range);
  if (opts.clientId) q.set('clientId', opts.clientId);
  const qs = q.toString();
  return `/analytics${qs ? `?${qs}` : ''}`;
}
