import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Source } from '../sources';
import { SOURCES } from '../sources';
import { fetchAllFeeds, parseFeed } from './feeds';

const fixture = (name: string) => readFileSync(new URL(`../../../fixtures/feeds/${name}`, import.meta.url), 'utf8');

const econ: Source = { key: 'sample-econ', name: 'Sample Economy Desk', url: 'https://example.com/rss', section: 'au-economy', active: true };
const dev: Source = { key: 'sample-dev', name: 'Sample Dev Blog', url: 'https://example.org/atom', section: 'web-dev', active: true };

function respond(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/xml' } });
}

describe('parseFeed', () => {
  it('parses RSS 2.0 items and drops items without a link', () => {
    const items = parseFeed(fixture('rss-sample.xml'), econ);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      sourceKey: 'sample-econ',
      publisher: 'Sample Economy Desk',
      sectionHint: 'au-economy',
      title: 'Sample bank holds the sample rate at 3.60 per cent',
      snippet: 'The sample board left the rate unchanged & said inflation is “easing”.',
      url: 'https://example.com/economy/rate-hold?utm_source=rss&utm_medium=feed',
      publishedAt: '2026-10-12T03:30:00.000Z',
    });
  });

  it('strips escaped HTML and decodes entities in snippets', () => {
    const items = parseFeed(fixture('rss-sample.xml'), econ);
    expect(items[1]?.snippet).toBe('Escaped HTML in a description block.');
    expect(items[1]?.publishedAt).toBe('2026-10-11T14:00:00.000Z');
  });

  it('parses Atom entries, preferring the alternate link and published date', () => {
    const items = parseFeed(fixture('atom-sample.xml'), dev);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Signals land in Sample framework 9',
      url: 'https://example.org/blog/signals-9',
      snippet: 'A synthetic post about signals.',
      publishedAt: '2026-10-11T18:00:00.000Z',
    });
    expect(items[1]).toMatchObject({
      url: 'https://example.org/blog/updated-only',
      snippet: 'Content used when there is no summary.',
      publishedAt: '2026-10-11T22:15:00.000Z',
    });
  });

  it('caps snippets at 400 characters', () => {
    const [item] = parseFeed(fixture('long-snippet.xml'), econ);
    expect(item?.snippet.length).toBeLessThanOrEqual(400);
    expect(item?.snippet.endsWith('…')).toBe(true);
  });

  it('throws on malformed XML', () => {
    expect(() => parseFeed(fixture('malformed.xml'), econ)).toThrow(/malformed/i);
  });
});

describe('fetchAllFeeds', () => {
  afterEach(() => vi.useRealTimers());

  it('collects items from good feeds and records failures without throwing', async () => {
    const broken: Source = { ...econ, key: 'broken', url: 'https://broken.example/rss' };
    const blocked: Source = { ...econ, key: 'blocked', url: 'https://blocked.example/rss' };
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('broken')) return respond(fixture('malformed.xml'));
      if (url.includes('blocked')) return respond('nope', 403);
      return url.includes('atom') ? respond(fixture('atom-sample.xml')) : respond(fixture('rss-sample.xml'));
    });

    const result = await fetchAllFeeds([econ, dev, broken, blocked], fetchImpl as typeof fetch);

    expect(result.items).toHaveLength(4);
    expect(result.failed).toEqual([
      { key: 'broken', reason: expect.stringMatching(/malformed/i) },
      { key: 'blocked', reason: 'HTTP 403' },
    ]);
  });

  it('fails a feed that never answers once the timeout passes', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const pending = fetchAllFeeds([econ], fetchImpl as unknown as typeof fetch, 10_000);
    await vi.advanceTimersByTimeAsync(10_001);
    await expect(pending).resolves.toEqual({ items: [], failed: [{ key: 'sample-econ', reason: 'timeout after 10000ms' }] });
  });

  it('skips inactive sources', async () => {
    const fetchImpl = vi.fn(async () => respond(fixture('rss-sample.xml')));
    const result = await fetchAllFeeds([{ ...econ, active: false }], fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], failed: [] });
  });
});

describe('SOURCES', () => {
  it('has unique keys, https URLs and covers all six sections', () => {
    const keys = SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SOURCES.every((s) => s.url.startsWith('https://'))).toBe(true);
    expect(new Set(SOURCES.map((s) => s.section)).size).toBe(6);
  });
});
