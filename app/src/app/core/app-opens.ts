import { Injectable, inject } from '@angular/core';
import { sydneyDate } from '@first-light/contracts/dates';
import { DataApi } from './data-api';

const KEY = 'firstlight.opened.v1';

/** Spec §6: one app_opens row per Sydney day per device; offline opens are retried. */
@Injectable({ providedIn: 'root' })
export class AppOpens {
  private readonly api = inject(DataApi);
  private pending = false;

  async record(): Promise<void> {
    const at = new Date();
    const day = sydneyDate(at);
    if (this.pending || localStorage.getItem(KEY) === day) return;
    await this.send(day, at.toISOString());
  }

  private async send(day: string, openedAt: string): Promise<void> {
    try {
      await this.api.post('/app_opens', { opened_at: openedAt });
      localStorage.setItem(KEY, day);
      this.pending = false;
    } catch {
      this.pending = true;
      window.addEventListener('online', () => void this.send(day, openedAt), { once: true });
    }
  }
}
