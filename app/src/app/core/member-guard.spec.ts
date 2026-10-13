import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { AppOpens } from './app-opens';
import { Auth } from './auth';
import { DataApi } from './data-api';
import { memberGuard } from './member-guard';
import { OfflineStore } from './offline-store';

async function run(opts: { online: boolean; user: object | null; member: boolean; cachedMember?: string }) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(opts.online);
  const api = { rpc: vi.fn(async () => opts.member) };
  const store = { get: vi.fn(async () => opts.cachedMember), set: vi.fn(async () => undefined), clear: vi.fn() };
  const opens = { record: vi.fn(async () => undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: Auth, useValue: { session: vi.fn(async () => opts.user) } },
      { provide: DataApi, useValue: api },
      { provide: OfflineStore, useValue: store },
      { provide: AppOpens, useValue: opens },
    ],
  });
  const result = await TestBed.runInInjectionContext(() =>
    memberGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  const router = TestBed.inject(Router);
  return { url: result instanceof UrlTree ? router.serializeUrl(result) : result, api, store, opens };
}

describe('memberGuard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends a signed-out visitor to /signin', async () => {
    expect((await run({ online: true, user: null, member: false })).url).toBe('/signin');
  });

  it('sends a signed-in non-member to the private-edition demo without reading content', async () => {
    const { url } = await run({ online: true, user: { id: 'x' }, member: false });
    expect(url).toBe('/demo/today?private=1');
  });

  it('lets a member in and remembers them for offline use', async () => {
    const { url, store } = await run({ online: true, user: { id: 'u1' }, member: true });
    expect(url).toBe(true);
    expect(store.set).toHaveBeenCalledWith('member', 'u1');
  });

  it('records the open for a member, never for a non-member', async () => {
    expect((await run({ online: true, user: { id: 'u1' }, member: true })).opens.record).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    expect((await run({ online: true, user: { id: 'x' }, member: false })).opens.record).not.toHaveBeenCalled();
  });

  it('offline: lets a previously verified member through without a token', async () => {
    const { url, api } = await run({ online: false, user: null, member: false, cachedMember: 'u1' });
    expect(url).toBe(true);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('offline: still records the open, for AppOpens to send once back online (spec §6)', async () => {
    const { opens } = await run({ online: false, user: null, member: false, cachedMember: 'u1' });
    expect(opens.record).toHaveBeenCalledTimes(1);
  });

  it('offline with nothing cached: /signin', async () => {
    expect((await run({ online: false, user: null, member: false })).url).toBe('/signin');
  });
});
