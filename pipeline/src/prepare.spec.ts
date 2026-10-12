import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RawItem } from './fetch/feeds';
import { parseFeed } from './fetch/feeds';
import { prepare, titleKey } from './prepare';

const NOW = new Date('2026-10-12T18:30:00Z'); // 5:30am Sydney, 13 Oct

let n = 0;
function item(over: Partial<RawItem> = {}): RawItem {
  n += 1;
  return {
    sourceKey: 'src',
    publisher: 'Publisher',
    sectionHint: 'world',
    title: `Story number ${n}`,
    snippet: 'Snippet.',
    url: `https://example.com/story-${n}`,
    publishedAt: '2026-10-12T12:00:00.000Z',
    ...over,
  };
}

const base = { slot: 'am' as const, editionDate: '2026-10-13', now: NOW, recentUrls: new Set<string>(), am: null };

describe('prepare', () => {
  it('numbers candidates c001, c002… in section order, newest first', () => {
    const file = prepare({
      ...base,
      items: [
        item({ sectionHint: 'world', publishedAt: '2026-10-12T10:00:00.000Z', title: 'Older world' }),
        item({ sectionHint: 'ai', title: 'AI one' }),
        item({ sectionHint: 'world', publishedAt: '2026-10-12T11:00:00.000Z', title: 'Newer world' }),
        item({ sectionHint: 'au-economy', title: 'Economy one' }),
      ],
    });
    expect(file.candidates.map((c) => [c.id, c.title])).toEqual([
      ['c001', 'Economy one'],
      ['c002', 'Newer world'],
      ['c003', 'Older world'],
      ['c004', 'AI one'],
    ]);
    expect(file).toMatchObject({ slot: 'am', editionDate: '2026-10-13', generatedAt: NOW.toISOString(), amContext: null });
  });

  it('drops duplicates by normalised URL, keeping the newest', () => {
    const file = prepare({
      ...base,
      items: [
        item({ url: 'https://Example.com/same/?utm_source=a', title: 'First copy', publishedAt: '2026-10-12T09:00:00.000Z' }),
        item({ url: 'https://example.com/same', title: 'Second copy', publishedAt: '2026-10-12T10:00:00.000Z' }),
      ],
    });
    expect(file.candidates).toHaveLength(1);
    expect(file.candidates[0]).toMatchObject({ title: 'Second copy', url: 'https://example.com/same' });
  });

  it('drops near-identical titles from different outlets', () => {
    const file = prepare({
      ...base,
      items: [
        item({ title: 'RBA holds the cash rate at 3.6%', url: 'https://a.example/1' }),
        item({ title: 'RBA holds cash rate at 3.6 %!', url: 'https://b.example/2' }),
        item({ title: 'RBA lifts the cash rate', url: 'https://c.example/3' }),
      ],
    });
    expect(file.candidates.map((c) => c.url)).toEqual(['https://a.example/1', 'https://c.example/3']);
    expect(titleKey('The RBA holds: cash rate, at 3.6%')).toBe(titleKey('RBA holds cash rate 3.6%'));
  });

  it('drops anything used in an edition in the last 48 hours', () => {
    const file = prepare({
      ...base,
      recentUrls: new Set(['https://example.com/used']),
      items: [item({ url: 'https://example.com/used/?utm_source=x' }), item({ url: 'https://example.com/fresh' })],
    });
    expect(file.candidates.map((c) => c.url)).toEqual(['https://example.com/fresh']);
  });

  it('drops items older than 72 hours and items with invalid URLs', () => {
    const file = prepare({
      ...base,
      items: [
        item({ publishedAt: '2026-10-09T18:00:00.000Z', title: 'Too old' }),
        item({ publishedAt: '2026-10-09T19:00:00.000Z', title: 'Just in' }),
        item({ url: 'notaurl', title: 'Bad URL' }),
      ],
    });
    expect(file.candidates.map((c) => c.title)).toEqual(['Just in']);
  });

  it('caps each section at 25 candidates, keeping the newest', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      item({ sectionHint: 'ai', title: `AI story ${i} ${'x'.repeat(i)}`, publishedAt: new Date(Date.UTC(2026, 9, 12, 0, i)).toISOString() }),
    );
    const file = prepare({ ...base, items: [...items, item({ sectionHint: 'world' })] });
    expect(file.candidates.filter((c) => c.sectionHint === 'ai')).toHaveLength(25);
    expect(file.candidates.filter((c) => c.sectionHint === 'world')).toHaveLength(1);
    expect(file.candidates.some((c) => c.title.startsWith('AI story 0 '))).toBe(false);
    expect(prepare({ ...base, items, perSectionCap: 3 }).candidates).toHaveLength(3);
  });

  it('pm keeps only items published since 15 minutes before the am edition and not already in it', () => {
    const am = {
      createdAt: '2026-10-12T18:31:00.000Z',
      urls: new Set(['https://example.com/in-am']),
      titles: ['Morning story'],
    };
    const file = prepare({
      ...base,
      slot: 'pm',
      now: new Date('2026-10-13T05:02:00Z'),
      am,
      items: [
        item({ title: 'Before the window', publishedAt: '2026-10-12T18:15:00.000Z' }),
        item({ title: 'Inside the window', publishedAt: '2026-10-12T18:17:00.000Z' }),
        item({ title: 'Already in am', url: 'https://example.com/in-am', publishedAt: '2026-10-13T01:00:00.000Z' }),
        item({ title: 'Afternoon news', publishedAt: '2026-10-13T03:00:00.000Z' }),
      ],
    });
    expect(file.candidates.map((c) => c.title)).toEqual(['Afternoon news', 'Inside the window']);
    expect(file.amContext).toEqual({ createdAt: am.createdAt, titles: ['Morning story'] });
  });

  it('pm without an am edition behaves as a full edition', () => {
    const file = prepare({
      ...base,
      slot: 'pm',
      now: new Date('2026-10-13T05:02:00Z'),
      items: [item({ title: 'Early morning', publishedAt: '2026-10-12T15:00:00.000Z' })],
    });
    expect(file.candidates.map((c) => c.title)).toEqual(['Early morning']);
    expect(file.amContext).toBeNull();
  });

  it('turns the synthetic feeds into stable candidates', () => {
    const read = (name: string) => readFileSync(new URL(`../../fixtures/feeds/${name}`, import.meta.url), 'utf8');
    const items = [
      ...parseFeed(read('rss-sample.xml'), { key: 'sample-econ', name: 'Sample Economy Desk', url: 'https://example.com/rss', section: 'au-economy', active: true }),
      ...parseFeed(read('atom-sample.xml'), { key: 'sample-dev', name: 'Sample Dev Blog', url: 'https://example.org/atom', section: 'web-dev', active: true }),
      ...parseFeed(read('long-snippet.xml'), { key: 'sample-long', name: 'Sample Long', url: 'https://example.net/rss', section: 'world', active: true }),
    ];
    expect(prepare({ ...base, items })).toMatchSnapshot();
  });
});
