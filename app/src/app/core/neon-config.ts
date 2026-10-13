/**
 * Public endpoints. Not secrets: the browser reaches them with the signed-in
 * user's own short-lived token, and RLS decides what it sees (spec §4).
 */
export const NEON = {
  /**
   * In production, Neon Auth goes through a same-origin proxy (`api/auth.ts`) so its
   * session cookie is first-party: Safari blocks it as a third-party cookie (spike, Task 5c).
   */
  authUrl:
    typeof location !== 'undefined' && location.hostname === 'firstlight.noel-sebastian.com'
      ? `${location.origin}/auth`
      : 'https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth',
  dataApiUrl: 'https://ep-round-morning-a71pawwz.apirest.ap-southeast-2.aws.neon.tech/neondb/rest/v1',
} as const;
