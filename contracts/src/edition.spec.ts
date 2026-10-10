import { describe, expect, it } from 'vitest';
import { Edition, SECTIONS, SECTION_META, Story } from './index';

const story = {
  id: 's1',
  section: 'au-economy',
  rank: 1,
  topRank: 1,
  title: 'CPI lands 28 October',
  summary: 'The ABS publishes quarterly inflation on 28 October.',
  whyItMatters: 'Rates move on it.',
  pickedBecause: 'Primary source.',
  links: [
    { sourceKey: 'abs', url: 'https://www.abs.gov.au/', publisherTitle: 'ABS', publishedAt: '2026-10-12T20:00:00Z' },
  ],
};

const weatherPlace = {
  name: 'Katoomba', nowC: 9, highC: 17, lowC: 7, normalHighC: 18, normalLowC: 8,
  summary: 'Fog lifting', rainChancePct: 20, windKmh: 12, sunrise: '05:50',
  hourly: [{ time: '06:00', tempC: 8 }],
};

const edition = {
  id: 'e1',
  editionDate: '2026-10-13',
  slot: 'am',
  status: 'ok',
  createdAt: '2026-10-12T18:31:00Z',
  nudge: 'A quiet news day.',
  weather: { katoomba: weatherPlace, sydney: { ...weatherPlace, name: 'Sydney CBD' } },
  keyDates: [{ date: '2026-10-28', timeLocal: '11:30', label: 'CPI', sourceName: 'ABS', url: 'https://www.abs.gov.au/' }],
  sourceCount: 18,
  stories: [story],
};

describe('contracts', () => {
  it('lists the six sections in display order with labels', () => {
    expect(SECTIONS).toEqual(['au-economy', 'au-politics', 'world', 'web-dev', 'ai', 'au-tech-market']);
    expect(SECTION_META['au-tech-market'].label).toBe('AU tech market');
    expect(SECTION_META['au-economy'].fill).toBe('#FBE3CC');
  });

  it('parses a valid edition', () => {
    expect(Edition.parse(edition).stories[0]?.title).toBe('CPI lands 28 October');
  });

  it('rejects a topRank outside 1-3', () => {
    expect(Story.safeParse({ ...story, topRank: 4 }).success).toBe(false);
  });

  it('rejects an unknown section', () => {
    expect(Story.safeParse({ ...story, section: 'sport' }).success).toBe(false);
  });

  it('rejects a story with no links', () => {
    expect(Story.safeParse({ ...story, links: [] }).success).toBe(false);
  });
});
