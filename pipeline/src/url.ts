const TRACKING = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

/** One canonical form per article: lower-case host, no tracking parameters, no fragment, no trailing slash. */
export function normaliseUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '');
  const query = url.searchParams.toString();
  return `${url.protocol}//${url.host}${url.pathname}${query ? `?${query}` : ''}`;
}
