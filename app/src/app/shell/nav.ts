import { Injectable, effect, signal } from '@angular/core';

const KEY = 'firstlight.nav.v1';

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'collapsed';
  } catch {
    return true;
  }
}

/** Chrome state shared by the drawer, bottom bar and More sheet. */
@Injectable({ providedIn: 'root' })
export class Nav {
  readonly drawerOpen = signal(readOpen());
  readonly moreOpen = signal(false);

  constructor() {
    effect(() => {
      const open = this.drawerOpen();
      try {
        localStorage.setItem(KEY, open ? 'open' : 'collapsed');
      } catch {
        /* ignore */
      }
    });
  }
}
