import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Auth } from '../core/auth';
import { NEON } from '../core/neon-config';

/** Temporary (spec §9.5). Deleted in Task 8. */
@Component({
  selector: 'app-spike',
  templateUrl: './spike.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spike {
  protected readonly auth = inject(Auth);
  protected readonly log = signal<string[]>([]);

  constructor() {
    void this.check();
  }

  protected async check() {
    const lines: string[] = [];
    const user = await this.auth.session();
    lines.push(`session: ${user ? user.email : 'none'}`);
    this.auth.dropToken();
    const token = await this.auth.token();
    lines.push(`token: ${token ? `yes, ${token.length} chars` : 'none'}`);
    if (token) {
      for (const path of ['/editions?select=id&limit=1', '/rpc/is_member']) {
        const res = await fetch(`${NEON.dataApiUrl}${path}`, {
          method: path.startsWith('/rpc') ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: path.startsWith('/rpc') ? '{}' : undefined,
        });
        lines.push(`${path}: HTTP ${res.status} ${await res.text()}`);
      }
    }
    lines.push(`checked at ${new Date().toLocaleTimeString('en-AU')}`);
    this.log.set(lines);
  }

  protected signIn() {
    void this.auth.signIn('/spike');
  }
}
