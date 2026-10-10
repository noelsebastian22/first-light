import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadKeyDates } from './key-dates';

const yaml = `
- date: 2026-10-15
  time: "11:30"
  label: Labour force figures
  source: ABS
  url: https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia
- date: 2026-11-03
  time: "14:30"
  label: RBA cash rate decision
  source: RBA
  url: https://www.rba.gov.au/schedules-events/board-meeting-schedules.html
- date: 2026-10-01
  label: Already past
  source: ABS
  url: https://www.abs.gov.au/
- date: 2027-03-01
  label: Too far ahead
  source: ABS
  url: https://www.abs.gov.au/
`;

describe('loadKeyDates', () => {
  it('keeps dates from today to the horizon, sorted, with times', () => {
    const { dates, warning } = loadKeyDates(yaml, '2026-10-13');
    expect(dates).toEqual([
      { date: '2026-10-15', timeLocal: '11:30', label: 'Labour force figures', sourceName: 'ABS', url: 'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia' },
      { date: '2026-11-03', timeLocal: '14:30', label: 'RBA cash rate decision', sourceName: 'RBA', url: 'https://www.rba.gov.au/schedules-events/board-meeting-schedules.html' },
    ]);
    expect(warning).toBeNull();
  });

  it('includes a date that falls on today', () => {
    const { dates } = loadKeyDates(yaml, '2026-10-15');
    expect(dates[0]?.date).toBe('2026-10-15');
  });

  it('warns when nothing falls in the next 30 days', () => {
    const { dates, warning } = loadKeyDates(yaml, '2026-11-20', 45);
    expect(dates).toEqual([]);
    expect(warning).toMatch(/key-dates\.yaml/);
  });

  it('warns but still returns a date between 30 and 45 days out', () => {
    // 2026-11-03 is 40 days after 2026-09-24.
    const far = loadKeyDates('- date: 2026-11-03\n  label: RBA\n  source: RBA\n  url: https://www.rba.gov.au/', '2026-09-24');
    expect(far.dates.map((d) => d.date)).toEqual(['2026-11-03']);
    expect(far.warning).toMatch(/key-dates\.yaml/);
  });

  it('rejects an entry with a bad date', () => {
    expect(() => loadKeyDates('- date: 13/10/2026\n  label: x\n  source: y\n  url: https://x.y/', '2026-10-13')).toThrow(/key-dates/);
  });

  it('the committed key-dates.yaml parses and has something in the next 30 days from 2026-10-13', () => {
    const text = readFileSync(new URL('../key-dates.yaml', import.meta.url), 'utf8');
    const { dates, warning } = loadKeyDates(text, '2026-10-13');
    expect(dates.length).toBeGreaterThan(0);
    expect(warning).toBeNull();
  });
});
