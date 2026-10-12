import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, debounce, form } from '@angular/forms/signals';
import { SECTIONS, SECTION_META } from '@first-light/contracts/sections-meta';
import { EDITION_SOURCE, type ArchiveQuery } from '../core/edition-source';
import { formatShortDate } from '../core/format';
import { MonthGrid } from './month-grid';

@Component({
  selector: 'app-archive',
  imports: [RouterLink, FormField, MonthGrid],
  templateUrl: './archive.html',
  styleUrl: './archive.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Archive {
  private readonly source = inject(EDITION_SOURCE);
  protected readonly sections = SECTIONS.map((key) => ({ key, label: SECTION_META[key].label }));

  /** Signal Forms: the model is the query; typing is debounced before it reaches the model. */
  protected readonly query = signal<ArchiveQuery>({ text: '', section: 'all', savedOnly: false });
  protected readonly searchForm = form(this.query, (p) => {
    debounce(p.text, 250);
  });

  private readonly results = resource({
    params: () => ({ ...this.query(), saved: this.source.savedIds() }),
    loader: ({ params }) => this.source.search(params),
  });
  protected readonly hits = computed(() =>
    (this.results.hasValue() ? this.results.value() : []).map((h) => ({
      ...h,
      meta: SECTION_META[h.story.section],
      short: formatShortDate(h.editionDate),
    })),
  );
  protected readonly loaded = computed(() => this.results.hasValue());

  private readonly daysRes = resource({ loader: () => this.source.editionDays() });
  protected readonly days = computed(() => (this.daysRes.hasValue() ? this.daysRes.value() : []));
  protected readonly month = computed(() => {
    const latest = this.days().map((d) => d.date).sort().at(-1);
    return latest ? latest.slice(0, 7) : null;
  });
}
