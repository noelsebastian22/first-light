import { describe, expect, it } from 'vitest';
import type { Candidate, CandidatesFile, Weather } from '@first-light/contracts';
import { LIMITS, validateEdition } from './validate';

const place = { name: 'Katoomba', nowC: 9, highC: 17, lowC: 7, normalHighC: 17, normalLowC: 8, summary: 'Fog', rainChancePct: 20, windKmh: 12, sunrise: '05:50', hourly: [] };
const weather: Weather = { katoomba: place, sydney: { ...place, name: 'Sydney CBD' } };

function candidate(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id,
    sourceKey: 'abc-business',
    publisher: 'ABC News Business',
    sectionHint: 'au-economy',
    title: `Headline ${id}`,
    snippet: 'Snippet.',
    url: `https://example.com/${id}`,
    publishedAt: '2026-10-12T12:00:00.000Z',
    ...over,
  };
}

const candidates: CandidatesFile = {
  slot: 'am',
  editionDate: '2026-10-13',
  generatedAt: '2026-10-12T18:30:00.000Z',
  amContext: null,
  candidates: ['c001', 'c002', 'c003', 'c004', 'c005', 'c006'].map((id) => candidate(id)),
};
const pmCandidates: CandidatesFile = { ...candidates, slot: 'pm' };

const ctx = { editionId: 'ed-2026-10-13-am', createdAt: '2026-10-12T18:31:00.000Z', weather, keyDates: [], sourceCount: 18, status: 'ok' as const };

function story(over: Record<string, unknown> = {}) {
  return {
    section: 'au-economy',
    title: 'Inflation eases',
    summary: 'Prices rose less than expected.',
    whyItMatters: 'Rate cuts become more likely.',
    pickedBecause: 'Primary source.',
    articleIds: ['c001'],
    ...over,
  };
}

function amModel(over: Record<string, unknown> = {}) {
  return {
    stories: [story(), story({ section: 'ai', articleIds: ['c002', 'c003'] }), story({ section: 'world', articleIds: ['c004'] })],
    top3: [2, 0, 1],
    nudge: 'Fog lifts by ten; walk before the CPI lands.',
    ...over,
  };
}

function errorsOf(model: unknown, file: CandidatesFile = candidates): string[] {
  const result = validateEdition(model, file, ctx);
  if (result.ok) throw new Error('expected validation to fail');
  return result.errors;
}

describe('validateEdition', () => {
  it('builds an Edition whose links come from the cited candidates and whose Top 3 follows top3 order', () => {
    const result = validateEdition(amModel(), candidates, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { edition } = result;
    expect(edition).toMatchObject({ id: 'ed-2026-10-13-am', editionDate: '2026-10-13', slot: 'am', status: 'ok', sourceCount: 18, nudge: amModel().nudge });
    expect(edition.stories.map((s) => [s.section, s.rank, s.topRank])).toEqual([
      ['au-economy', 1, 2],
      ['ai', 1, 3],
      ['world', 1, 1],
    ]);
    expect(edition.stories[1]?.links).toEqual([
      { sourceKey: 'abc-business', url: 'https://example.com/c002', publisherTitle: 'Headline c002', publishedAt: '2026-10-12T12:00:00.000Z' },
      { sourceKey: 'abc-business', url: 'https://example.com/c003', publisherTitle: 'Headline c003', publishedAt: '2026-10-12T12:00:00.000Z' },
    ]);
    expect(new Set(edition.stories.map((s) => s.id)).size).toBe(3);
  });

  it('ranks stories within each section in the order the model gave them', () => {
    const result = validateEdition(amModel({ stories: [story(), story({ articleIds: ['c002'] }), story({ section: 'ai' })], top3: [0, 1, 2] }), candidates, ctx);
    expect(result.ok && result.edition.stories.map((s) => s.rank)).toEqual([1, 2, 1]);
  });

  it('names an unknown article ID', () => {
    expect(errorsOf(amModel({ stories: [story({ articleIds: ['c001', 'c999'] }), story(), story()] }))).toContain('stories[0]: unknown article id c999');
  });

  it('rejects a URL or HTML in any text field', () => {
    const errors = errorsOf(amModel({
      stories: [story({ summary: 'See https://evil.example for more.' }), story({ title: 'Bold <b>claim</b>' }), story({ pickedBecause: 'Read www.example.com' })],
      nudge: 'Click <a href=x>here</a>',
    }));
    expect(errors).toEqual(expect.arrayContaining([
      'stories[0].summary: contains a URL',
      'stories[1].title: contains HTML',
      'stories[2].pickedBecause: contains a URL',
      'nudge: contains HTML',
    ]));
  });

  it('rejects more than four stories in one section', () => {
    const five = Array.from({ length: 5 }, () => story({ section: 'ai' }));
    expect(errorsOf(amModel({ stories: five, top3: [0, 1, 2] }))).toContain('section ai has 5 stories (max 4)');
  });

  it('am needs a nudge and three distinct, valid Top 3 indexes', () => {
    expect(errorsOf(amModel({ nudge: null }))).toContain('nudge: required in the morning edition');
    expect(errorsOf(amModel({ nudge: '   ' }))).toContain('nudge: required in the morning edition');
    expect(errorsOf(amModel({ top3: null }))).toContain('top3: the morning edition needs exactly 3 distinct stories');
    expect(errorsOf(amModel({ top3: [0, 1] }))).toContain('top3: the morning edition needs exactly 3 distinct stories');
    expect(errorsOf(amModel({ top3: [0, 0, 1] }))).toContain('top3: the morning edition needs exactly 3 distinct stories');
    expect(errorsOf(amModel({ top3: [0, 1, 7] }))).toContain('top3: index 7 is not a story in this edition');
  });

  it('pm has no nudge and no Top 3', () => {
    expect(errorsOf(amModel(), pmCandidates)).toEqual(['nudge: must be null in the afternoon edition', 'top3: must be null in the afternoon edition']);
    const result = validateEdition(amModel({ top3: null, nudge: null }), pmCandidates, { ...ctx, editionId: 'ed-pm' });
    expect(result.ok && result.edition).toMatchObject({ slot: 'pm', nudge: null });
    expect(result.ok && result.edition.stories.every((s) => s.topRank === null)).toBe(true);
  });

  it('enforces length limits', () => {
    expect(LIMITS).toEqual({ title: 120, summary: 400, whyItMatters: 220, pickedBecause: 160, nudge: 200 });
    const long = (n: number) => 'a'.repeat(n + 1);
    const errors = errorsOf(amModel({
      stories: [story({ title: long(120) }), story({ summary: long(400) }), story({ whyItMatters: long(220), pickedBecause: long(160) })],
      nudge: long(200),
    }));
    expect(errors).toEqual(expect.arrayContaining([
      'stories[0].title: 121 characters (max 120)',
      'stories[1].summary: 401 characters (max 400)',
      'stories[2].whyItMatters: 221 characters (max 220)',
      'stories[2].pickedBecause: 161 characters (max 160)',
      'nudge: 201 characters (max 200)',
    ]));
  });

  it('accepts text exactly at the limit', () => {
    const at = (n: number) => 'a'.repeat(n);
    const result = validateEdition(amModel({ stories: [story({ title: at(120), summary: at(400) }), story(), story()], nudge: at(200) }), candidates, ctx);
    expect(result.ok).toBe(true);
  });

  it('reports schema problems readably instead of throwing', () => {
    const errors = errorsOf({ stories: [{ section: 'sport', title: 1 }], top3: null, nudge: null });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.startsWith('stories.0.section'))).toBe(true);
    expect(errorsOf('not json at all')[0]).toMatch(/expected object/i);
  });

  it('rejects empty text', () => {
    expect(errorsOf(amModel({ stories: [story({ whyItMatters: '  ' }), story(), story()] }))).toContain('stories[0].whyItMatters: empty');
  });

  it('makes one link when a story cites the same article twice', () => {
    const result = validateEdition(amModel({ stories: [story({ articleIds: ['c001', 'c001'] }), story(), story()] }), candidates, ctx);
    expect(result.ok && result.edition.stories[0]?.links.length).toBe(1);
  });

  it('rejects an edition with no stories', () => {
    expect(errorsOf({ stories: [], top3: null, nudge: null }, pmCandidates)).toEqual(['stories: the edition has no stories']);
  });
});
