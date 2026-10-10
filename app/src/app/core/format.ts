const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

/** '2026-10-13' → 'Tuesday 13 October'. Pure calendar maths; no time zone involved. */
export function formatLongDate(date: string): string {
  const [y, m, d] = parts(date);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat('en-AU', { weekday: 'long', timeZone: 'UTC' }).format(utc);
  const month = new Intl.DateTimeFormat('en-AU', { month: 'long', timeZone: 'UTC' }).format(utc);
  return `${weekday} ${d} ${month}`;
}

/** '2026-11-03' → { month: 'NOV', day: '3' } */
export function formatShortDate(date: string): { month: string; day: string } {
  const [, m, d] = parts(date);
  return { month: MONTHS_SHORT[m - 1] ?? '', day: String(d) };
}

/** '14:30' → '2:30pm' */
export function formatClock(time: string | null): string {
  if (!time) return '';
  const [h = 0, min = 0] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(min).padStart(2, '0')}${suffix}`;
}
