import type { Injector } from '@angular/core';
import { Auth } from './auth';
import { OfflineStore } from './offline-store';

/** Spec §6: sign-out clears IndexedDB and the service worker's data caches. */
export async function signOutEverywhere(injector: Injector): Promise<void> {
  await injector.get(Auth).signOut().catch(() => undefined);
  await injector.get(OfflineStore).clear();
  if ('caches' in globalThis) {
    for (const key of await caches.keys()) if (key.includes(':data:')) await caches.delete(key);
  }
  localStorage.removeItem('firstlight.opened.v1');
}
