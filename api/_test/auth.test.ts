import { describe, expect, it, vi } from 'vitest';
import { proxyAuth } from '../auth';

const UPSTREAM = 'https://neon.example/neondb/auth';
const SITE = 'https://firstlight.noel-sebastian.com';

/** A fake fetch that records the upstream request and answers with `reply`. */
function upstream(reply: Response = new Response('{}', { status: 200 })) {
  const seen: Request[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return reply;
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, seen };
}

/** What vercel.json's rewrite hands the function for `/auth/<path>?<query>`. */
function viaRewrite(path: string, query = '', init?: RequestInit): Request {
  return new Request(`${SITE}/api/auth?path=${encodeURIComponent(path)}${query ? `&${query}` : ''}`, init);
}

describe('proxyAuth', () => {
  it('forwards the path and query to Neon Auth, without the rewrite\'s path param', async () => {
    const { fetchFn, seen } = upstream();
    await proxyAuth(viaRewrite('get-session', 'neon_auth_session_verifier=v1'), UPSTREAM, fetchFn);
    expect(seen[0]?.url).toBe(`${UPSTREAM}/get-session?neon_auth_session_verifier=v1`);
  });

  it('keeps nested paths', async () => {
    const { fetchFn, seen } = upstream();
    await proxyAuth(viaRewrite('callback/google', 'code=c&state=s'), UPSTREAM, fetchFn);
    expect(seen[0]?.url).toBe(`${UPSTREAM}/callback/google?code=c&state=s`);
  });

  it('forwards method and body', async () => {
    const { fetchFn, seen } = upstream();
    const body = JSON.stringify({ provider: 'google', callbackURL: `${SITE}/spike` });
    await proxyAuth(
      viaRewrite('sign-in/social', '', { method: 'POST', body, headers: { 'content-type': 'application/json' } }),
      UPSTREAM,
      fetchFn,
    );
    expect(seen[0]?.method).toBe('POST');
    expect(await seen[0]?.text()).toBe(body);
    expect(seen[0]?.redirect).toBe('manual');
  });

  it('sends only the headers Neon needs: never X-Forwarded-Host, only Neon Auth cookies', async () => {
    const { fetchFn, seen } = upstream();
    await proxyAuth(
      viaRewrite('get-session', '', {
        headers: {
          'x-forwarded-host': 'firstlight.noel-sebastian.com',
          'x-forwarded-for': '203.0.113.9',
          'x-vercel-id': 'syd1::abc',
          'user-agent': 'Safari',
          'content-type': 'application/json',
          'x-neon-client-info': '{"sdk":"vanilla"}',
          cookie: 'theme=dark; __Secure-neon-auth.session_token=tok; __Secure-neon-auth.session_challenge=ch',
        },
      }),
      UPSTREAM,
      fetchFn,
    );
    const sent = seen[0]!.headers;
    expect(sent.get('x-forwarded-host')).toBeNull();
    expect(sent.get('x-forwarded-for')).toBeNull();
    expect(sent.get('x-vercel-id')).toBeNull();
    expect(sent.get('user-agent')).toBe('Safari');
    expect(sent.get('content-type')).toBe('application/json');
    expect(sent.get('x-neon-client-info')).toBe('{"sdk":"vanilla"}');
    expect(sent.get('cookie')).toBe('__Secure-neon-auth.session_token=tok; __Secure-neon-auth.session_challenge=ch');
    expect(sent.get('x-neon-auth-middleware')).toBe('true');
  });

  it('sends the browser\'s Origin, or the site\'s own when a same-origin GET has none', async () => {
    const { fetchFn, seen } = upstream();
    await proxyAuth(viaRewrite('sign-out', '', { method: 'POST', headers: { origin: SITE } }), UPSTREAM, fetchFn);
    await proxyAuth(viaRewrite('get-session'), UPSTREAM, fetchFn);
    expect(seen[0]?.headers.get('origin')).toBe(SITE);
    expect(seen[1]?.headers.get('origin')).toBe(SITE);
  });

  it('passes back status, body, the auth headers and redirects, and nothing else', async () => {
    const reply = new Response('{"user":null}', {
      status: 302,
      headers: {
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'set-auth-jwt': 'jwt.value.sig',
        location: 'https://accounts.google.com/o/oauth2/auth?x=1',
        'x-internal': 'secret-ish',
      },
    });
    const { fetchFn } = upstream(reply);
    const res = await proxyAuth(viaRewrite('get-session'), UPSTREAM, fetchFn);
    expect(res.status).toBe(302);
    expect(await res.text()).toBe('{"user":null}');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('set-auth-jwt')).toBe('jwt.value.sig');
    expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/auth?x=1');
    // fetch already decoded the body, so the encoding header would make the browser fail.
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('x-internal')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('makes every cookie first-party: no Domain, no Partitioned, SameSite=Lax, Secure', async () => {
    const reply = new Response(null, { status: 200 });
    reply.headers.append(
      'set-cookie',
      '__Secure-neon-auth.session_token=a%2Bb; Path=/; Domain=neon.example; Max-Age=604800; HttpOnly; Secure; SameSite=None; Partitioned',
    );
    reply.headers.append('set-cookie', '__Secure-neon-auth.session_challenge=; Path=/; Max-Age=0; HttpOnly; SameSite=none');
    const { fetchFn } = upstream(reply);
    const res = await proxyAuth(viaRewrite('get-session'), UPSTREAM, fetchFn);
    expect(res.headers.getSetCookie()).toEqual([
      '__Secure-neon-auth.session_token=a%2Bb; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax',
      '__Secure-neon-auth.session_challenge=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ]);
  });

  it('answers 502 when Neon Auth is unreachable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const res = await proxyAuth(viaRewrite('get-session'), UPSTREAM, fetchFn);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Auth service unreachable', code: 'UPSTREAM_UNREACHABLE' });
  });
});
