import { Injectable, inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Auth } from './auth';
import { DataApi } from './data-api';
import { OfflineStore } from './offline-store';

/** Asks the database once per page load whether this user is on the list. */
@Injectable({ providedIn: 'root' })
export class Membership {
  private readonly api = inject(DataApi);
  private result: Promise<boolean> | null = null;

  check(): Promise<boolean> {
    this.result ??= this.api.rpc<boolean>('is_member').catch(() => {
      this.result = null;
      return false;
    });
    return this.result;
  }
}

/** Spec §6: signed out → /signin; signed in but not a member → the demo; offline → trust the device. */
export const memberGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(Auth);
  const store = inject(OfflineStore);
  const membership = inject(Membership);

  if (!navigator.onLine) return (await store.get<string>('member')) ? true : router.parseUrl('/signin');
  const user = await auth.session();
  if (!user) return router.parseUrl('/signin');
  if (!(await membership.check())) return router.parseUrl('/demo/today?private=1');
  await store.set('member', user.id);
  return true;
};
