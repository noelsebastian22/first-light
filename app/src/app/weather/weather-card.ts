import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { WeatherPlace } from '@first-light/contracts/edition';
import { RangeBar } from './range-bar';
import { formatClock } from '../core/format';

@Component({
  selector: 'app-weather-card',
  imports: [RangeBar],
  templateUrl: './weather-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeatherCard {
  readonly place = input.required<WeatherPlace>();
  readonly second = input.required<WeatherPlace>();
  /** Live temperature from Open-Meteo, when available. */
  readonly liveNow = input<number | null>(null);
  protected readonly clock = formatClock;
}
