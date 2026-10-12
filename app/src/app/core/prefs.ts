import { Injectable, effect, signal } from '@angular/core';

type Density = 'comfortable' | 'compact';
interface Stored { reduceMotion?: boolean; density?: Density }
const KEY = 'firstlight.prefs.v1';

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function systemReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** On-device preferences. A property of the screen, not of the account. */
@Injectable({ providedIn: 'root' })
export class Prefs {
  private readonly stored = read();
  readonly reduceMotion = signal<boolean>(this.stored.reduceMotion ?? systemReducedMotion());
  readonly density = signal<Density>(this.stored.density ?? 'comfortable');

  constructor() {
    effect(() => {
      const value: Stored = { reduceMotion: this.reduceMotion(), density: this.density() };
      try {
        localStorage.setItem(KEY, JSON.stringify(value));
      } catch {
        /* storage unavailable: keep in memory only */
      }
    });
  }
}
