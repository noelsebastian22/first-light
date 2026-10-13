/**
 * Same-origin proxy to Neon Auth, so its session cookie is first-party (Safari and iOS
 * block it as a third-party cookie). vercel.json rewrites `/auth/:path*` here as
 * `/api/auth?path=:path*`. A plain rewrite can't do this job: Vercel adds X-Forwarded-Host
 * and Neon answers 400 INVALID_HOSTNAME (spike, Task 5b).
 *
 * Header handling follows Neon's own server proxy (`handleAuthRequest` and
 * `handleAuthResponse` in `@neondatabase/auth/server`), with two differences: redirects
 * pass through to the browser instead of being followed, and `content-encoding` is
 * dropped because fetch has already decoded the body.
 */

/** Same value as `NEON.authUrl` off the production host (app/src/app/core/neon-config.ts). */
export const NEON_AUTH_URL = 'https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth';

const REQUEST_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type', 'x-neon-client-info'];
const RESPONSE_HEADERS = ['content-type', 'date', 'location', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];
const COOKIE_PREFIX = '__Secure-neon-auth';

/** The browser's Origin, else the Referer's, else this site's. Neon checks it against trusted origins. */
function originOf(request: Request): string {
  const referer = request.headers.get('referer');
  return request.headers.get('origin') ?? (referer ? new URL(referer).origin : new URL(request.url).origin);
}

function neonCookies(cookieHeader: string | null): string {
  return (cookieHeader ?? '')
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(COOKIE_PREFIX))
    .join('; ');
}

/** Drop Domain and Partitioned, force Secure and SameSite=Lax: the cookie now belongs to this site. */
function firstParty(setCookie: string): string {
  const [pair = '', ...attrs] = setCookie.split(';').map((p) => p.trim());
  const kept = attrs.filter((a) => !/^(domain|partitioned|samesite|secure)(=|$)/i.test(a));
  return [pair, ...kept, 'Secure', 'SameSite=Lax'].join('; ');
}

export async function proxyAuth(request: Request, upstreamBase = NEON_AUTH_URL, fetchFn: typeof fetch = fetch): Promise<Response> {
  const incoming = new URL(request.url);
  const path = incoming.searchParams.get('path') ?? '';
  incoming.searchParams.delete('path');
  const target = new URL(`${upstreamBase}/${path}`);
  target.search = incoming.search;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('origin', originOf(request));
  const cookie = neonCookies(request.headers.get('cookie'));
  if (cookie) headers.set('cookie', cookie);
  headers.set('x-neon-auth-middleware', 'true');

  let reply: Response;
  try {
    reply = await fetchFn(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
      redirect: 'manual',
    });
  } catch {
    return Response.json({ error: 'Auth service unreachable', code: 'UPSTREAM_UNREACHABLE' }, { status: 502 });
  }

  const out = new Headers({ 'cache-control': 'no-store' });
  for (const name of RESPONSE_HEADERS) {
    const value = reply.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const c of reply.headers.getSetCookie()) out.append('set-cookie', firstParty(c));
  return new Response(reply.body, { status: reply.status, statusText: reply.statusText, headers: out });
}

export default { fetch: (request: Request) => proxyAuth(request) };
