/** Chart modes the sales_pulse panel and analytics explorer share. */
export const VizChart = ['trend', 'bars', 'pie', 'funnel'] as const;
export type VizChart = (typeof VizChart)[number];

const SALES_RE =
  /\b(sales|pipeline|revenue|deals?|marketing|campaigns?|quota|win\s*rate|forecast)\b/i;
const REPORT_RE = /\b(report|analytics|dashboard|breakdown|performance|numbers?)\b/i;

/**
 * Detects asks like "show me the sales report in pie chart".
 * Returns null when the prompt is not a sales/marketing viz request.
 */
export function parseSalesVizRequest(text: string): { chart: VizChart } | null {
  const t = text.trim();
  if (!t) return null;
  if (!SALES_RE.test(t) && !/\bsales report\b/i.test(t)) return null;
  const chart = chartFromText(t);
  if (!REPORT_RE.test(t) && !chart) return null;
  return { chart: chart ?? 'bars' };
}

export function chartFromText(text: string): VizChart | null {
  const t = text.toLowerCase();
  if (/\bpie\b/.test(t)) return 'pie';
  if (/\b(bar charts?|bars?|columns?)\b/.test(t)) return 'bars';
  if (/\b(trend|line chart|time\s*series)\b/.test(t)) return 'trend';
  if (/\bfunnel\b/.test(t)) return 'funnel';
  return null;
}

export function isVizChart(value: string | null | undefined): value is VizChart {
  return Boolean(value && (VizChart as readonly string[]).includes(value));
}

export function salesVizHeadline(chart: VizChart): string {
  switch (chart) {
    case 'pie':
      return 'Sales · pie chart';
    case 'bars':
      return 'Sales · bar chart';
    case 'trend':
      return 'Sales · trend';
    case 'funnel':
      return 'Sales · funnel';
  }
}

export function salesVizSummary(chart: VizChart): string {
  const label =
    chart === 'bars' ? 'bar chart' : chart === 'pie' ? 'pie chart' : chart === 'funnel' ? 'funnel' : 'trend';
  return `Pipeline and marketing as a ${label}, composed like any other workspace view.`;
}
