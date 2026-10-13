import type { Edition } from '@first-light/contracts';
import demo from '../../../../fixtures/demo-edition.json';
import { editionIdOf, pickToday, sortStories, toEdition, type EditionRow } from './rows';

const AM = demo.am as unknown as Edition;
const PM = demo.pm as unknown as Edition;

/** What PostgREST returns for EDITION_SELECT. */
function rowOf(e: Edition): EditionRow {
  return {
    id: e.id, edition_date: e.editionDate, slot: e.slot, status: e.status, nudge: e.nudge,
    weather: e.weather, key_dates: e.keyDates, source_count: e.sourceCount, created_at: e.createdAt,
    stories: [...e.stories].reverse().map((s) => ({
      id: s.id, section: s.section, rank: s.rank, top_rank: s.topRank, title: s.title, summary: s.summary,
      why_it_matters: s.whyItMatters, picked_because: s.pickedBecause,
      story_links: s.links.map((l) => ({ source_key: l.sourceKey, url: l.url, publisher_title: l.publisherTitle, published_at: l.publishedAt })),
    })),
  };
}

describe('rows', () => {
  it('maps an edition row back to the Edition contract, stories in section then rank order', () => {
    expect(toEdition(rowOf(AM))).toEqual({ ...AM, stories: sortStories(AM.stories) });
  });

  it('drops a row without weather (a failed edition)', () => {
    expect(toEdition({ ...rowOf(AM), weather: null })).toBeNull();
  });

  it('pairs the latest day: am leads, pm follows', () => {
    expect(pickToday([PM, AM])).toEqual({ am: AM, pm: PM });
  });

  it('lets the pm edition lead when the am one is missing or failed', () => {
    expect(pickToday([PM])).toEqual({ am: PM, pm: null });
  });

  it('never pairs editions from different days', () => {
    const older = { ...PM, editionDate: '2026-10-12' };
    expect(pickToday([AM, older])).toEqual({ am: AM, pm: null });
  });

  it('returns null when there is no edition at all', () => {
    expect(pickToday([])).toBeNull();
  });

  it('derives the edition id from a story id', () => {
    expect(editionIdOf('ed-2026-10-13-am-03')).toBe('ed-2026-10-13-am');
  });
});
