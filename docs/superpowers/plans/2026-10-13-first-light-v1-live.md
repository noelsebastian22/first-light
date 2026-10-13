# First Light v1 live — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the merged offline v1 to a live app: Noel signs in with Google, reads the real edition written by the routine, and gets the watchdog and reminder emails.

**Architecture:** Neon Auth (Managed Better Auth, Google only) signs Noel in. The Angular app gets a short-lived JWT from it and reads through the Neon Data API, where RLS decides what a member sees. `NeonEditionSource` is a second implementation of the existing `EDITION_SOURCE` token, so the screens don't change. The routine writes editions with `pipeline_writer` over HTTPS. GitHub Actions reads them with `watchdog_reader`.

**Tech Stack:** Angular 22 (standalone, zoneless, signals, `HttpClient`, `rxResource`), `@neondatabase/auth` (vanilla Better Auth client, beta), Neon Data API (PostgREST), Postgres 18, Vercel Hobby, Cloudflare DNS, Claude Code routines, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-10-10-first-light-design.md`](../specs/2026-10-10-first-light-design.md). This plan covers build-order steps 5–7 (§9). Account steps follow [`docs/runbook.md`](../../runbook.md).

## Status (2026-10-13, end of first session)

| Tasks | State |
|---|---|
| 1–4 | Done (Neon Auth locked, Data API + 0001/0002 live, write smoke, Vercel + domain) |
| 5 | Code done (`auth.ts`, `neon-config.ts`, `/spike`); matrix: desktop Chrome passed direct, macOS Safari failed |
| 5b | Variant B (rewrite) failed: `400 INVALID_HOSTNAME`. Noel chose a Vercel Function proxy → Task 5c |
| 5c | Done. Deployed `bfaadf3` + `9a17d9d`. Matrix passes on desktop Chrome, macOS Safari (one unexplained `token: none` first, then passed), iPhone Safari and the iPhone home-screen app. Manifest `start_url` was `./spike` during the spike; Task 8 set it back to `./` |
| 6 | Done (`data-api.ts`, 5 tests). Also `vercel.json` `regions: ["syd1"]` |
| 7 | Done (`rows.ts`, `neon-edition-source.ts`, `offline-store.ts` stub, `today()` nullable; 14 tests) |
| 8 | Done. Deployed `a1d31e8`; Noel is the one member; `/today` → `/waiting` as expected (no edition until Task 12). Sign-out untestable until an edition exists |
| 9 | Code done (IndexedDB `OfflineStore`, `AppOpens`, guard records opens incl. offline, `DataApi` reports offline as status 0). Step 7 offline check waits for a real edition (Task 12) |
| 10 | Done (`sydneyMinutes`, pm poll, greeting + next-edition time; demo/pwa e2e now expect "Good afternoon.") |
| 11 | **Next** |
| 12–13 | Not started |

**Task 5c (new): auth proxy as a Vercel Function.** Replace the `/auth/:path*` rewrite in
`vercel.json` with a function at `/auth/*` that forwards method, path, query, body and
cookies to the Neon Auth base URL, without `X-Forwarded-Host`, and passes back the
status, body, `Set-Cookie` and `set-auth-jwt`. Exclude `/auth/**` from the Angular service
worker's navigation handling (the Google return is a navigation). Unit-test the
header handling, then deploy and run the full Task 5 matrix (all four surfaces, reload, 20
min idle). If iOS still fails, stop and reconsider the provider with Noel.
Also: production `/spike` is broken on every browser until 5c ships (its `authUrl` points at
the failing rewrite); the demo is unaffected.

Use the ledger `.superpowers/sdd/2026-10-13-first-light-v1-live/progress.md`. Force-add it to git like the v1-offline one, and commit it with each task.

## Live state when this plan was written

Checked through the Neon and Vercel MCPs on 2026-10-13. Re-check before Task 1; the console wins over this table.

| Thing | State |
|---|---|
| Neon project | `bold-heart-62307789`, PG 18, `aws-ap-southeast-2`, compute 0.25 CU (min = max, also the project default) |
| Branch / endpoint | `production` = `br-dawn-moon-a7jvx6m5`, endpoint `ep-round-morning-a71pawwz` |
| Neon Auth | Provisioned. Base URL `https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth`. **Email/password on with sign-up allowed**; Google uses Neon's **shared** dev credentials; trusted origins empty; localhost allowed; 0 users |
| Data API | Not provisioned |
| Schema | Only `neon_auth.*`. `0001_init.sql` not applied; no `pipeline_writer`, `watchdog_reader`, `authenticated` or `anonymous` roles |
| Vercel | No project |

## Who does what

Steps marked **(Noel)** need a human at a console: Google Cloud, Neon, Vercel, Cloudflare, GitHub settings, claude.ai routines, or a password. The agent prepares exact values, waits, and then **verifies** the result through MCP or `curl`. An agent never sees or stores a password or OAuth secret. Noel types those into consoles himself, or runs commands with `! <command>`.

## Global Constraints

- Node 24 (≥ 24.15) and npm 11, TypeScript strict, **no `any`**.
- Angular: standalone, zoneless, every component `ChangeDetectionStrategy.OnPush`, `input()`/`output()`, `inject()`, built-in control flow, templates in sibling `.html` files.
- A "day" is a `YYYY-MM-DD` string in `Australia/Sydney`; never `toISOString()` for a calendar date.
- Model text is rendered as plain text only; never `innerHTML`.
- **The browser holds no secrets.** The Neon Auth URL and Data API URL are public endpoints and may be committed. No connection string, password or OAuth secret ever enters `app/`. `check:secrets` and `check:csp` must stay green.
- **The demo never touches the database.** `/demo/*` keeps `DemoEditionSource`; nothing under `demo.routes.ts` may inject `Auth` or `DataApi`.
- **Google only.** Email/password is off before the first sign-in. Membership (`private.members`), not sign-in, grants access.
- Migrations: numbered, never edited once applied. RLS on every table.
- Workflows never print query results, headlines or raw errors; log only `ok`, `sent`, `skipped`.
- **$0.** Neon free plan, Vercel Hobby, GitHub free, Claude subscription. Anything that adds a bill needs Noel's explicit OK.
- Neon compute stays at 0.25 CU; raising it is a recorded decision (spec §7).

## Review Focus

1. **No usable edition today.** Possible causes: before 5:32am, the am edition failed, or it's the very first day. Today must show the latest `ok`/`partial` edition with its own date, not a blank page or a crash. With no edition at all it goes to the "first edition lands at 5:32am" page. Test in Task 7 (`pickToday`) and Task 8 (resolver redirect).
2. **The JWT expires (15 min) while the app stays open.** The next Data API call must get a fresh token and succeed. A 401 is retried once with a new token; a second 401 sends you to `/signin`. Test in Task 6.
3. **Signed in with Google, but not a member.** Must land on `/demo/today?private=1` and make no content calls. A stranger who completes Google sign-in sees exactly the demo. Test in Task 8.
4. **Offline on the train, with an edition cached.** The member guard lets a previously verified member through without a token, and Today renders from IndexedDB. Offline with nothing cached goes to `/signin`. Test in Task 9.
5. **A save or read fails to reach the server** (offline, 5xx), or is tapped twice. The UI reverts to the true state, and a duplicate insert (409) counts as success. Test in Task 7.

---

## Phase A — Neon

### Task 1: Lock down Neon Auth

No code. Makes the live auth config match spec §7 before anyone signs in.

**Files:**
- Modify: `docs/runbook.md` (§1 step 2: record what was done and the Google client's name)

- [ ] **Step 1 (Noel): Create the Google OAuth client.** Google Cloud console → APIs & Services → create project "First Light" → OAuth consent screen: External, **Testing** status, test users = Noel's Google address only, scopes `openid email profile`. Credentials → OAuth client ID → Web application:
  - Authorised JavaScript origins: `https://firstlight.noel-sebastian.com`, `http://localhost:4200`
  - Authorised redirect URI: `https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth/callback/google`
- [ ] **Step 2 (Noel): Neon console → project first-light → Auth → Configuration:**
  - Email & password: **off** (sign-up off too).
  - Google: switch from shared to **custom** credentials and paste the client ID and secret.
  - Trusted domains: add `https://firstlight.noel-sebastian.com`. Leave "Allow localhost" **on** until Task 13.
- [ ] **Step 3: Verify (agent).** Call `get_neon_auth_config` (project `bold-heart-62307789`, branch `br-dawn-moon-a7jvx6m5`). Expected:
  - `auth_methods.email_password.enabled = false`;
  - `oauth_providers = [{ id: "google", type: "standard" }]` (any non-`shared` type, with `client_id` set);
  - `trusted_origins` contains the production origin.

  Also confirm there are still no users: `select count(*) from neon_auth."user"` returns 0. If any shared-credential user exists, stop and tell Noel.
- [ ] **Step 4: Update the runbook.** In `docs/runbook.md` §1 step 2, append: `Done 2026-MM-DD: Google client "First Light" (Testing, one test user). Email/password off.` Use `date +%F`.
- [ ] **Step 5: Commit**

```bash
git add docs/runbook.md
git commit -m "docs(runbook): Neon Auth locked to Google"
```

### Task 2: Data API, migrations ledger, schema

Provisions the Data API (it creates `authenticated`, `anonymous` and `auth.user_id()`). Adds a small ledger so `/session-handoff start` can compare live migrations with the folder. Then applies both migrations.

**Files:**
- Create: `db/migrations/0002_schema_migrations.sql`
- Modify: `db/test/rls.sql` (append the ledger checks)
- Modify: `.agents/skills/session-handoff/SKILL.md` (start step 4: the exact query)
- Modify: `docs/runbook.md` (§1 steps 3–5: done markers, Data API URL)
- Modify: `AGENTS.md` (Database section: the ledger rule)

**Interfaces:**
- Produces: the **Data API URL** (`get_data_api` → `url`). Task 5 writes it into `app/src/app/core/neon-config.ts`. Produces the table `private.schema_migrations(version text primary key, applied_at timestamptz)`; every future migration ends by inserting its own version.

- [ ] **Step 1: Write the failing ledger test.** Append to `db/test/rls.sql`:

```sql
-- The migrations ledger lists every applied file and is unreachable from the API roles.
reset role;
do $$ begin
  if (select array_agg(version order by version) from private.schema_migrations)
     <> array['0001_init', '0002_schema_migrations'] then
    raise exception 'FAIL: migrations ledger does not list 0001 and 0002';
  end if;
end $$;
set role authenticated;
do $$ begin
  perform 1 from private.schema_migrations;
  raise exception 'FAIL: authenticated can read the migrations ledger';
exception when insufficient_privilege then null;
end $$;
reset role;
```

- [ ] **Step 2: Run it and watch it fail.** Docker Desktop must be running. Use the local container (`docker start fl-pg18` if stopped):

Run: `DATABASE_URL=postgres://postgres@localhost:5432/postgres PSQL="docker exec -i fl-pg18 psql -U postgres" db/test/run.sh`
Expected: FAIL with `relation "private.schema_migrations" does not exist`.

- [ ] **Step 3: Write the migration** `db/migrations/0002_schema_migrations.sql`:

```sql
-- Records which migrations are applied, so a session can compare the live
-- project with db/migrations/ (session-handoff, start step 4).
-- Every later migration ends with its own insert into this table.

begin;

create table private.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table private.schema_migrations enable row level security;

insert into private.schema_migrations (version) values ('0001_init'), ('0002_schema_migrations');

commit;
```

- [ ] **Step 4: Run the tests again.**

Run: same command as Step 2.
Expected: `ok: rls tests passed`.

- [ ] **Step 5: Provision the Data API (agent, MCP).** Call `provision_neon_data_api` with:
  - `project_id: bold-heart-62307789`, `branch_id: br-dawn-moon-a7jvx6m5`, `database_name: neondb`;
  - `auth_provider: "neon_auth"`, `add_default_grants: false` (0001 grants exactly what spec §4 lists);
  - `settings: { db_schemas: ["public"], server_cors_allowed_origins: "https://firstlight.noel-sebastian.com,http://localhost:4200" }`.

  Then call `get_data_api` and record `url`. Verify the prerequisites:

```sql
select rolname from pg_roles where rolname in ('authenticated', 'anonymous') order by 1;
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and proname = 'user_id';
```

Expected: both roles exist, and `user_id` is present. If either is missing, stop. Don't apply 0001 against a hand-made shim.

- [ ] **Step 6: Apply 0001 and 0002 (agent, MCP).**
  1. Call `prepare_database_migration` with the contents of `0001_init.sql` followed by `0002_schema_migrations.sql`. If it rejects the files' own `begin;`/`commit;`, pass them with those two lines removed: the tool runs the SQL as one unit.
  2. On the temporary branch it returns, run `select version from private.schema_migrations order by 1` and `select count(*) from pg_policies where schemaname = 'public'`. Expected: 2 rows and 12 policies.
  3. Show Noel the results and ask before `complete_database_migration`.

  Fallback: Noel pastes each file, in order, into the Neon SQL editor as `neondb_owner`.
- [ ] **Step 7: Check the Data API's view.** As an anonymous caller, `curl -s -o /dev/null -w '%{http_code}\n' "<url>/editions?select=id"` must return `401`, and `curl -s "<url>/members"` must not return rows (404 or 401). `private` isn't exposed.
- [ ] **Step 8 (Noel): Role passwords.** In the Neon SQL editor, per runbook §1 step 5. Generate each with `openssl rand -base64 33 | tr -d '/+='` and store it in the password manager. Then:

```sql
alter role pipeline_writer with login password '<generated>';
alter role watchdog_reader with login password '<generated>';
```

- [ ] **Step 9: Update the handoff skill.** In `.agents/skills/session-handoff/SKILL.md`, start step 4, replace the sentence after "list the applied migrations" with:

```markdown
4. If the Neon MCP is connected, run `select version from private.schema_migrations order by 1`
   on project `bold-heart-62307789` and compare with `db/migrations/`. The live project is
   the truth; the folder can lag.
```

- [ ] **Step 10: Docs.** `AGENTS.md`, Database section: add the bullet `- Every migration ends by inserting its version into private.schema_migrations.` In `docs/runbook.md` §1 steps 3–5, add done markers and the Data API URL (it's public, not a secret).
- [ ] **Step 11: Commit**

```bash
git add db/migrations/0002_schema_migrations.sql db/test/rls.sql .agents/skills/session-handoff/SKILL.md AGENTS.md docs/runbook.md
git commit -m "feat(db): migrations ledger; Data API and schema live"
```

### Task 3: Live write smoke on a throwaway branch

Proves `pipeline_writer`'s real grants on Neon before the routine depends on them, without putting test data on `production`.

**Files:** none changed; results go into the ledger.

- [ ] **Step 1: Create a branch (agent, MCP).** Call `create_branch` with name `smoke-2026-10-13`, parent `production`. Branches inherit roles and passwords. Record the branch's endpoint host.
- [ ] **Step 2: Build a validated edition offline.**

Run: `npm run pipeline -- demo-run`
Expected: ends with `ok:`. `pipeline/out/validated.json` exists.

- [ ] **Step 3 (Noel): Write it to the branch.** Use the `pipeline_writer` URL with the **branch** host. Run this in **your own terminal**, not through the agent or a `!` prompt: those put the command, and the password, in the transcript. Paste back only the output line.

```bash
DATABASE_URL='postgresql://pipeline_writer:<password>@<branch-endpoint-host>/neondb?sslmode=require' npm run pipeline -- write
```

Expected: `ok: wrote ed-<date>-<slot>`. Run it again; expected: `skipped:` (an `ok` edition is left alone).
- [ ] **Step 4: Check as owner (agent, MCP on the branch).** `select status, source_count from editions` should return 1 row; `select count(*) from stories` should be > 0. As a non-member, the Data API returns `[]` for `/editions` (checked in Task 5 once a token exists; note it in the ledger).
- [ ] **Step 5: Delete the branch.** `delete_branch` is destructive, so ask Noel first. Then record the outcome in the ledger and commit the ledger.

```bash
git add -f .superpowers/sdd/2026-10-13-first-light-v1-live/progress.md
git commit -m "chore: live write smoke on a Neon branch"
```

---

## Phase B — Hosting and the auth spike

### Task 4: Vercel and the domain

The demo goes public, which is spec build-order step 2's "deploy". It also gives the auth spike a real HTTPS origin, which iOS testing needs.

**Files:**
- Modify: `docs/runbook.md` (add `## 5. Vercel` with what was set)

- [ ] **Step 1 (Noel): Vercel.** Import `noelsebastian22/first-light` on the Hobby plan. Settings:
  - Framework preset: Other;
  - Root directory: repo root (`vercel.json` holds the build command and output dir);
  - Node.js version: 24.x;
  - Install command: `npm ci`.

  Deploy. Then Settings → Domains → add `firstlight.noel-sebastian.com`.
- [ ] **Step 2 (Noel): Cloudflare.** DNS → CNAME `firstlight` → `cname.vercel-dns.com`, proxy **off** (grey cloud).
- [ ] **Step 3: Verify (agent).**

```bash
curl -sI https://firstlight.noel-sebastian.com/ | grep -i -E '^(HTTP|content-security-policy|x-content-type-options|referrer-policy)'
curl -s https://firstlight.noel-sebastian.com/demo/today | grep -c '<app-root'
```

Expected: `HTTP/2 200`, all three headers present and matching `vercel.json`, and a count of `1` (the SPA rewrite works).
- [ ] **Step 4: Runbook and commit.** Add `## 5. Vercel` to the runbook with the settings above. Then:

```bash
git add docs/runbook.md
git commit -m "docs(runbook): Vercel and domain"
```

### Task 5: Auth service and the spike (spec §9.5)

Builds the real `Auth` service and a temporary `/spike` page. Then tests sign-in on the four surfaces the spec names. **The result decides Task 5b.** If any surface fails in variant A, try variant B before moving on.

**Files:**
- Create: `app/src/app/core/neon-config.ts`
- Create: `app/src/app/core/auth.ts`
- Create: `app/src/app/core/auth.spec.ts`
- Create: `app/src/app/spike/spike.ts`, `app/src/app/spike/spike.html` (deleted in Task 8)
- Modify: `app/src/app/app.routes.ts` (temporary `spike` route)
- Modify: `app/package.json` (dependency)

**Interfaces:**
- Produces:
  - `NEON: { authUrl: string; dataApiUrl: string }`;
  - `AUTH_CLIENT: InjectionToken<AuthClientLike>`;
  - `class Auth { readonly user: Signal<SignedInUser | null>; session(): Promise<SignedInUser | null>; token(): Promise<string | null>; dropToken(): void; signIn(next: string): Promise<void>; signOut(): Promise<void> }`;
  - `interface SignedInUser { id: string; email: string; name: string }`.

- [ ] **Step 1: Install and check the client's shape.**

Run: `npm install @neondatabase/auth@0.6.0-beta -w app`

Then open `node_modules/@neondatabase/auth/dist/index.d.mts` and confirm the default client (no adapter = `BetterAuthVanillaAdapter`) exposes:
- `getSession()` returning `{ data: { user } | null, error }`;
- `signIn.social({ provider, callbackURL })`;
- `signOut()`;
- either `token()` returning `{ data: { token } }` or `getJWTToken()` returning `string | null`.

Note in the ledger which token method exists. Step 3 uses `token()` and falls back to `getJWTToken()`.

- [ ] **Step 2: Write the failing tests** `app/src/app/core/auth.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run them and watch them fail.**

Run: `npm test -w app -- --include src/app/core/auth.spec.ts`
Expected: FAIL, `Cannot find module './auth'`.

- [ ] **Step 4: Write `app/src/app/core/neon-config.ts`.** Use the Data API URL recorded in Task 2 Step 5:

```ts
/**
 * Public endpoints. Not secrets: the browser reaches them with the signed-in
 * user's own short-lived token, and RLS decides what it sees (spec §4).
 */
export const NEON = {
  authUrl: 'https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth',
  dataApiUrl: '<the url from get_data_api in Task 2 Step 5, no trailing slash>',
} as const;
```

The second value is a fact discovered in Task 2, not a TODO. The implementer pastes it and the build doesn't start without it.

- [ ] **Step 5: Write `app/src/app/core/auth.ts`.**

```ts
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { createAuthClient } from '@neondatabase/auth';
import { NEON } from './neon-config';

export interface SignedInUser {
  id: string;
  email: string;
  name: string;
}

/** The slice of the Neon Auth client the app uses; tests replace it. */
export interface AuthClientLike {
  getSession(): Promise<{ data: { user: SignedInUser } | null; error: unknown }>;
  signIn: { social(o: { provider: 'google'; callbackURL: string }): Promise<unknown> };
  signOut(): Promise<unknown>;
  /** A Data API JWT for the current session, or null when signed out. */
  jwt(): Promise<string | null>;
}

export const AUTH_CLIENT = new InjectionToken<AuthClientLike>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const sdk = createAuthClient(NEON.authUrl);
    return {
      getSession: () => sdk.getSession() as ReturnType<AuthClientLike['getSession']>,
      signIn: { social: (o) => sdk.signIn.social(o) },
      signOut: () => sdk.signOut(),
      // Step 1 recorded which method the installed SDK has. Keep exactly one of these lines:
      jwt: async () => (await sdk.token()).data?.token ?? null,
      // jwt: () => sdk.getJWTToken(),
    };
  },
});

/** The JWT's exp in ms; a token that can't be read is treated as nearly expired. */
function expiresAt(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : Date.now() + 60_000;
  } catch {
    return Date.now() + 60_000;
  }
}

/** Google sign-in through Neon Auth, and the short-lived token the Data API needs. */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly client = inject(AUTH_CLIENT);
  private readonly current = signal<SignedInUser | null>(null);
  readonly user = this.current.asReadonly();
  private loaded: Promise<SignedInUser | null> | null = null;
  private cached: { token: string; exp: number } | null = null;

  /** Once per page load. The SDK also completes the OAuth return here. */
  session(): Promise<SignedInUser | null> {
    this.loaded ??= this.client
      .getSession()
      .then(({ data }) => (data?.user ? { id: data.user.id, email: data.user.email, name: data.user.name } : null))
      .catch(() => null)
      .then((user) => {
        this.current.set(user);
        return user;
      });
    return this.loaded;
  }

  async token(): Promise<string | null> {
    if (this.cached && this.cached.exp - 60_000 > Date.now()) return this.cached.token;
    const token = await this.client.jwt();
    this.cached = token ? { token, exp: expiresAt(token) } : null;
    return token;
  }

  dropToken(): void {
    this.cached = null;
  }

  async signIn(next: string): Promise<void> {
    await this.client.signIn.social({ provider: 'google', callbackURL: `${location.origin}${next}` });
  }

  async signOut(): Promise<void> {
    await this.client.signOut();
    this.cached = null;
    this.loaded = null;
    this.current.set(null);
  }
}
```

If `typecheck` rejects the `getSession` cast because the SDK's user type lacks a field, map the fields explicitly instead. Never cast through `any`.

- [ ] **Step 6: Run the tests.**

Run: `npm test -w app -- --include src/app/core/auth.spec.ts && npm run typecheck -w app`
Expected: 5 passed, and typecheck is clean.

- [ ] **Step 7: Spike page.** `app/src/app/spike/spike.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Auth } from '../core/auth';
import { NEON } from '../core/neon-config';

/** Temporary (spec §9.5). Deleted in Task 8. */
@Component({
  selector: 'app-spike',
  templateUrl: './spike.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spike {
  protected readonly auth = inject(Auth);
  protected readonly log = signal<string[]>([]);

  constructor() {
    void this.check();
  }

  protected async check() {
    const lines: string[] = [];
    const user = await this.auth.session();
    lines.push(`session: ${user ? user.email : 'none'}`);
    this.auth.dropToken();
    const token = await this.auth.token();
    lines.push(`token: ${token ? `yes, ${token.length} chars` : 'none'}`);
    if (token) {
      for (const path of ['/editions?select=id&limit=1', '/rpc/is_member']) {
        const res = await fetch(`${NEON.dataApiUrl}${path}`, {
          method: path.startsWith('/rpc') ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: path.startsWith('/rpc') ? '{}' : undefined,
        });
        lines.push(`${path}: HTTP ${res.status} ${await res.text()}`);
      }
    }
    lines.push(`checked at ${new Date().toLocaleTimeString('en-AU')}`);
    this.log.set(lines);
  }

  protected signIn() {
    void this.auth.signIn('/spike');
  }
}
```

`app/src/app/spike/spike.html`:

```html
<main class="signin">
  <div class="clay signin-card">
    <h1 class="disp">Auth spike</h1>
    @for (line of log(); track $index) {
      <p class="label">{{ line }}</p>
    }
    <button class="btn btn-pri" type="button" (click)="signIn()">Sign in with Google</button>
    <button class="btn" type="button" (click)="check()">Check again</button>
  </div>
</main>
```

Add to `app.routes.ts`, before `'**'`:

```ts
  { path: 'spike', loadComponent: () => import('./spike/spike').then((m) => m.Spike), title: 'Spike · First Light' },
```

- [ ] **Step 8: Build and check the bundle.**

Run: `npm run build -w app && npm run check:secrets && npm run check:csp`
Expected: all green. Record the initial bundle in the ledger and compare it with 307 kB. Auth must sit in a **lazy** chunk. If the initial bundle grew by more than 5 kB, find what eagerly imports `auth.ts` and fix it.
- [ ] **Step 9: Deploy and run the matrix.** Commit (Step 10) and push a branch. Vercel builds a preview, but test on **production**: the trusted domain and the Google origin are production. So merge to `main` (the route is unlinked and harmless), or Noel adds the preview origin to Neon's trusted domains for the spike.

Noel opens `/spike` and signs in on each surface, pressing **Check again** at each checkpoint:

| Surface | After sign-in | After reload | After 20 min idle, then Check again |
|---|---|---|---|
| Desktop Chrome | | | |
| iOS Safari | | | |
| iOS home-screen app (Add to Home Screen, open from icon) | | | |
| Android Chrome or desktop Safari (whichever Noel has) | | | |

A pass means: the session shows the email, the token says `yes`, `/editions` is `HTTP 200 []` (not a member yet), `/rpc/is_member` is `HTTP 200 false`. Also check: `select count(*) from neon_auth."user"` is now 1.

- [ ] **Step 10: Commit**

```bash
git add app/package.json package-lock.json app/src/app/core/neon-config.ts app/src/app/core/auth.ts app/src/app/core/auth.spec.ts app/src/app/spike app/src/app/app.routes.ts
git commit -m "feat(app): Neon Auth service and the auth spike page"
```

### Task 5b: Spike ruling (and the proxy fallback, only if needed)

- [ ] **Step 1: If every cell passed in Task 5:** record the ruling in the ledger and in the spec's Decisions log:

  `| Auth transport | Direct to Neon Auth from the browser; passed desktop, iOS Safari and the iOS home-screen app incl. reload and token expiry (spike, <date>) |`

  Commit with `docs: auth spike passed direct`, then go to Task 6.

- [ ] **Step 2: If iOS fails after reload (the expected failure: Safari blocks Neon's third-party session cookie)**, try **variant B, the same-origin proxy**. In `vercel.json`, add before the SPA rewrite:

```json
{ "source": "/auth/:path*", "destination": "https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth/:path*" },
```

  In `neon-config.ts`, compute the auth URL from the origin in production:

```ts
  authUrl: typeof location !== 'undefined' && location.hostname === 'firstlight.noel-sebastian.com'
    ? `${location.origin}/auth`
    : 'https://ep-round-morning-a71pawwz.neonauth.ap-southeast-2.aws.neon.tech/neondb/auth',
```

  Change the Google OAuth client's redirect URI to `https://firstlight.noel-sebastian.com/auth/callback/google` (Noel), so the OAuth state cookie and the callback share the origin. Redeploy and rerun the whole matrix.

- [ ] **Step 3: If variant B also fails:** stop. Write up both results for Noel. The spec's other fallback, reading through Vercel functions, changes the architecture and needs his call. Don't start Task 6.
- [ ] **Step 4: Record and commit** the ruling (variant and evidence) in the spec's Decisions log, the ledger, and the plan's Status table.

```bash
git add vercel.json app/src/app/core/neon-config.ts docs/superpowers/specs/2026-10-10-first-light-design.md
git add -f .superpowers/sdd/2026-10-13-first-light-v1-live/progress.md
git commit -m "feat(app): auth through a same-origin proxy (spike ruling)"
```

---

## Phase C — Live data in the app

### Task 6: `DataApi` client

**Files:**
- Create: `app/src/app/core/data-api.ts`
- Create: `app/src/app/core/data-api.spec.ts`

**Interfaces:**
- Consumes: `Auth.token()`, `Auth.dropToken()`, `NEON.dataApiUrl`.
- Produces: `class DataApi { get<T>(path: string): Promise<T>; post(path: string, body: object): Promise<void>; delete(path: string): Promise<void>; rpc<T>(fn: string): Promise<T> }` and `class DataApiError extends Error { readonly status: number }`. Status `0` means offline or network failure.

- [x] **Step 1: Write the failing tests** `app/src/app/core/data-api.spec.ts`:

```ts
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
```

- [x] **Step 2: Run them and watch them fail.**

Run: `npm test -w app -- --include src/app/core/data-api.spec.ts`
Expected: FAIL, `Cannot find module './data-api'`.

- [x] **Step 3: Write `app/src/app/core/data-api.ts`.**

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Auth } from './auth';
import { NEON } from './neon-config';

/** A failed Data API call. Status 0 means the network, not the server. */
export class DataApiError extends Error {
  constructor(readonly status: number) {
    super(`data api: HTTP ${status}`);
  }
}

type Method = 'GET' | 'POST' | 'DELETE';

/** The Neon Data API (PostgREST) with the signed-in user's token. RLS does the rest. */
@Injectable({ providedIn: 'root' })
export class DataApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }

  async post(path: string, body: object): Promise<void> {
    await this.send<null>('POST', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.send<null>('DELETE', path);
  }

  rpc<T>(fn: string): Promise<T> {
    return this.send<T>('POST', `/rpc/${fn}`, {});
  }

  private async send<T>(method: Method, path: string, body?: object, retried = false): Promise<T> {
    const token = await this.auth.token();
    if (!token) throw new DataApiError(401);
    try {
      return await firstValueFrom(
        this.http.request<T>(method, `${NEON.dataApiUrl}${path}`, { body, headers: { Authorization: `Bearer ${token}` } }),
      );
    } catch (e) {
      if (!(e instanceof HttpErrorResponse)) throw e;
      if (e.status === 401 && !retried) {
        this.auth.dropToken();
        return this.send<T>(method, path, body, true);
      }
      throw new DataApiError(e.status);
    }
  }
}
```

- [x] **Step 4: Run the tests.**

Run: `npm test -w app -- --include src/app/core/data-api.spec.ts && npm run typecheck -w app`
Expected: 5 passed, and typecheck is clean.

- [x] **Step 5: Commit**

```bash
git add app/src/app/core/data-api.ts app/src/app/core/data-api.spec.ts
git commit -m "feat(app): Data API client with token refresh on 401"
```

### Task 7: Row mapping and `NeonEditionSource`

**Files:**
- Create: `app/src/app/core/rows.ts` (pure: row types, `toEdition`, `toStory`, `pickToday`)
- Create: `app/src/app/core/rows.spec.ts`
- Create: `app/src/app/core/neon-edition-source.ts`
- Create: `app/src/app/core/neon-edition-source.spec.ts`
- Modify: `app/src/app/core/edition-source.ts` (`today()` may return `null`)
- Modify: `app/src/app/today/today.resolver.ts` (null → `/waiting`)

**Interfaces:**
- Consumes: `DataApi` (Task 6), `sydneyDate` from `@first-light/contracts/dates`, `SECTIONS` from `@first-light/contracts/sections-meta`.
- Produces:
  - `EditionSource.today(): Promise<TodayEditions | null>`;
  - `pickToday(editions: Edition[]): TodayEditions | null`;
  - `toEdition(row: EditionRow): Edition | null`;
  - `EDITION_SELECT: string`;
  - `class NeonEditionSource implements EditionSource` (`live = true`);
  - `editionIdOf(storyId: string): string`.

- [x] **Step 1: Write the failing row tests** `app/src/app/core/rows.spec.ts`:

```ts
import type { Edition } from '@first-light/contracts';
import demo from '../../../../fixtures/demo-edition.json';
import { editionIdOf, pickToday, sortStories, toEdition, type EditionRow } from './rows';

const AM = demo.am as unknown as Edition;
const PM = demo.pm as unknown as Edition;

/** What PostgREST returns for EDITION_SELECT. */
function rowOf(e: Edition): EditionRow {
  return {
    id: e.id, edition_date: e.editionDate, slot: e.slot, status: e.status, nudge: e.nudge,
    weather: e.weather, key_dates: e.keyDates, source_count: e.sourceCount, created_at: e.createdAt,
    stories: [...e.stories].reverse().map((s) => ({
      id: s.id, section: s.section, rank: s.rank, top_rank: s.topRank, title: s.title, summary: s.summary,
      why_it_matters: s.whyItMatters, picked_because: s.pickedBecause,
      story_links: s.links.map((l) => ({ source_key: l.sourceKey, url: l.url, publisher_title: l.publisherTitle, published_at: l.publishedAt })),
    })),
  };
}

describe('rows', () => {
  it('maps an edition row back to the Edition contract, stories in section then rank order', () => {
    expect(toEdition(rowOf(AM))).toEqual({ ...AM, stories: sortStories(AM.stories) });
  });

  it('drops a row without weather (a failed edition)', () => {
    expect(toEdition({ ...rowOf(AM), weather: null })).toBeNull();
  });

  it('pairs the latest day: am leads, pm follows', () => {
    expect(pickToday([PM, AM])).toEqual({ am: AM, pm: PM });
  });

  it('lets the pm edition lead when the am one is missing or failed', () => {
    expect(pickToday([PM])).toEqual({ am: PM, pm: null });
  });

  it('never pairs editions from different days', () => {
    const older = { ...PM, editionDate: '2026-10-12' };
    expect(pickToday([AM, older])).toEqual({ am: AM, pm: null });
  });

  it('returns null when there is no edition at all', () => {
    expect(pickToday([])).toBeNull();
  });

  it('derives the edition id from a story id', () => {
    expect(editionIdOf('ed-2026-10-13-am-03')).toBe('ed-2026-10-13-am');
  });
});
```

- [x] **Step 2: Run and watch them fail.**

Run: `npm test -w app -- --include src/app/core/rows.spec.ts`
Expected: FAIL, `Cannot find module './rows'`.

- [x] **Step 3: Write `app/src/app/core/rows.ts`.**

```ts
import type { Edition, KeyDate, SectionKey, Story, Weather } from '@first-light/contracts';
import { SECTIONS } from '@first-light/contracts/sections-meta';
import type { TodayEditions } from './edition-source';

export interface LinkRow { source_key: string; url: string; publisher_title: string; published_at: string }
export interface StoryRow {
  id: string; section: SectionKey; rank: number; top_rank: 1 | 2 | 3 | null; title: string; summary: string;
  why_it_matters: string; picked_because: string; story_links: LinkRow[];
}
export interface EditionRow {
  id: string; edition_date: string; slot: 'am' | 'pm'; status: Edition['status']; nudge: string | null;
  weather: Weather | null; key_dates: KeyDate[]; source_count: number; created_at: string; stories: StoryRow[];
}

const STORY_COLUMNS = 'id,section,rank,top_rank,title,summary,why_it_matters,picked_because,story_links(source_key,url,publisher_title,published_at)';
/** PostgREST select for an edition with its stories and links (FKs do the embedding). */
export const EDITION_SELECT = `id,edition_date,slot,status,nudge,weather,key_dates,source_count,created_at,stories(${STORY_COLUMNS})`;
export const STORY_SELECT = `${STORY_COLUMNS},editions!inner(edition_date,slot)`;

export function sortStories(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.rank - b.rank);
}

export function toStory(r: StoryRow): Story {
  return {
    id: r.id, section: r.section, rank: r.rank, topRank: r.top_rank, title: r.title, summary: r.summary,
    whyItMatters: r.why_it_matters, pickedBecause: r.picked_because,
    links: r.story_links.map((l) => ({ sourceKey: l.source_key, url: l.url, publisherTitle: l.publisher_title, publishedAt: l.published_at })),
  };
}

/** Null for a row the app can't show (a failed edition has no weather). */
export function toEdition(r: EditionRow): Edition | null {
  if (r.weather === null) return null;
  return {
    id: r.id, editionDate: r.edition_date, slot: r.slot, status: r.status, createdAt: r.created_at, nudge: r.nudge,
    weather: r.weather, keyDates: r.key_dates, sourceCount: r.source_count, stories: sortStories(r.stories.map(toStory)),
  };
}

/** The latest day's editions. When its am edition is missing, the pm one leads (spec §5, step 3). */
export function pickToday(editions: Edition[]): TodayEditions | null {
  const latest = editions.reduce<string | null>((d, e) => (d === null || e.editionDate > d ? e.editionDate : d), null);
  if (latest === null) return null;
  const am = editions.find((e) => e.editionDate === latest && e.slot === 'am') ?? null;
  const pm = editions.find((e) => e.editionDate === latest && e.slot === 'pm') ?? null;
  return am ? { am, pm } : { am: pm as Edition, pm: null };
}

/** Story ids are `<editionId>-NN` (spec Decisions log). */
export function editionIdOf(storyId: string): string {
  return storyId.replace(/-\d{2}$/, '');
}
```

- [x] **Step 4: Run the row tests.**

Run: `npm test -w app -- --include src/app/core/rows.spec.ts`
Expected: 7 passed. If the round-trip fails only on story order, the demo fixture isn't in section/rank order. The `sortStories` expectation already handles that, so look for a field-name typo instead.

- [x] **Step 5: Allow `today()` to return null.** In `edition-source.ts`, change `today(): Promise<TodayEditions>;` to:

```ts
  /** Null only when no edition exists yet (the first morning). */
  today(): Promise<TodayEditions | null>;
```

Then replace `today.resolver.ts`. Both `inject` calls come before the `await`, because `inject` only works synchronously:

```ts
import { inject } from '@angular/core';
import { RedirectCommand, Router, type ResolveFn } from '@angular/router';
import { EDITION_SOURCE, type TodayEditions } from '../core/edition-source';

export const todayResolver: ResolveFn<TodayEditions> = async () => {
  const source = inject(EDITION_SOURCE);
  const router = inject(Router);
  const editions = await source.today();
  return editions ?? new RedirectCommand(router.parseUrl('/waiting'));
};
```

Run `npm test -w app`: the demo specs still pass, because the demo never returns null.

- [x] **Step 6: Write the failing source tests** `app/src/app/core/neon-edition-source.spec.ts`:

```ts
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
```

Task 9 builds `OfflineStore`. For this task, create its minimal interface file now (Step 7) so the source compiles. Task 9 adds the IndexedDB body.

- [x] **Step 7: Run and watch them fail.**

Run: `npm test -w app -- --include src/app/core/neon-edition-source.spec.ts`
Expected: FAIL, `Cannot find module './neon-edition-source'`.

- [x] **Step 8: Write a stub `app/src/app/core/offline-store.ts`** (Task 9 replaces the body):

```ts
import { Injectable } from '@angular/core';

export type OfflineKey = 'today' | 'member';

/** The latest edition and the verified member id, kept on the device for offline use. */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  async get<T>(_key: OfflineKey): Promise<T | undefined> {
    return undefined;
  }
  async set(_key: OfflineKey, _value: unknown): Promise<void> {}
  async clear(): Promise<void> {}
}
```

- [x] **Step 9: Write `app/src/app/core/neon-edition-source.ts`.**

```ts
import { Injectable, inject, signal } from '@angular/core';
import type { Edition } from '@first-light/contracts';
import { sydneyDate } from '@first-light/contracts/dates';
import { DataApi, DataApiError } from './data-api';
import type { ArchiveHit, ArchiveQuery, EditionSource, TodayEditions } from './edition-source';
import { OfflineStore } from './offline-store';
import { EDITION_SELECT, STORY_SELECT, editionIdOf, pickToday, toEdition, toStory, type EditionRow, type StoryRow } from './rows';

const LIVE = 'status=in.(ok,partial)';

/** The member's real editions through the Data API (spec §6). */
@Injectable({ providedIn: 'root' })
export class NeonEditionSource implements EditionSource {
  readonly live = true;
  private readonly api = inject(DataApi);
  private readonly store = inject(OfflineStore);
  private readonly reads = signal<ReadonlySet<string>>(new Set());
  private readonly saves = signal<ReadonlySet<string>>(new Set());
  readonly readIds = this.reads.asReadonly();
  readonly savedIds = this.saves.asReadonly();
  private personal: Promise<void> | null = null;

  async today(): Promise<TodayEditions | null> {
    const personal = this.loadPersonal(); // in parallel; never rejects
    const today = sydneyDate(new Date());
    try {
      const rows = await this.api.get<EditionRow[]>(
        `/editions?select=${EDITION_SELECT}&${LIVE}&edition_date=lte.${today}&order=edition_date.desc,slot.desc&limit=2`,
      );
      const picked = pickToday(rows.map(toEdition).filter((e): e is Edition => e !== null));
      if (picked) await this.store.set('today', picked);
      await personal;
      return picked;
    } catch (e) {
      if (e instanceof DataApiError && e.status === 0) return (await this.store.get<TodayEditions>('today')) ?? null;
      throw e;
    }
  }

  async story(id: string): Promise<{ story: Edition['stories'][number]; edition: Edition } | null> {
    const rows = await this.api.get<EditionRow[]>(`/editions?select=${EDITION_SELECT}&id=eq.${encodeURIComponent(editionIdOf(id))}`);
    const edition = rows[0] ? toEdition(rows[0]) : null;
    const story = edition?.stories.find((s) => s.id === id);
    return edition && story ? { story, edition } : null;
  }

  async search(q: ArchiveQuery): Promise<ArchiveHit[]> {
    await this.loadPersonal();
    const filters: string[] = [];
    if (q.section !== 'all') filters.push(`section=eq.${q.section}`);
    if (q.text.trim()) filters.push(`search=wfts(english).${encodeURIComponent(q.text.trim())}`);
    if (q.savedOnly) {
      const ids = [...this.saves()];
      if (ids.length === 0) return [];
      filters.push(`id=in.(${ids.map(encodeURIComponent).join(',')})`);
    }
    const rows = await this.api.get<(StoryRow & { editions: { edition_date: string; slot: 'am' | 'pm' } })[]>(
      `/stories?select=${STORY_SELECT}&${filters.join('&')}&order=created_at.desc&limit=100`,
    );
    return rows.map((r) => ({ story: toStory(r), editionDate: r.editions.edition_date, slot: r.editions.slot }));
  }

  async editionDays(): Promise<{ date: string; am: boolean; pm: boolean }[]> {
    const rows = await this.api.get<{ edition_date: string; slot: 'am' | 'pm' }[]>(
      `/editions?select=edition_date,slot&${LIVE}&order=edition_date.desc&limit=800`,
    );
    const days = new Map<string, { date: string; am: boolean; pm: boolean }>();
    for (const r of rows) {
      const d = days.get(r.edition_date) ?? { date: r.edition_date, am: false, pm: false };
      d[r.slot] = true;
      days.set(r.edition_date, d);
    }
    return [...days.values()];
  }

  async markRead(id: string): Promise<void> {
    if (this.reads().has(id)) return;
    this.reads.update((s) => new Set(s).add(id));
    try {
      await this.api.post('/reads', { story_id: id });
    } catch (e) {
      if (e instanceof DataApiError && e.status === 409) return;
      this.reads.update((s) => without(s, id));
    }
  }

  async toggleSave(id: string): Promise<void> {
    const saved = this.saves().has(id);
    this.saves.update((s) => (saved ? without(s, id) : new Set(s).add(id)));
    try {
      if (saved) await this.api.delete(`/saves?story_id=eq.${encodeURIComponent(id)}`);
      else await this.api.post('/saves', { story_id: id });
    } catch (e) {
      if (!saved && e instanceof DataApiError && e.status === 409) return;
      this.saves.update((s) => (saved ? new Set(s).add(id) : without(s, id)));
      throw e;
    }
  }

  private loadPersonal(): Promise<void> {
    this.personal ??= Promise.all([
      this.api.get<{ story_id: string }[]>('/reads?select=story_id'),
      this.api.get<{ story_id: string }[]>('/saves?select=story_id'),
    ])
      .then(([r, s]) => {
        this.reads.set(new Set(r.map((x) => x.story_id)));
        this.saves.set(new Set(s.map((x) => x.story_id)));
      })
      .catch(() => {
        this.personal = null; // offline: try again next time
      });
    return this.personal;
  }
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
```

`markRead` swallows a failure after reverting, because a missed read mark is harmless. `toggleSave` rethrows so the caller can tell the user. Check that News's save button already handles a rejected `toggleSave`. If it doesn't, wrap the call in `try/catch` in `news.ts` and show nothing more than the reverted button.

- [x] **Step 10: Run all app tests and typecheck.**

Run: `npm test -w app && npm run typecheck -w app`
Expected: all pass (38 before this plan, plus the new ones). Typecheck is clean.

- [x] **Step 11: Commit**

```bash
git add app/src/app/core app/src/app/today/today.resolver.ts
git commit -m "feat(app): NeonEditionSource over the Data API"
```

### Task 8: Member routes, guard, sign-in and sign-out

**Files:**
- Create: `app/src/app/member.routes.ts`
- Create: `app/src/app/core/member-guard.ts`, `app/src/app/core/member-guard.spec.ts`
- Create: `app/src/app/waiting/waiting.ts`, `app/src/app/waiting/waiting.html`
- Modify: `app/src/app/app.routes.ts` (member routes; remove `spike`)
- Delete: `app/src/app/spike/`
- Modify: `app/src/app/signin/signin.ts`, `signin.html`
- Modify: `app/src/app/shell/more-sheet.ts`, `more-sheet.html` (Sign out when live)
- Create: `app/e2e/member.spec.ts`

**Interfaces:**
- Consumes: `Auth`, `DataApi.rpc`, `OfflineStore`, `NeonEditionSource`, `todayResolver`, `Shell`.
- Produces: `memberGuard: CanActivateFn`, `class Membership { check(): Promise<boolean> }`, routes `/today`, `/news`, `/news/:storyId`, `/archive`, `/waiting`.

- [x] **Step 1: Write the failing guard tests** `app/src/app/core/member-guard.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { Auth } from './auth';
import { DataApi } from './data-api';
import { memberGuard } from './member-guard';
import { OfflineStore } from './offline-store';

async function run(opts: { online: boolean; user: object | null; member: boolean; cachedMember?: string }) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(opts.online);
  const api = { rpc: vi.fn(async () => opts.member) };
  const store = { get: vi.fn(async () => opts.cachedMember), set: vi.fn(async () => undefined), clear: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: Auth, useValue: { session: vi.fn(async () => opts.user) } },
      { provide: DataApi, useValue: api },
      { provide: OfflineStore, useValue: store },
    ],
  });
  const result = await TestBed.runInInjectionContext(() =>
    memberGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  const router = TestBed.inject(Router);
  return { url: result instanceof UrlTree ? router.serializeUrl(result) : result, api, store };
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

  it('offline: lets a previously verified member through without a token', async () => {
    const { url, api } = await run({ online: false, user: null, member: false, cachedMember: 'u1' });
    expect(url).toBe(true);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('offline with nothing cached: /signin', async () => {
    expect((await run({ online: false, user: null, member: false })).url).toBe('/signin');
  });
});
```

- [x] **Step 2: Run and watch them fail.**

Run: `npm test -w app -- --include src/app/core/member-guard.spec.ts`
Expected: FAIL, `Cannot find module './member-guard'`.

- [x] **Step 3: Write `app/src/app/core/member-guard.ts`.**

```ts
import { Injectable, inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Auth } from './auth';
import { DataApi } from './data-api';
import { OfflineStore } from './offline-store';

/** Asks the database once per page load whether this user is on the list. */
@Injectable({ providedIn: 'root' })
export class Membership {
  private readonly api = inject(DataApi);
  private result: Promise<boolean> | null = null;

  check(): Promise<boolean> {
    this.result ??= this.api.rpc<boolean>('is_member').catch(() => {
      this.result = null;
      return false;
    });
    return this.result;
  }
}

/** Spec §6: signed out → /signin; signed in but not a member → the demo; offline → trust the device. */
export const memberGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(Auth);
  const store = inject(OfflineStore);
  const membership = inject(Membership);

  if (!navigator.onLine) return (await store.get<string>('member')) ? true : router.parseUrl('/signin');
  const user = await auth.session();
  if (!user) return router.parseUrl('/signin');
  if (!(await membership.check())) return router.parseUrl('/demo/today?private=1');
  await store.set('member', user.id);
  return true;
};
```

The guard tests stub `DataApi.rpc`, which `Membership` calls, so `Membership` itself needs no stub.

- [x] **Step 4: Run the guard tests.**

Run: `npm test -w app -- --include src/app/core/member-guard.spec.ts`
Expected: 5 passed.

- [x] **Step 5: Waiting page.** `app/src/app/waiting/waiting.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-waiting',
  templateUrl: './waiting.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Waiting {}
```

`waiting.html`:

```html
<main class="signin">
  <div class="clay signin-card">
    <h1 class="disp">Nothing to read yet.</h1>
    <p>The first edition lands at 5:32am, and the afternoon one at 4:02pm.</p>
  </div>
</main>
```

- [x] **Step 6: `app/src/app/member.routes.ts`.**

```ts
import { Routes } from '@angular/router';
import { EDITION_SOURCE } from './core/edition-source';
import { memberGuard } from './core/member-guard';
import { NeonEditionSource } from './core/neon-edition-source';
import { Shell } from './shell/shell';
import { todayResolver } from './today/today.resolver';

/** Noel's real editions. The same screens as the demo, on NeonEditionSource. */
export const MEMBER_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    canActivate: [memberGuard],
    providers: [{ provide: EDITION_SOURCE, useExisting: NeonEditionSource }],
    children: [
      { path: 'today', loadComponent: () => import('./today/today').then((m) => m.Today), resolve: { editions: todayResolver }, title: 'Today · First Light' },
      { path: 'news', loadComponent: () => import('./news/news').then((m) => m.News), resolve: { editions: todayResolver }, title: 'News · First Light' },
      { path: 'news/:storyId', loadComponent: () => import('./news/news').then((m) => m.News), resolve: { editions: todayResolver }, title: 'Story · First Light' },
      { path: 'archive', loadComponent: () => import('./archive/archive').then((m) => m.Archive), title: 'Archive · First Light' },
      { path: 'waiting', loadComponent: () => import('./waiting/waiting').then((m) => m.Waiting), title: 'First Light' },
    ],
  },
];
```

In `app.routes.ts`, delete the `spike` route and add this before `'**'`:

```ts
  { path: '', loadChildren: () => import('./member.routes').then((m) => m.MEMBER_ROUTES) },
```

Delete `app/src/app/spike/`.
- [x] **Step 7: Sign-in page.** `signin.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-signin',
  imports: [RouterLink],
  templateUrl: './signin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Signin {
  private readonly auth = inject(Auth);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    const router = inject(Router);
    void this.auth.session().then((user) => {
      if (user) void router.navigateByUrl('/today');
    });
  }

  protected async google() {
    this.busy.set(true);
    this.failed.set(false);
    try {
      await this.auth.signIn('/today');
    } catch {
      this.failed.set(true);
      this.busy.set(false);
    }
  }
}
```

`signin.html`:

```html
<main class="signin">
  <div class="clay signin-card">
    <h1 class="disp">Sign in</h1>
    <p>First Light is a private edition for one reader.</p>
    <button class="btn btn-pri" type="button" (click)="google()" [disabled]="busy()">
      {{ busy() ? 'Opening Google…' : 'Continue with Google' }}
    </button>
    @if (failed()) {
      <p role="alert">Sign-in didn't start. Check your connection and try again.</p>
    }
    <a class="btn" routerLink="/demo/today">Explore the demo edition</a>
  </div>
</main>
```

- [x] **Step 8: Sign out in the More sheet.** `MoreSheet` also renders in the demo, so it must not inject `Auth`. Injecting it would build the Neon client, and the demo would call Neon. Sign-out lives in its own file, loaded only when pressed. Create `app/src/app/core/sign-out.ts`:

```ts
import type { Injector } from '@angular/core';
import { Auth } from './auth';
import { OfflineStore } from './offline-store';

/** Spec §6: sign-out clears IndexedDB and the service worker's data caches. */
export async function signOutEverywhere(injector: Injector): Promise<void> {
  await injector.get(Auth).signOut().catch(() => undefined);
  await injector.get(OfflineStore).clear();
  if ('caches' in globalThis) {
    for (const key of await caches.keys()) if (key.includes(':data:')) await caches.delete(key);
  }
  localStorage.removeItem('firstlight.opened.v1');
}
```

`more-sheet.ts`:

```ts
import { ChangeDetectionStrategy, Component, Injector, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EDITION_SOURCE } from '../core/edition-source';
import { Prefs } from '../core/prefs';

@Component({
  selector: 'app-more-sheet',
  imports: [RouterLink],
  templateUrl: './more-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class MoreSheet {
  protected readonly prefs = inject(Prefs);
  protected readonly live = inject(EDITION_SOURCE).live;
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  readonly closed = output<void>();

  protected toggleMotion(event: Event) {
    this.prefs.reduceMotion.set((event.target as HTMLInputElement).checked);
  }

  protected async signOut() {
    const { signOutEverywhere } = await import('../core/sign-out');
    await signOutEverywhere(this.injector);
    this.closed.emit();
    await this.router.navigateByUrl('/');
  }
}
```

`more-sheet.html`, replacing the last link:

```html
  @if (live) {
    <button class="sheet-row" type="button" (click)="signOut()">Sign out</button>
  } @else {
    <a class="sheet-row" routerLink="/signin" (click)="closed.emit()">Sign in</a>
  }
```

- [x] **Step 9: e2e for the signed-out path** `app/e2e/member.spec.ts`. CI has no Google account, so it tests the redirect only:

```ts
import { expect, test } from '@playwright/test';

test('a signed-out visitor to /today is sent to sign in', async ({ page }) => {
  await page.route(/neonauth\./, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.goto('/today');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('the demo never calls Neon', async ({ page }) => {
  const neon: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('neon.tech')) neon.push(r.url());
  });
  await page.goto('/demo/today');
  await page.getByRole('link', { name: 'News', exact: true }).first().click();
  expect(neon).toEqual([]);
});
```

- [x] **Step 10: Run everything.**

Run: `npm test -w app && npm run typecheck -w app && npm run build -w app && npm run check:secrets && npm run check:csp && npm run e2e -w app`
Expected: all green. Record the initial bundle size in the ledger.

- [x] **Step 11: Make Noel a member.** After deploy: Noel signs in at `/signin`; that lands on `/demo/today?private=1`, which is correct. Then, from the Neon SQL editor or via MCP after Noel confirms his address, run runbook §1 "Bootstrap the member":

```sql
insert into private.members (user_id, email)
select id, email from neon_auth."user" where email = '<Noel's Google address>';
```

Reload `/today`: it shows `/waiting` (no edition yet). That's correct until Task 12.

- [x] **Step 12: Commit**

```bash
git add -A app/src app/e2e
git commit -m "feat(app): member routes, guard, Google sign-in and sign-out"
```

### Task 9: Offline store and `app_opens`

**Files:**
- Modify: `app/src/app/core/offline-store.ts` (IndexedDB body)
- Create: `app/src/app/core/offline-store.spec.ts`
- Create: `app/src/app/core/app-opens.ts`, `app/src/app/core/app-opens.spec.ts`
- Modify: `app/src/app/core/member-guard.ts`, `member-guard.spec.ts` (record the open on entry)
- Modify: `app/package.json` (devDependency `fake-indexeddb` for tests)

**Interfaces:**
- Produces: the real `OfflineStore` (same signature as the stub) and `class AppOpens { record(): Promise<void> }`.

- [x] **Step 1: Write the failing tests.** Install the test-only IndexedDB:

Run: `npm install -D fake-indexeddb@^6 -w app`

`app/src/app/core/offline-store.spec.ts`:

```ts
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
```

`app/src/app/core/app-opens.spec.ts`:

```ts
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
```

- [x] **Step 2: Run and watch them fail.**

Run: `npm test -w app -- --include 'src/app/core/{offline-store,app-opens}.spec.ts'`
Expected: OfflineStore FAILS (`member` reads back `undefined`); AppOpens FAILS (module missing).

- [x] **Step 3: Real `offline-store.ts`.**

```ts
import { Injectable } from '@angular/core';

export type OfflineKey = 'today' | 'member';

const DB = 'firstlight';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** The latest edition and the verified member id, kept on the device for offline use (spec §6). */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  async get<T>(key: OfflineKey): Promise<T | undefined> {
    try {
      return await run<T | undefined>('readonly', (s) => s.get(key));
    } catch {
      return undefined;
    }
  }

  async set(key: OfflineKey, value: unknown): Promise<void> {
    try {
      await run('readwrite', (s) => s.put(value, key));
    } catch {
      /* private mode or storage full: the app still works online */
    }
  }

  async clear(): Promise<void> {
    try {
      await run('readwrite', (s) => s.clear());
    } catch {
      /* nothing stored */
    }
  }
}
```

- [x] **Step 4: `app/src/app/core/app-opens.ts`.**

```ts
import { Injectable, inject } from '@angular/core';
import { sydneyDate } from '@first-light/contracts/dates';
import { DataApi } from './data-api';

const KEY = 'firstlight.opened.v1';

/** Spec §6: one app_opens row per Sydney day per device; offline opens are retried. */
@Injectable({ providedIn: 'root' })
export class AppOpens {
  private readonly api = inject(DataApi);
  private pending = false;

  async record(): Promise<void> {
    const at = new Date();
    const day = sydneyDate(at);
    if (this.pending || localStorage.getItem(KEY) === day) return;
    await this.send(day, at.toISOString());
  }

  private async send(day: string, openedAt: string): Promise<void> {
    try {
      await this.api.post('/app_opens', { opened_at: openedAt });
      localStorage.setItem(KEY, day);
      this.pending = false;
    } catch {
      this.pending = true;
      window.addEventListener('online', () => void this.send(day, openedAt), { once: true });
    }
  }
}
```

- [x] **Step 5: Record the open on entry.** In `memberGuard`, add `const opens = inject(AppOpens);` next to the other `inject` calls (they must all run before the first `await`). Then add `void opens.record();` on the line before the final `return true;`. In `member-guard.spec.ts`, add `{ provide: AppOpens, useValue: { record: vi.fn() } }` to the providers.

- [x] **Step 6: Run everything.**

Run: `npm test -w app && npm run typecheck -w app`
Expected: all pass.

- [ ] **Step 7: Offline check on the real build (Noel, after deploy).** Signed in, open `/today` and wait for it to load. Turn on airplane mode, close the app fully and reopen it from the home-screen icon. Today should render the cached edition. Record the result in the ledger.
- [x] **Step 8: Commit**

```bash
git add app/package.json package-lock.json app/src/app/core
git commit -m "feat(app): offline edition cache and daily app_opens"
```

### Task 10: Afternoon poll and the afternoon greeting

Spec §6: `rxResource` polls for the pm edition every 10 minutes after 4:02pm. This task also fixes the deferred minor where Today always says "Good morning." and "Next edition 4:02pm".

**Files:**
- Modify: `contracts/src/dates.ts`, `contracts/src/dates.spec.ts` (`sydneyMinutes`)
- Modify: `app/src/app/today/today.ts`, `today.html`
- Modify: `app/src/app/today/today.spec.ts`, `app/e2e/demo.spec.ts`, `app/e2e/pwa.spec.ts`

**Interfaces:**
- Produces: `sydneyMinutes(at: Date): number`, minutes since Sydney midnight.

- [x] **Step 1: Failing contract test.** Append to `contracts/src/dates.spec.ts`:

```ts
describe('sydneyMinutes', () => {
  it('counts minutes since midnight in Sydney, across the UTC date line', () => {
    expect(sydneyMinutes(new Date('2026-10-13T05:02:00Z'))).toBe(16 * 60 + 2); // 4:02pm AEDT
    expect(sydneyMinutes(new Date('2026-10-13T13:30:00Z'))).toBe(30); // 00:30 next day
  });
});
```

Add `sydneyMinutes` to that file's import from `./dates`.

Run: `npm test -w contracts`
Expected: FAIL, `sydneyMinutes is not a function`.

- [x] **Step 2: Implement** in `contracts/src/dates.ts`:

```ts
/** Minutes since midnight in Sydney, for comparing against edition times. */
export function sydneyMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return get('hour') * 60 + get('minute');
}
```

Run: `npm test -w contracts`
Expected: PASS.

- [x] **Step 3: Failing Today tests.** In `app/src/app/today/today.spec.ts`, the first test renders `{ am, pm }` and expects `'Good morning'`. Change that expectation to `'Good afternoon'`: the pm edition is showing. Then add, using the file's `render` helper:

```ts
  it('greets the afternoon once the pm edition is showing', async () => {
    const { el } = await render({ am, pm });
    expect(el.querySelector('h1')!.textContent).toContain('Good afternoon.');
    expect(el.textContent).toContain('Next edition 5:32am');
  });

  it('greets the morning before the pm edition lands', async () => {
    const { el } = await render({ am, pm: null });
    expect(el.querySelector('h1')!.textContent).toContain('Good morning.');
    expect(el.textContent).toContain('Next edition 4:02pm');
  });
```

Run `npm test -w app -- --include src/app/today/today.spec.ts`. Expected: the two afternoon expectations FAIL.

- [x] **Step 4: Implement in `today.ts`.** Add imports `rxResource` (from `@angular/core/rxjs-interop`), `timer`, `filter`, `switchMap`, `from`, `map`, `takeWhile` (from `rxjs`) and `sydneyMinutes`. Then:

Add this module constant above the class: `const PM_AT = 16 * 60 + 2; // 4:02pm`. Then in the class:

```ts
  /** Spec §6: while open after 4:02pm with no pm edition, look for it every 10 minutes. */
  private readonly pmPoll = rxResource({
    params: () => (this.source.live && this.editions().pm === null ? this.editions().am.editionDate : undefined),
    stream: ({ params: date }) =>
      timer(0, 10 * 60_000).pipe(
        filter(() => sydneyMinutes(new Date()) >= PM_AT),
        switchMap(() => from(this.source.today())),
        map((t) => (t && t.am.editionDate === date ? t.pm : null)),
        takeWhile((pm) => pm === null, true),
      ),
  });
```

Then change `pm` and add the greeting:

```ts
  protected readonly pm = computed(() => this.editions().pm ?? (this.pmPoll.hasValue() ? this.pmPoll.value() : null));
  protected readonly greeting = computed(() => (this.pm() ? 'Good afternoon.' : 'Good morning.'));
  protected readonly nextEdition = computed(() => (this.pm() ? '5:32am' : '4:02pm'));
```

In `today.html` line 34, use `<h1 class="disp">{{ greeting() }}</h1>`. On line 99, replace `Next edition 4:02pm` with `Next edition {{ nextEdition() }}`.

The demo has `live = false`, so `params` is `undefined` and it never polls. The existing demo e2e still expects "Good morning.", but the demo shows a pm edition. **Update `app/e2e/demo.spec.ts` line 9 and `app/e2e/pwa.spec.ts` line 16 to expect `Good afternoon.`.** That is the deferred minor being fixed, not a regression.

- [x] **Step 5: Run everything.**

Run: `npm test --workspaces --if-present && npm run typecheck && npm run build -w app && npm run e2e -w app`
Expected: all green.

- [x] **Step 6: Commit**

```bash
git add contracts/src/dates.ts contracts/src/dates.spec.ts app/src/app/today app/e2e/demo.spec.ts app/e2e/pwa.spec.ts
git commit -m "feat(app): afternoon poll and afternoon greeting"
```

---

## Phase D — Go live

### Task 11: Open-Meteo timeout (before the routine depends on it)

A deferred minor from the v1-offline review. A hung Open-Meteo request stalls the routine for minutes before `fail` runs, and the watchdog only notices at 6:17am.

**Files:**
- Modify: `pipeline/src/fetch/weather.ts` (`fetchWeather` and `place` take `timeoutMs`)
- Modify: `pipeline/src/fetch/weather.spec.ts`

- [ ] **Step 1: Failing test.** Append inside the `describe` in `weather.spec.ts`:

```ts
  it('gives up on a hung Open-Meteo request with a short error', async () => {
    const hang = vi.fn(
      (_: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
    );
    await expect(fetchWeather(hang as unknown as typeof fetch, normals, '2026-10-13', 20)).rejects.toThrow('weather: timeout after 20ms');
  });
```

Run: `npm test -w pipeline -- weather`
Expected: FAIL (the test times out or hangs: there's no timeout yet).

- [ ] **Step 2: Implement.** In `weather.ts`, give `place` a final parameter `timeoutMs: number`. Replace its fetch line (line 66) with:

```ts
  let response: Response;
  try {
    response = await fetchImpl(forecastUrl(latitude, longitude, editionDate), { signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new Error(`weather: timeout after ${timeoutMs}ms`);
    throw e;
  }
```

Give `fetchWeather` a fourth parameter `timeoutMs = 10_000` and pass it to both `place` calls.

- [ ] **Step 3: Run the pipeline tests.**

Run: `npm test -w pipeline && npm run typecheck -w pipeline`
Expected: all pass (79 + 1).

- [ ] **Step 4: Commit** and mark the minor fixed in the v1-offline ledger.

```bash
git add pipeline/src/fetch/weather.ts pipeline/src/fetch/weather.spec.ts .superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md
git commit -m "fix(pipeline): time out a hung Open-Meteo request"
```

### Task 12: GitHub secrets, the routine, first live edition

**Files:**
- Modify: `docs/runbook.md` (done markers), `README.md` (status line, if it says "offline")

- [ ] **Step 1 (Noel): Gmail.** Turn on 2-Step Verification on the sending account and create an app password.
- [ ] **Step 2 (Noel): GitHub secrets.** Set the five secrets from runbook §3 (`WATCHDOG_DATABASE_URL` is the `watchdog_reader` string). Turn on branch protection for `main`: require the `build` and `db` checks.
- [ ] **Step 3: Verify the workflows can read (agent).** With no edition yet, run `gh workflow run watchdog.yml`, then `gh run watch` on that run. Expected: the run succeeds, the log says `sent` (the edition is missing), and Noel receives the email. The log must not contain a headline, query result or error text. Read it with `gh run view --log` and grep for `ed-` and `@`.
- [ ] **Step 4 (Noel): Routine environment and routine.** Follow runbook §2 exactly: the "First Light" environment, custom network list plus the Neon endpoint host `ep-round-morning-a71pawwz.ap-southeast-2.aws.neon.tech`, `DATABASE_URL` = the `pipeline_writer` string, `NODE_USE_ENV_PROXY=1`, and the setup script. Prompt: `docs/routine-prompt.md` below the line, with the private reader profile pasted in. Model Sonnet, no connectors, no API trigger. **Don't schedule yet.**
- [ ] **Step 5 (Noel): Feeds check.** Start a session in the environment and run `npm run pipeline:feeds-check`. For each `failed` line that isn't a temporary outage, the agent sets `active: false` on that source in `pipeline/src/sources.ts` and commits it (`fix(pipeline): disable feeds blocked from the cloud`). Add any reported redirect host to the environment's network list.
- [ ] **Step 6 (Noel): First run.** On the routine page, press **Run now**. Expected: the run ends with `ok: wrote ed-<today>-<slot>`. The agent verifies through MCP: `select id, status, source_count from editions` (1 row, `ok` or `partial`) and `select section, count(*) from stories group by 1`. Then Noel opens `https://firstlight.noel-sebastian.com/today`: the edition shows, and a story's link opens the publisher.
- [ ] **Step 7 (Noel): Schedule.** Set the routine to 5:32am and 4:02pm, Australia/Sydney, and read back the next two run times.
- [ ] **Step 8: Reminder check (next morning, agent).** By 8:05am Sydney, `gh run list --workflow reminder.yml -L 1` shows success. The log says `sent` if Noel hadn't opened the app, or `skipped` if he had. Either is a pass if it matches what he did.
- [ ] **Step 9: Commit** the runbook done markers.

```bash
git add docs/runbook.md README.md pipeline/src/sources.ts
git commit -m "docs: routine live, first edition written"
```

### Task 13: Close out

- [ ] **Step 1 (Noel): Turn off "Allow localhost"** in Neon Auth (spec §7). Agent: confirm `allow_localhost: false` with `get_neon_auth_config`.
- [ ] **Step 2 (Noel): GitGuardian incident 38146939:** mark it as a false positive (the throwaway CI password in `f225a08`).
- [ ] **Step 3: Housekeeping (agent, ask first).** Delete the remote branch `feat/v1-offline` (`git push origin --delete feat/v1-offline`) and stop the `fl-pg18` container if Noel doesn't want it running.
- [ ] **Step 4: Lighthouse on live Today (spec §1 success criteria).** Run Chrome DevTools Lighthouse, mobile, signed in. Accessibility ≥ 90 and Performance ≥ 90. Record the scores in the ledger. If either is below 90, open a follow-up task in the plan; don't fix it inline.
- [ ] **Step 5: Whole-branch review.** Dispatch a fresh reviewer over everything since `87e29e6`. Fix Critical and Important findings and log Minor ones in the ledger.
- [ ] **Step 6: Update the Status tables** here and in the spec, update the `AGENTS.md` Status section ("live since <date>"), and run `/session-handoff`.

---

**Not in this plan:**
- v1.1 archive compaction (before Oct 2027).
- The remaining v1-offline minors: stale files in `pipeline/out`; `fail` printing `ok` on a guarded no-op; the cascade check run as superuser.
- Phase 2 Plan desk and Phase 3 Inbox.
