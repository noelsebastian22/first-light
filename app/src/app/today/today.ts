import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SECTIONS, SECTION_META } from '@first-light/contracts/sections-meta';
import { sydneyMinutes, sydneyTime } from '@first-light/contracts/dates';
import { from, map, of, switchMap, takeWhile, timer } from 'rxjs';
import type { TodayEditions } from '../core/edition-source';
import { EDITION_SOURCE } from '../core/edition-source';
import { formatClock, formatLongDate, formatShortDate } from '../core/format';
import { WeatherCard } from '../weather/weather-card';

interface OpenMeteoNow { current?: { temperature_2m?: number } }

const PM_AT = 16 * 60 + 2; // 4:02pm

@Component({
  selector: 'app-today',
  imports: [RouterLink, WeatherCard],
  templateUrl: './today.html',
  styleUrl: './today.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Today {
  private readonly source = inject(EDITION_SOURCE);
  readonly editions = input.required<TodayEditions>();
  protected readonly slot = signal<'am' | 'pm'>('am');

  protected readonly am = computed(() => this.editions().am);

  /**
   * Spec §6: while open after 4:02pm with no pm edition, look for it every 10 minutes.
   * Not when the pm edition already leads the day (the am one failed).
   */
  private readonly pmPoll = rxResource({
    params: () =>
      this.source.live && this.editions().pm === null && this.am().slot === 'am' ? this.am().editionDate : undefined,
    stream: ({ params: date }) =>
      timer(0, 10 * 60_000).pipe(
        // Emit null before 4:02pm rather than nothing, so the page doesn't sit "loading" (unstable).
        switchMap(() => (sydneyMinutes(new Date()) >= PM_AT ? from(this.source.today()) : of(null))),
        map((t) => (t && t.am.editionDate === date ? t.pm : null)),
        takeWhile((pm) => pm === null, true),
      ),
  });

  protected readonly pm = computed(() => this.editions().pm ?? (this.pmPoll.hasValue() ? this.pmPoll.value() : null));
  /** The afternoon once a pm edition is showing, whether it follows the am one or leads. */
  private readonly afternoon = computed(() => this.pm() !== null || this.am().slot === 'pm');
  protected readonly greeting = computed(() => (this.afternoon() ? 'Good afternoon.' : 'Good morning.'));
  protected readonly nextEdition = computed(() => (this.afternoon() ? '5:32am' : '4:02pm'));
  protected readonly longDate = computed(() => formatLongDate(this.am().editionDate));
  protected readonly amTime = computed(() => sydneyTime(new Date(this.am().createdAt)));
  protected readonly top3 = computed(() =>
    this.am()
      .stories.filter((s) => s.topRank !== null)
      .sort((a, b) => (a.topRank ?? 0) - (b.topRank ?? 0))
      .map((s) => ({ ...s, meta: SECTION_META[s.section] })),
  );
  protected readonly dates = computed(() =>
    this.am().keyDates.map((d) => ({ ...d, short: formatShortDate(d.date), clock: formatClock(d.timeLocal) })),
  );
  protected readonly overview = computed(() => {
    const all = [...(this.pm()?.stories ?? []), ...this.am().stories];
    return SECTIONS.map((key) => {
      const stories = all.filter((s) => s.section === key);
      return { key, ...SECTION_META[key], count: stories.length, lead: stories[0]?.title ?? '' };
    }).filter((s) => s.count > 0);
  });

  /** Live temperature refresh between editions; skipped for the demo. */
  private readonly live = httpResource<OpenMeteoNow>(() =>
    this.source.live
      ? 'https://api.open-meteo.com/v1/forecast?latitude=-33.71&longitude=150.31&current=temperature_2m&timezone=Australia%2FSydney'
      : undefined,
  );
  protected readonly liveNow = computed(() => {
    const t = this.live.hasValue() ? this.live.value()?.current?.temperature_2m : undefined;
    return typeof t === 'number' ? Math.round(t) : null;
  });
}
