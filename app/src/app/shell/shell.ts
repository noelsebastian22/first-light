import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ICONS } from './icons';
import { MoreSheet } from './more-sheet';
import { Nav } from './nav';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MoreSheet],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly nav = inject(Nav);
  protected readonly icons = ICONS;
  protected readonly links = [
    { label: 'Today', path: 'today', icon: ICONS.today },
    { label: 'News', path: 'news', icon: ICONS.news },
    { label: 'Archive', path: 'archive', icon: ICONS.archive },
  ];
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('private'))));
  protected readonly privateNote = computed(() => this.query() === '1');

  protected toggleDrawer() {
    this.nav.drawerOpen.update((v) => !v);
  }
}
