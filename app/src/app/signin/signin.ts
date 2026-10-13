import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-signin',
  imports: [RouterLink],
  templateUrl: './signin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Signin {
  private readonly auth = inject(Auth);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    const router = inject(Router);
    void this.auth.session().then((user) => {
      if (user) void router.navigateByUrl('/today');
    });
  }

  protected async google() {
    this.busy.set(true);
    this.failed.set(false);
    try {
      await this.auth.signIn('/today');
    } catch {
      this.failed.set(true);
      this.busy.set(false);
    }
  }
}
