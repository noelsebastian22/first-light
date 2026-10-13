import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { OfflineStore } from './offline-store';

describe('OfflineStore', () => {
  it('keeps values across instances and clears them all', async () => {
    const a = TestBed.inject(OfflineStore);
    await a.set('member', 'u1');
    await a.set('today', { am: { id: 'ed-1' }, pm: null });
    TestBed.resetTestingModule();
    const b = TestBed.inject(OfflineStore);
    expect(await b.get<string>('member')).toBe('u1');
    expect(await b.get<{ am: { id: string } }>('today')).toEqual({ am: { id: 'ed-1' }, pm: null });
    await b.clear();
    expect(await b.get('member')).toBeUndefined();
  });
});
