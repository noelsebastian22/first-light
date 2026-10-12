import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Cell { day: number | null; am: boolean; pm: boolean }

/** A Monday-first month calendar marking which days have morning and afternoon editions. */
@Component({
  selector: 'app-month-grid',
  templateUrl: './month-grid.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthGrid {
  readonly month = input.required<string>(); // 'YYYY-MM'
  readonly days = input.required<{ date: string; am: boolean; pm: boolean }[]>();

  protected readonly title = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)));
  });

  protected readonly cells = computed<Cell[]>(() => {
    const [y = 1970, m = 1] = this.month().split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
    const blanks = (first + 6) % 7;
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const byDate = new Map(this.days().map((d) => [d.date, d]));
    const cells: Cell[] = Array.from({ length: blanks }, () => ({ day: null, am: false, pm: false }));
    for (let d = 1; d <= count; d++) {
      const key = `${this.month()}-${String(d).padStart(2, '0')}`;
      const found = byDate.get(key);
      cells.push({ day: d, am: !!found?.am, pm: !!found?.pm });
    }
    return cells;
  });
}
