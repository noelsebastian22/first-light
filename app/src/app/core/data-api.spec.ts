import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';
import { DataApi, DataApiError } from './data-api';
import { NEON } from './neon-config';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('DataApi', () => {
  let http: HttpTestingController;
  let api: DataApi;
  const auth = { token: vi.fn(async (): Promise<string | null> => 'tok-1'), dropToken: vi.fn() };

  beforeEach(() => {
    auth.token.mockReset().mockResolvedValue('tok-1');
    auth.dropToken.mockReset();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Auth, useValue: auth }],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(DataApi);
  });

  it('sends the bearer token and returns the JSON body', async () => {
    const result = api.get<{ id: string }[]>('/editions?select=id');
    await flush();
    const req = http.expectOne(`${NEON.dataApiUrl}/editions?select=id`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush([{ id: 'ed-1' }]);
    expect(await result).toEqual([{ id: 'ed-1' }]);
  });

  it('retries a 401 once with a fresh token', async () => {
    auth.token.mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const result = api.get<unknown[]>('/editions');
    await flush();
    http.expectOne(`${NEON.dataApiUrl}/editions`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await flush();
    const retry = http.expectOne(`${NEON.dataApiUrl}/editions`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([]);
    expect(await result).toEqual([]);
    expect(auth.dropToken).toHaveBeenCalledTimes(1);
  });

  it('retries once when Neon rejects an expired token (a 400, not a 401)', async () => {
    auth.token.mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const result = api.get<unknown[]>('/editions');
    await flush();
    http
      .expectOne(`${NEON.dataApiUrl}/editions`)
      .flush({ message: 'JWT token has expired (exp=1791928371)', code: null }, { status: 400, statusText: 'Bad Request' });
    await flush();
    const retry = http.expectOne(`${NEON.dataApiUrl}/editions`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([]);
    expect(await result).toEqual([]);
    expect(auth.dropToken).toHaveBeenCalledTimes(1);
  });

  it('does not retry an ordinary bad request', async () => {
    const result = api.get<unknown[]>('/editions?bad=1');
    await flush();
    http
      .expectOne(`${NEON.dataApiUrl}/editions?bad=1`)
      .flush({ message: 'failed to parse filter (bad)', code: 'PGRST100' }, { status: 400, statusText: 'Bad Request' });
    await expect(result).rejects.toMatchObject({ status: 400 });
    expect(auth.dropToken).not.toHaveBeenCalled();
  });

  it('gives up after a second 401', async () => {
    const result = api.get<unknown[]>('/editions');
    await flush();
    http.expectOne(`${NEON.dataApiUrl}/editions`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await flush();
    http.expectOne(`${NEON.dataApiUrl}/editions`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
  });

  it('fails fast without a token, and reports network failure as status 0', async () => {
    auth.token.mockResolvedValueOnce(null);
    await expect(api.get('/editions')).rejects.toBeInstanceOf(DataApiError);
    const result = api.post('/reads', { story_id: 's1' });
    await flush();
    http.expectOne(`${NEON.dataApiUrl}/reads`).error(new ProgressEvent('error'));
    await expect(result).rejects.toMatchObject({ status: 0 });
  });

  it('calls a function with POST and an empty object', async () => {
    const result = api.rpc<boolean>('is_member');
    await flush();
    const req = http.expectOne(`${NEON.dataApiUrl}/rpc/is_member`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(true);
    expect(await result).toBe(true);
  });

  afterEach(() => http.verify());
});
