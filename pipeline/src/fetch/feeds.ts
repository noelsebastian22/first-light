import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { SectionKey } from '@first-light/contracts';
import type { Source } from '../sources';
import { toPlainText, truncate } from '../text';

export interface RawItem {
  sourceKey: string;
  publisher: string;
  sectionHint: SectionKey;
  title: string;
  snippet: string;
  url: string;
  publishedAt: string;
}

export interface FeedFailure {
  key: string;
  reason: string;
}

const SNIPPET_MAX = 400;
const USER_AGENT = 'FirstLight/1.0 (personal news briefing; +https://github.com/noelsebastian22/first-light)';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === 'item' || name === 'entry' || name === 'link',
});

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (isNode(value)) return text(value['#text']);
  return '';
}

function isoDate(value: string): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function rssLink(links: unknown): string {
  if (!Array.isArray(links)) return text(links);
  for (const l of links) {
    const t = text(l);
    if (t) return t;
  }
  return '';
}

function atomLink(links: unknown): string {
  if (!Array.isArray(links)) return '';
  const nodes = links.filter(isNode);
  const alternate = nodes.find((l) => l['@_rel'] === 'alternate') ?? nodes.find((l) => l['@_rel'] === undefined);
  return typeof alternate?.['@_href'] === 'string' ? alternate['@_href'] : '';
}

function makeItem(source: Source, title: string, body: string, url: string, date: string): RawItem | null {
  const publishedAt = isoDate(date.trim());
  const cleanUrl = url.trim();
  const cleanTitle = toPlainText(title);
  if (!cleanTitle || !publishedAt || !/^https?:\/\//.test(cleanUrl)) return null;
  return {
    sourceKey: source.key,
    publisher: source.name,
    sectionHint: source.section,
    title: cleanTitle,
    snippet: truncate(toPlainText(body), SNIPPET_MAX),
    url: cleanUrl,
    publishedAt,
  };
}

/** Parses RSS 2.0, RSS 1.0 (RDF) or Atom. Throws on malformed XML or an unknown document. */
export function parseFeed(xml: string, source: Source): RawItem[] {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`malformed XML (line ${valid.err.line})`);
  const doc: unknown = parser.parse(xml);
  if (!isNode(doc)) throw new Error('not an RSS or Atom feed');

  const rss = isNode(doc['rss']) ? doc['rss'] : null;
  const rdf = isNode(doc['rdf:RDF']) ? doc['rdf:RDF'] : null;
  const channel = rss && isNode(rss['channel']) ? rss['channel'] : rdf;
  if (channel) {
    const items = Array.isArray(channel['item']) ? channel['item'].filter(isNode) : [];
    return items
      .map((i) => makeItem(source, text(i['title']), text(i['description'] ?? i['content:encoded']), rssLink(i['link']), text(i['pubDate'] ?? i['dc:date'])))
      .filter((i): i is RawItem => i !== null);
  }

  const feed = isNode(doc['feed']) ? doc['feed'] : null;
  if (feed) {
    const entries = Array.isArray(feed['entry']) ? feed['entry'].filter(isNode) : [];
    return entries
      .map((e) => makeItem(source, text(e['title']), text(e['summary'] ?? e['content']), atomLink(e['link']), text(e['published'] ?? e['updated'])))
      .filter((i): i is RawItem => i !== null);
  }

  throw new Error('not an RSS or Atom feed');
}

async function fetchFeedText(source: Source, fetchImpl: typeof fetch, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetchImpl(source.url, { signal: controller.signal, headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } }),
      timeout,
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await Promise.race([response.text(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function reasonOf(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const cause = error.cause;
  if (isNode(cause) && typeof cause['code'] === 'string') return `${error.message} (${cause['code']})`;
  return error.message;
}

/** Fetches every active source in parallel. One bad feed never stops the others. */
export async function fetchAllFeeds(
  sources: Source[],
  fetchImpl: typeof fetch,
  timeoutMs = 10_000,
): Promise<{ items: RawItem[]; failed: FeedFailure[] }> {
  const active = sources.filter((s) => s.active);
  const results = await Promise.allSettled(active.map(async (s) => parseFeed(await fetchFeedText(s, fetchImpl, timeoutMs), s)));
  const items: RawItem[] = [];
  const failed: FeedFailure[] = [];
  results.forEach((result, i) => {
    const source = active[i];
    if (!source) return;
    if (result.status === 'fulfilled') items.push(...result.value);
    else failed.push({ key: source.key, reason: reasonOf(result.reason) });
  });
  return { items, failed };
}
