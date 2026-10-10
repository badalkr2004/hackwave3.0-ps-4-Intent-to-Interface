export const DAY_MS = 86_400_000;

/** Local midnight of the given instant. All seed and loader dates are relative to this. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function atTime(d: Date, hours: number, minutes = 0): Date {
  const x = new Date(d);
  x.setHours(hours, minutes, 0, 0);
  return x;
}

/** `YYYY-MM-DD` from local date parts (for DATE columns). */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/** Short human date, e.g. "Sep 30". */
export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
