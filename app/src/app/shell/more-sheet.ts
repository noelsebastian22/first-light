import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Prefs } from '../core/prefs';

@Component({
  selector: 'app-more-sheet',
  imports: [RouterLink],
  templateUrl: './more-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class MoreSheet {
  protected readonly prefs = inject(Prefs);
  readonly closed = output<void>();

  protected toggleMotion(event: Event) {
    this.prefs.reduceMotion.set((event.target as HTMLInputElement).checked);
  }
}
