import { TestBed } from '@angular/core/testing';
import { AppOpens } from './app-opens';
import { DataApi, DataApiError } from './data-api';

function setup(post = vi.fn(async () => undefined)) {
  TestBed.configureTestingModule({ providers: [{ provide: DataApi, useValue: { post } }] });
  return { opens: TestBed.inject(AppOpens), post };
}

describe('AppOpens', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('records one open per Sydney day per device', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T20:00:00Z') }); // 7am on the 14th in Sydney
    const { opens, post } = setup();
    await opens.record();
    await opens.record();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/app_opens', { opened_at: '2026-10-13T20:00:00.000Z' });
    expect(localStorage.getItem('firstlight.opened.v1')).toBe('2026-10-14');
  });

  it('retries a failed open when the device comes back online, with the original time', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T20:00:00Z') });
    const post = vi.fn().mockRejectedValueOnce(new DataApiError(0)).mockResolvedValue(undefined);
    const { opens } = setup(post);
    await opens.record();
    expect(localStorage.getItem('firstlight.opened.v1')).toBeNull();
    vi.setSystemTime(new Date('2026-10-13T20:30:00Z'));
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenLastCalledWith('/app_opens', { opened_at: '2026-10-13T20:00:00.000Z' });
  });
});
