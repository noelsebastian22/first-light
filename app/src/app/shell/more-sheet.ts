import { ChangeDetectionStrategy, Component, Injector, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EDITION_SOURCE } from '../core/edition-source';
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
  protected readonly live = inject(EDITION_SOURCE).live;
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  readonly closed = output<void>();

  protected toggleMotion(event: Event) {
    this.prefs.reduceMotion.set((event.target as HTMLInputElement).checked);
  }

  protected async signOut() {
    const { signOutEverywhere } = await import('../core/sign-out');
    await signOutEverywhere(this.injector);
    this.closed.emit();
    await this.router.navigateByUrl('/');
  }
}
