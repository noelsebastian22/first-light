import { Injectable } from '@angular/core';

export type OfflineKey = 'today' | 'member';

const DB = 'firstlight';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** The latest edition and the verified member id, kept on the device for offline use (spec §6). */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  async get<T>(key: OfflineKey): Promise<T | undefined> {
    try {
      return await run<T | undefined>('readonly', (s) => s.get(key));
    } catch {
      return undefined;
    }
  }

  async set(key: OfflineKey, value: unknown): Promise<void> {
    try {
      await run('readwrite', (s) => s.put(value, key));
    } catch {
      /* private mode or storage full: the app still works online */
    }
  }

  async clear(): Promise<void> {
    try {
      await run('readwrite', (s) => s.clear());
    } catch {
      /* nothing stored */
    }
  }
}
