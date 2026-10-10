import { describe, expect, it } from 'vitest';
import { sydneyDate, sydneyTime } from './dates';

describe('sydneyDate', () => {
  it('returns the Sydney date just after midnight AEDT, not the UTC date', () => {
    expect(sydneyDate(new Date('2026-10-12T13:30:00Z'))).toBe('2026-10-13');
  });

  it('returns the same Sydney day at 23:59 AEDT', () => {
    expect(sydneyDate(new Date('2026-10-12T12:59:00Z'))).toBe('2026-10-12');
  });
});

describe('sydneyTime', () => {
  it('formats as h:mma in Sydney time', () => {
    expect(sydneyTime(new Date('2026-10-12T18:31:00Z'))).toBe('5:31am');
  });

  it('formats afternoon times with pm', () => {
    expect(sydneyTime(new Date('2026-10-13T05:03:00Z'))).toBe('4:03pm');
  });
});
