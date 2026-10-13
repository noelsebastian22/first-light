import { Injectable } from '@angular/core';

export type OfflineKey = 'today' | 'member';

/** The latest edition and the verified member id, kept on the device for offline use. */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  async get<T>(_key: OfflineKey): Promise<T | undefined> {
    return undefined;
  }
  async set(_key: OfflineKey, _value: unknown): Promise<void> {}
  async clear(): Promise<void> {}
}
