import { InjectionToken, type Signal } from '@angular/core';
import type { Edition, SectionKey, Story } from '@first-light/contracts';

export interface TodayEditions {
  am: Edition;
  pm: Edition | null;
}

export interface ArchiveQuery {
  text: string;
  section: SectionKey | 'all';
  savedOnly: boolean;
}

export interface ArchiveHit {
  story: Story;
  editionDate: string;
  slot: 'am' | 'pm';
}

export interface EditionSource {
  /** True when weather may be refreshed live from Open-Meteo. False for the demo. */
  readonly live: boolean;
  /** Null only when no edition exists yet (the first morning). */
  today(): Promise<TodayEditions | null>;
  story(id: string): Promise<{ story: Story; edition: Edition } | null>;
  search(q: ArchiveQuery): Promise<ArchiveHit[]>;
  editionDays(): Promise<{ date: string; am: boolean; pm: boolean }[]>;
  readonly readIds: Signal<ReadonlySet<string>>;
  readonly savedIds: Signal<ReadonlySet<string>>;
  markRead(id: string): Promise<void>;
  toggleSave(id: string): Promise<void>;
}

export const EDITION_SOURCE = new InjectionToken<EditionSource>('EDITION_SOURCE');
