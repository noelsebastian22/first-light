import { TestBed } from '@angular/core/testing';
import { AUTH_CLIENT, Auth, type AuthClientLike } from './auth';

function jwt(expSeconds: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'EdDSA' })}.${b64({ sub: 'u1', exp: expSeconds })}.sig`;
}

function fakeClient(over: Partial<AuthClientLike> = {}): AuthClientLike {
  return {
    getSession: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'noel@example.com', name: 'Noel' } }, error: null })),
    signIn: { social: vi.fn(async () => ({})) },
    signOut: vi.fn(async () => ({})),
    jwt: vi.fn(async () => jwt(Math.floor(Date.now() / 1000) + 900)),
    ...over,
  };
}

function setup(client: AuthClientLike) {
  TestBed.configureTestingModule({ providers: [{ provide: AUTH_CLIENT, useValue: client }] });
  return TestBed.inject(Auth);
}

describe('Auth', () => {
  it('loads the session once and exposes the user as a signal', async () => {
    const client = fakeClient();
    const auth = setup(client);
    expect(await auth.session()).toEqual({ id: 'u1', email: 'noel@example.com', name: 'Noel' });
    await auth.session();
    expect(client.getSession).toHaveBeenCalledTimes(1);
    expect(auth.user()?.email).toBe('noel@example.com');
  });

  it('treats a missing session or a failed call as signed out', async () => {
    expect(await setup(fakeClient({ getSession: vi.fn(async () => ({ data: null, error: null })) })).session()).toBeNull();
    TestBed.resetTestingModule();
    expect(await setup(fakeClient({ getSession: vi.fn(async () => { throw new Error('offline'); }) })).session()).toBeNull();
  });

  it('reuses a token until a minute before it expires, then fetches a new one', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T00:00:00Z') });
    const client = fakeClient();
    const auth = setup(client);
    const first = await auth.token();
    expect(await auth.token()).toBe(first);
    vi.setSystemTime(new Date('2026-10-13T00:14:30Z')); // 15-min token, 30 s left
    await auth.token();
    expect(client.jwt).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('drops the cached token on demand (after a 401)', async () => {
    const client = fakeClient();
    const auth = setup(client);
    await auth.token();
    auth.dropToken();
    await auth.token();
    expect(client.jwt).toHaveBeenCalledTimes(2);
  });

  it('signs in with Google back to the given path, and signs out', async () => {
    const client = fakeClient();
    const auth = setup(client);
    await auth.signIn('/today');
    expect(client.signIn.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: `${location.origin}/today` });
    await auth.session();
    await auth.signOut();
    expect(client.signOut).toHaveBeenCalled();
    expect(auth.user()).toBeNull();
  });
});
