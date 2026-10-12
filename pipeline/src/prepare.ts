import { SECTIONS } from '@first-light/contracts';
import type { Candidate, CandidatesFile, SectionKey, Slot } from '@first-light/contracts';
import type { RawItem } from './fetch/feeds';
import { normaliseUrl } from './url';

export interface PrepareInput {
  items: RawItem[];
  slot: Slot;
  editionDate: string;
  now: Date;
  /** Normalised URLs already used by editions in the last 48 hours. */
  recentUrls: Set<string>;
  /** Today's am edition, for the pm run. Null when there is none (pm then runs as a full edition). */
  am: { createdAt: string; urls: Set<string>; titles: string[] } | null;
  perSectionCap?: number;
}

const MAX_AGE_HOURS = 72;
const PM_GRACE_MINUTES = 15;

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'at', 'by', 'with', 'is', 'are', 'as', 'from', 'after', 'over', 'says']);

/** Titles that differ only in punctuation, case or stop words share a key. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ');
}

function tryNormalise(url: string): string | null {
  try {
    return normaliseUrl(url);
  } catch {
    return null;
  }
}

const sectionOrder = (s: SectionKey) => SECTIONS.indexOf(s);

/** Fetched items → the candidates file Claude edits from (spec §5, step 2). */
export function prepare(input: PrepareInput): CandidatesFile {
  const { items, slot, editionDate, now, recentUrls, perSectionCap = 25 } = input;
  const am = slot === 'pm' ? input.am : null;
  const oldest = now.getTime() - MAX_AGE_HOURS * 3_600_000;
  const pmFrom = am ? new Date(am.createdAt).getTime() - PM_GRACE_MINUTES * 60_000 : null;

  const newestFirst = [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const perSection = new Map<SectionKey, number>();
  const kept: Omit<Candidate, 'id'>[] = [];

  for (const item of newestFirst) {
    const url = tryNormalise(item.url);
    if (!url || seenUrls.has(url) || recentUrls.has(url)) continue;
    const published = new Date(item.publishedAt).getTime();
    if (published < oldest) continue;
    if (am && (pmFrom === null || published < pmFrom || am.urls.has(url))) continue;
    const key = titleKey(item.title);
    if (!key || seenTitles.has(key)) continue;
    const count = perSection.get(item.sectionHint) ?? 0;
    if (count >= perSectionCap) continue;

    seenUrls.add(url);
    seenTitles.add(key);
    perSection.set(item.sectionHint, count + 1);
    kept.push({ ...item, url });
  }

  const ordered = kept
    .map((c, i) => ({ c, i }))
    .sort((a, b) => sectionOrder(a.c.sectionHint) - sectionOrder(b.c.sectionHint) || a.i - b.i)
    .map(({ c }, i): Candidate => ({ id: `c${String(i + 1).padStart(3, '0')}`, ...c }));

  return {
    slot,
    editionDate,
    generatedAt: now.toISOString(),
    amContext: am ? { createdAt: am.createdAt, titles: am.titles } : null,
    candidates: ordered,
  };
}
