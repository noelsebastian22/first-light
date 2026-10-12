const TZ = 'Australia/Sydney';

/** The calendar date in Sydney as YYYY-MM-DD. Never use toISOString() for this. */
export function sydneyDate(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Sydney wall-clock time as h:mma, e.g. 5:31am. */
export function sydneyTime(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('hour')}:${get('minute')}${get('dayPeriod').toLowerCase().replace(/\./g, '')}`;
}
