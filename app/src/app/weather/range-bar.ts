import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const pct = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2)}%`;

/** Today's temperature range drawn against the month's average range. */
@Component({
  selector: 'app-range-bar',
  templateUrl: './range-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangeBar {
  readonly low = input.required<number>();
  readonly high = input.required<number>();
  readonly normalLow = input.required<number>();
  readonly normalHigh = input.required<number>();
  readonly now = input.required<number>();
  readonly min = input(0);
  readonly max = input(30);

  private scale(v: number) {
    const span = this.max() - this.min();
    return (Math.min(Math.max(v, this.min()), this.max()) - this.min()) / span * 100;
  }

  protected readonly todayLeft = computed(() => pct(this.scale(this.low())));
  protected readonly todayWidth = computed(() => pct(this.scale(this.high()) - this.scale(this.low())));
  protected readonly normalLeft = computed(() => pct(this.scale(this.normalLow())));
  protected readonly normalWidth = computed(() => pct(this.scale(this.normalHigh()) - this.scale(this.normalLow())));
  protected readonly nowLeft = computed(() => pct(this.scale(this.now())));
  protected readonly label = computed(
    () => `Today ${this.low()} to ${this.high()} degrees; average ${this.normalLow()} to ${this.normalHigh()} degrees`,
  );
  protected readonly note = computed(() => {
    const diff = Math.round((this.high() + this.low()) / 2 - (this.normalHigh() + this.normalLow()) / 2);
    if (diff === 0) return 'About average for this time of year.';
    const n = Math.abs(diff);
    return `${n} degree${n === 1 ? '' : 's'} ${diff < 0 ? 'cooler' : 'warmer'} than usual.`;
  });
}
