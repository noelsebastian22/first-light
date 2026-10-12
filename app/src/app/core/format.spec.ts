import { formatLongDate, formatShortDate } from './format';

describe('format', () => {
  it('formats a local date as weekday, day and month', () => {
    expect(formatLongDate('2026-10-13')).toBe('Tuesday 13 October');
  });
  it('formats a short month/day pair', () => {
    expect(formatShortDate('2026-11-03')).toEqual({ month: 'NOV', day: '3' });
  });
});
