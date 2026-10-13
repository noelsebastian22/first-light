import { Injectable, inject, signal } from '@angular/core';
import type { Edition } from '@first-light/contracts';
import { sydneyDate } from '@first-light/contracts/dates';
import { DataApi, DataApiError } from './data-api';
import type { ArchiveHit, ArchiveQuery, EditionSource, TodayEditions } from './edition-source';
import { OfflineStore } from './offline-store';
import { EDITION_SELECT, STORY_SELECT, editionIdOf, pickToday, toEdition, toStory, type EditionRow, type StoryRow } from './rows';

const LIVE = 'status=in.(ok,partial)';

/** The member's real editions through the Data API (spec §6). */
@Injectable({ providedIn: 'root' })
export class NeonEditionSource implements EditionSource {
  readonly live = true;
  private readonly api = inject(DataApi);
  private readonly store = inject(OfflineStore);
  private readonly reads = signal<ReadonlySet<string>>(new Set());
  private readonly saves = signal<ReadonlySet<string>>(new Set());
  readonly readIds = this.reads.asReadonly();
  readonly savedIds = this.saves.asReadonly();
  private personal: Promise<void> | null = null;

  async today(): Promise<TodayEditions | null> {
    const personal = this.loadPersonal(); // in parallel; never rejects
    const today = sydneyDate(new Date());
    try {
      const rows = await this.api.get<EditionRow[]>(
        `/editions?select=${EDITION_SELECT}&${LIVE}&edition_date=lte.${today}&order=edition_date.desc,slot.desc&limit=2`,
      );
      const picked = pickToday(rows.map(toEdition).filter((e): e is Edition => e !== null));
      if (picked) await this.store.set('today', picked);
      await personal;
      return picked;
    } catch (e) {
      if (e instanceof DataApiError && e.status === 0) return (await this.store.get<TodayEditions>('today')) ?? null;
      throw e;
    }
  }

  async story(id: string): Promise<{ story: Edition['stories'][number]; edition: Edition } | null> {
    const rows = await this.api.get<EditionRow[]>(`/editions?select=${EDITION_SELECT}&id=eq.${encodeURIComponent(editionIdOf(id))}`);
    const edition = rows[0] ? toEdition(rows[0]) : null;
    const story = edition?.stories.find((s) => s.id === id);
    return edition && story ? { story, edition } : null;
  }

  async search(q: ArchiveQuery): Promise<ArchiveHit[]> {
    await this.loadPersonal();
    const filters: string[] = [];
    if (q.section !== 'all') filters.push(`section=eq.${q.section}`);
    if (q.text.trim()) filters.push(`search=wfts(english).${encodeURIComponent(q.text.trim())}`);
    if (q.savedOnly) {
      const ids = [...this.saves()];
      if (ids.length === 0) return [];
      filters.push(`id=in.(${ids.map(encodeURIComponent).join(',')})`);
    }
    const rows = await this.api.get<(StoryRow & { editions: { edition_date: string; slot: 'am' | 'pm' } })[]>(
      `/stories?select=${STORY_SELECT}&${filters.join('&')}&order=created_at.desc&limit=100`,
    );
    return rows.map((r) => ({ story: toStory(r), editionDate: r.editions.edition_date, slot: r.editions.slot }));
  }

  async editionDays(): Promise<{ date: string; am: boolean; pm: boolean }[]> {
    const rows = await this.api.get<{ edition_date: string; slot: 'am' | 'pm' }[]>(
      `/editions?select=edition_date,slot&${LIVE}&order=edition_date.desc&limit=800`,
    );
    const days = new Map<string, { date: string; am: boolean; pm: boolean }>();
    for (const r of rows) {
      const d = days.get(r.edition_date) ?? { date: r.edition_date, am: false, pm: false };
      d[r.slot] = true;
      days.set(r.edition_date, d);
    }
    return [...days.values()];
  }

  async markRead(id: string): Promise<void> {
    if (this.reads().has(id)) return;
    this.reads.update((s) => new Set(s).add(id));
    try {
      await this.api.post('/reads', { story_id: id });
    } catch (e) {
      if (e instanceof DataApiError && e.status === 409) return;
      this.reads.update((s) => without(s, id));
    }
  }

  async toggleSave(id: string): Promise<void> {
    const saved = this.saves().has(id);
    this.saves.update((s) => (saved ? without(s, id) : new Set(s).add(id)));
    try {
      if (saved) await this.api.delete(`/saves?story_id=eq.${encodeURIComponent(id)}`);
      else await this.api.post('/saves', { story_id: id });
    } catch (e) {
      if (!saved && e instanceof DataApiError && e.status === 409) return;
      this.saves.update((s) => (saved ? new Set(s).add(id) : without(s, id)));
      throw e;
    }
  }

  private loadPersonal(): Promise<void> {
    this.personal ??= Promise.all([
      this.api.get<{ story_id: string }[]>('/reads?select=story_id'),
      this.api.get<{ story_id: string }[]>('/saves?select=story_id'),
    ])
      .then(([r, s]) => {
        this.reads.set(new Set(r.map((x) => x.story_id)));
        this.saves.set(new Set(s.map((x) => x.story_id)));
      })
      .catch(() => {
        this.personal = null; // offline: try again next time
      });
    return this.personal;
  }
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
