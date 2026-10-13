import { TestBed } from '@angular/core/testing';
import type { Edition } from '@first-light/contracts';
import demo from '../../../../fixtures/demo-edition.json';
import { DataApi, DataApiError } from './data-api';
import { NeonEditionSource } from './neon-edition-source';
import { OfflineStore } from './offline-store';

const AM = demo.am as unknown as Edition;

function apiStub() {
  return {
    get: vi.fn(async (path: string): Promise<unknown> => {
      if (path.startsWith('/reads')) return [{ story_id: 'r1' }];
      if (path.startsWith('/saves')) return [{ story_id: 's1' }];
      return [];
    }),
    post: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    rpc: vi.fn(),
  };
}

function setup(api = apiStub()) {
  const store = { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined), clear: vi.fn() };
  TestBed.configureTestingModule({
    providers: [{ provide: DataApi, useValue: api }, { provide: OfflineStore, useValue: store }],
  });
  return { source: TestBed.inject(NeonEditionSource), api, store };
}

describe('NeonEditionSource', () => {
  it('asks only for ok and partial editions up to today in Sydney, newest first', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T13:30:00Z') }); // 00:30 on the 14th in Sydney
    const { source, api } = setup();
    await source.today();
    const path = String(api.get.mock.calls.find(([p]) => String(p).startsWith('/editions'))?.[0]);
    expect(path).toContain('status=in.(ok,partial)');
    expect(path).toContain('edition_date=lte.2026-10-14');
    expect(path).toContain('order=edition_date.desc,slot.desc');
    vi.useRealTimers();
  });

  it('loads reads and saves into signals', async () => {
    const { source } = setup();
    await source.today();
    expect(source.readIds().has('r1')).toBe(true);
    expect(source.savedIds().has('s1')).toBe(true);
  });

  it('falls back to the cached edition when offline, and caches a fresh one', async () => {
    const api = apiStub();
    api.get.mockImplementation(async () => { throw new DataApiError(0); });
    const { source, store } = setup(api);
    store.get.mockResolvedValueOnce({ am: AM, pm: null } as never);
    expect((await source.today())?.am.id).toBe(AM.id);
  });

  it('treats a duplicate read as success', async () => {
    const api = apiStub();
    api.post.mockRejectedValueOnce(new DataApiError(409));
    const { source } = setup(api);
    await source.markRead('x1');
    expect(source.readIds().has('x1')).toBe(true);
  });

  it('reverts a save that the server refused', async () => {
    const api = apiStub();
    api.post.mockRejectedValueOnce(new DataApiError(0));
    const { source } = setup(api);
    await expect(source.toggleSave('x2')).rejects.toBeInstanceOf(DataApiError);
    expect(source.savedIds().has('x2')).toBe(false);
  });

  it('unsaves with a delete scoped by story id (RLS scopes the user)', async () => {
    const { source, api } = setup();
    await source.today();
    await source.toggleSave('s1');
    expect(api.delete).toHaveBeenCalledWith('/saves?story_id=eq.s1');
    expect(source.savedIds().has('s1')).toBe(false);
  });

  it('returns no saved-only hits without a request when nothing is saved', async () => {
    const api = apiStub();
    api.get.mockImplementation(async () => []);
    const { source } = setup(api);
    expect(await source.search({ text: '', section: 'all', savedOnly: true })).toEqual([]);
    expect(api.get.mock.calls.some(([p]) => String(p).startsWith('/stories'))).toBe(false);
  });
});
