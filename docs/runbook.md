# Runbook

Setting up and running First Light's accounts. The design spec (§4, §5, §7) says why;
this file says how. Nothing here costs money: every service stays on its free tier.

## 1. Neon

1. Create a project on **Postgres 18**, region **AWS Sydney** (`ap-southeast-2`;
   Singapore if the Data API isn't offered in Sydney). Set max compute to **0.25 CU**.
2. Apply `db/migrations/*.sql` in number order, as the project owner (`neondb_owner`), from
   the Neon SQL editor. An applied migration is never edited; fixes go in a new file.
3. The migration creates the roles `pipeline_writer` and `watchdog_reader` without login.
   Give each a long generated password (keep them in your password manager):

   ```sql
   alter role pipeline_writer with login password '<generated>';
   alter role watchdog_reader with login password '<generated>';
   ```

   Their connection strings are the owner's string from the Neon console with the role
   and password swapped:
   `postgresql://pipeline_writer:<password>@<endpoint-host>/neondb?sslmode=require`.
   The pipeline uses it over HTTPS (`@neondatabase/serverless`), so no port needs opening.
4. **Neon Auth:** enable it with **Google only**. Turn email/password sign-in off *before*
   anyone signs in. Use your own Google OAuth client, left in *Testing* status with
   yourself as the only test user. Trusted domains: `firstlight.noel-sebastian.com` and
   localhost; turn "Allow localhost" off once development is done.
5. **Data API:** enable it. It serves `public` only; `private.members` stays unreachable.

### Bootstrap the member

Sign in to the app once with Google, then run this in the Neon SQL editor:

```sql
insert into private.members (user_id, email)
select id, email from neon_auth.user where email = '<your Google address>';
```

Signing in grants nothing by itself; this row is what makes you a member.

## 2. Routine

Create one Claude Code routine on the subscription.

- **Prompt:** everything below the line in `docs/routine-prompt.md`, with the reader
  profile pasted in place of the placeholder.
- **Schedule:** daily at 5:32am and 4:02pm, time zone Australia/Sydney. After the
  daylight-saving change on 4 April 2027, check the next run times still read 5:32am and
  4:02pm.
- **Model:** Sonnet.
- **Connectors:** none. **API trigger:** none.
- **Environment:** a dedicated one named "First Light":
  - Network access *Custom*: the default package-manager list, plus
    `www.rba.gov.au`, `www.abc.net.au`, `theconversation.com`, `www.sbs.com.au`,
    `cprss.s3.amazonaws.com`, `blog.angular.dev`, `developer.chrome.com`,
    `www.seroundtable.com`, `hnrss.org`, `news.smol.ai`, `simonwillison.net`,
    `www.techmeme.com`, `www.itnews.com.au`, `www.startupdaily.net`,
    `api.open-meteo.com` and the Neon endpoint host. Add any redirect target that
    `feeds-check` reports as blocked.
  - Environment variables: `NODE_USE_ENV_PROXY=1` and `DATABASE_URL` (the
    `pipeline_writer` string). Your own sessions can read these, which is why
    `pipeline_writer` can only touch content tables.
  - Setup script: `npm ci -w pipeline -w contracts --ignore-scripts`.

**Week one:** start a session in the environment and run `npm run pipeline:feeds-check`.
For every `failed` line that isn't a temporary outage, set `active: false` on that source
in `pipeline/src/sources.ts` and commit.

**Locally:** `npm run pipeline -- demo-run` runs fetch and validate against the fixtures
with no network and no database. Output lands in `pipeline/out/` (git-ignored).

## 3. GitHub

Repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `WATCHDOG_DATABASE_URL` | the `watchdog_reader` connection string |
| `GMAIL_USER` | the Gmail address that sends the emails |
| `GMAIL_APP_PASSWORD` | a Gmail app password (needs 2-Step Verification on that account) |
| `MAIL_TO` | where the emails go |
| `APP_URL` | `https://firstlight.noel-sebastian.com` |

Turn on branch protection for `main`. Workflows print only `ok`, `sent` or `skipped`;
never add a step that echoes a query result or an error.

## 4. Recovering a missed edition

The watchdog emails at 6:17am and 4:47pm when an edition is missing or `failed`, with the
recorded error.

1. Read the error. `fetch: …` usually means a network or Open-Meteo problem; `validate: …`
   means Claude couldn't produce a valid edition in three tries; `write: …` means the
   database refused it.
2. Open the routines page and press **Run now** on the First Light routine. The slot
   comes from the Sydney clock: before noon it writes the morning edition; after noon it
   writes the afternoon one, which becomes a full edition when the morning one is missing
   or failed.
3. A rerun replaces a `failed` or `partial` edition. It never replaces an `ok` one (it
   prints `skipped:`). To replace an `ok` edition on purpose, run the steps from a laptop
   with `DATABASE_URL` set, finishing with `npm run pipeline -- write --force`.
4. A failed rerun never overwrites an `ok` or `partial` edition; it only updates the
   error on one that is already `failed`.
