import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, resource } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SECTIONS, SECTION_META, type SectionKey } from '@first-light/contracts/sections-meta';
import { sydneyTime } from '@first-light/contracts/dates';
import type { Story } from '@first-light/contracts/edition';
import { EDITION_SOURCE, type TodayEditions } from '../core/edition-source';
import { StoryDetail } from './story-detail';

export interface StoryRow extends Story {
  isNew: boolean;
  label: string;
  fill: string;
}

@Component({
  selector: 'app-news',
  imports: [RouterLink, StoryDetail],
  templateUrl: './news.html',
  styleUrl: './news.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class News {
  protected readonly source = inject(EDITION_SOURCE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editions = input.required<TodayEditions>();
  readonly storyId = input<string | undefined>(undefined);
  readonly section = input<string | undefined>(undefined);

  protected readonly amTime = computed(() => sydneyTime(new Date(this.editions().am.createdAt)));

  /** Afternoon stories first, then the morning edition, each in section order. */
  protected readonly rows = computed<StoryRow[]>(() => {
    const { am, pm } = this.editions();
    const tag = (s: Story, isNew: boolean): StoryRow => ({ ...s, isNew, ...SECTION_META[s.section] });
    const order = (a: Story, b: Story) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.rank - b.rank;
    return [...(pm?.stories ?? []).slice().sort(order).map((s) => tag(s, true)), ...am.stories.slice().sort(order).map((s) => tag(s, false))];
  });

  protected readonly filter = linkedSignal<SectionKey | 'all'>(() => {
    const s = this.section();
    return s && (SECTIONS as readonly string[]).includes(s) ? (s as SectionKey) : 'all';
  });

  protected readonly chips = computed(() => {
    const rows = this.rows();
    const sections = SECTIONS.map((key) => ({ key, label: SECTION_META[key].label, count: rows.filter((r) => r.section === key).length }))
      .filter((c) => c.count > 0);
    return [{ key: 'all' as const, label: 'All', count: rows.length }, ...sections];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((r) => r.section === f);
  });

  protected readonly selectedId = linkedSignal<string | null>(() => this.storyId() ?? this.visible()[0]?.id ?? null);

  protected readonly unreadCount = computed(() => {
    const read = this.source.readIds();
    return this.rows().filter((r) => !read.has(r.id)).length;
  });

  /** A story from today's editions, or (for archive deep links) loaded from the source. */
  private readonly todayStory = computed(() => this.rows().find((r) => r.id === this.selectedId()) ?? null);
  private readonly archived = resource({
    params: () => (this.todayStory() ? undefined : (this.selectedId() ?? undefined)),
    loader: ({ params }) => this.source.story(params),
  });
  protected readonly selected = computed<StoryRow | null>(() => {
    const today = this.todayStory();
    if (today) return today;
    const found = this.archived.hasValue() ? this.archived.value() : null;
    return found ? { ...found.story, isNew: false, ...SECTION_META[found.story.section] } : null;
  });

  constructor() {
    effect(() => {
      const id = this.storyId();
      if (id) void this.source.markRead(id);
    });
  }

  protected open(row: StoryRow) {
    this.selectedId.set(row.id);
    void this.source.markRead(row.id);
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 899px)').matches) {
      void this.router.navigate(this.storyId() ? ['..', row.id] : [row.id], { relativeTo: this.route });
    }
  }
}
