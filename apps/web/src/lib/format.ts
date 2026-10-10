const MINUS = '\u2212';

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

/** Signed percentage with a typographic minus, e.g. "−38%" or "+4%". */
export function formatPct(pct: number, digits = 0): string {
  const v = Math.abs(pct).toFixed(digits);
  if (Number(v) === 0) return '0%';
  return `${pct < 0 ? MINUS : '+'}${v}%`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Parses `YYYY-MM-DD` as a local date (not UTC). */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** "Sep 22" from `YYYY-MM-DD` or an ISO timestamp. */
export function formatShortDate(s: string): string {
  const d = s.length === 10 ? parseIsoDate(s) : new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function daysAgoLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function inDaysLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** "Tomorrow, 11:00" / "In 3 days, 15:00" from hours until start. */
export function meetingWhen(startsAt: string, inHours: number): string {
  const start = new Date(startsAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  const label = inHours < 0 ? 'Started' : inDaysLabel(days);
  return `${label}, ${formatTime(startsAt)}`;
}

export function overdueLabel(days: number): string {
  if (days <= 0) return 'Due today';
  return `${days} ${days === 1 ? 'day' : 'days'} overdue`;
}

export type SentimentLabel = 'Positive' | 'Neutral' | 'Negative';

export function sentimentLabel(s: number): SentimentLabel {
  if (s >= 0.15) return 'Positive';
  if (s <= -0.15) return 'Negative';
  return 'Neutral';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
