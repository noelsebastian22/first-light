import { Injectable, signal } from '@angular/core';
import { Edition } from '@first-light/contracts';
import demo from '../../../../fixtures/demo-edition.json';
import type { ArchiveHit, ArchiveQuery, EditionSource, TodayEditions } from './edition-source';

const AM = Edition.parse(demo.am);
const PM = Edition.parse(demo.pm);
const ARCHIVE = demo.archive.map((e) => Edition.parse(e));
const ALL: Edition[] = [AM, PM, ...ARCHIVE].sort((a, b) =>
  b.editionDate === a.editionDate ? b.createdAt.localeCompare(a.createdAt) : b.editionDate.localeCompare(a.editionDate),
);

/** Demo data source: the hand-written sample edition, with reads and saves held in memory. */
@Injectable({ providedIn: 'root' })
export class DemoEditionSource implements EditionSource {
  readonly live = false;
  private readonly reads = signal<ReadonlySet<string>>(new Set());
  private readonly saves = signal<ReadonlySet<string>>(new Set());
  readonly readIds = this.reads.asReadonly();
  readonly savedIds = this.saves.asReadonly();

  async today(): Promise<TodayEditions> {
    return { am: AM, pm: PM };
  }

  async story(id: string) {
    for (const edition of ALL) {
      const story = edition.stories.find((s) => s.id === id);
      if (story) return { story, edition };
    }
    return null;
  }

  async search(q: ArchiveQuery): Promise<ArchiveHit[]> {
    const text = q.text.trim().toLowerCase();
    const saved = this.saves();
    return ALL.flatMap((edition) =>
      edition.stories
        .filter((s) => q.section === 'all' || s.section === q.section)
        .filter((s) => !q.savedOnly || saved.has(s.id))
        .filter((s) => !text || `${s.title} ${s.summary}`.toLowerCase().includes(text))
        .map((story) => ({ story, editionDate: edition.editionDate, slot: edition.slot })),
    );
  }

  async editionDays() {
    const days = new Map<string, { date: string; am: boolean; pm: boolean }>();
    for (const e of ALL) {
      const d = days.get(e.editionDate) ?? { date: e.editionDate, am: false, pm: false };
      d[e.slot] = true;
      days.set(e.editionDate, d);
    }
    return [...days.values()];
  }

  async markRead(id: string) {
    this.reads.update((s) => new Set(s).add(id));
  }

  async toggleSave(id: string) {
    this.saves.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
}
