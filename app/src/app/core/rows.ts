import type { Edition, KeyDate, SectionKey, Story, Weather } from '@first-light/contracts';
import { SECTIONS } from '@first-light/contracts/sections-meta';
import type { TodayEditions } from './edition-source';

export interface LinkRow { source_key: string; url: string; publisher_title: string; published_at: string }
export interface StoryRow {
  id: string; section: SectionKey; rank: number; top_rank: 1 | 2 | 3 | null; title: string; summary: string;
  why_it_matters: string; picked_because: string; story_links: LinkRow[];
}
export interface EditionRow {
  id: string; edition_date: string; slot: 'am' | 'pm'; status: Edition['status']; nudge: string | null;
  weather: Weather | null; key_dates: KeyDate[]; source_count: number; created_at: string; stories: StoryRow[];
}

const STORY_COLUMNS = 'id,section,rank,top_rank,title,summary,why_it_matters,picked_because,story_links(source_key,url,publisher_title,published_at)';
/** PostgREST select for an edition with its stories and links (FKs do the embedding). */
export const EDITION_SELECT = `id,edition_date,slot,status,nudge,weather,key_dates,source_count,created_at,stories(${STORY_COLUMNS})`;
export const STORY_SELECT = `${STORY_COLUMNS},editions!inner(edition_date,slot)`;

export function sortStories(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.rank - b.rank);
}

export function toStory(r: StoryRow): Story {
  return {
    id: r.id, section: r.section, rank: r.rank, topRank: r.top_rank, title: r.title, summary: r.summary,
    whyItMatters: r.why_it_matters, pickedBecause: r.picked_because,
    links: r.story_links.map((l) => ({ sourceKey: l.source_key, url: l.url, publisherTitle: l.publisher_title, publishedAt: l.published_at })),
  };
}

/** Null for a row the app can't show (a failed edition has no weather). */
export function toEdition(r: EditionRow): Edition | null {
  if (r.weather === null) return null;
  return {
    id: r.id, editionDate: r.edition_date, slot: r.slot, status: r.status, createdAt: r.created_at, nudge: r.nudge,
    weather: r.weather, keyDates: r.key_dates, sourceCount: r.source_count, stories: sortStories(r.stories.map(toStory)),
  };
}

/** The latest day's editions. When its am edition is missing, the pm one leads (spec §5, step 3). */
export function pickToday(editions: Edition[]): TodayEditions | null {
  const latest = editions.reduce<string | null>((d, e) => (d === null || e.editionDate > d ? e.editionDate : d), null);
  if (latest === null) return null;
  const am = editions.find((e) => e.editionDate === latest && e.slot === 'am') ?? null;
  const pm = editions.find((e) => e.editionDate === latest && e.slot === 'pm') ?? null;
  return am ? { am, pm } : { am: pm as Edition, pm: null };
}

/** Story ids are `<editionId>-NN` (spec Decisions log). */
export function editionIdOf(storyId: string): string {
  return storyId.replace(/-\d{2}$/, '');
}
