# First Light — design spec

**Date:** 10 October 2026 (revised the same day after an independent review)
**Owner:** Noel Sebastian
**Status:** Approved
**Mockups:** "First Light mockups" canvas (landing, Today, News, Archive, mobile, phase 2–3, typefaces)

---

## 1. What this is

First Light is a personal morning-briefing web app. Twice a day a scheduled Claude run reads about fifteen to twenty-five sources, picks what matters to Noel, and publishes an *edition*: weather for Katoomba and Sydney, a one-line nudge, the three things to know, and up to four stories in each of six sections. Noel reads it on his phone on the train or on the desktop.

It has two jobs, and both must succeed:

1. **Daily tool.** Something Noel opens every morning because it is faster and better than scrolling news sites.
2. **Portfolio piece.** A public, well-engineered Angular 22 project with a distinctive claymorphism design that shows senior frontend, design and AI-integration skill.

### Success criteria

- The morning edition is ready by 6:00am and the afternoon edition by 4:30pm Sydney time on at least 95% of days, and Noel is emailed whenever one is missing or failed.
- Every story links to a real publisher article; no link is ever written by the model.
- The public site shows a complete, clickable demo without exposing any personal data or any way to run the AI.
- Running cost is **$0** beyond Noel's existing Claude subscription.
- Lighthouse accessibility and performance ≥ 90 on Today; installable per Chrome's criteria; Playwright asserts the manifest, service-worker registration and an offline reload. (Lighthouse 12 removed its PWA category.)

### Out of scope for version 1

Plan (Daybook tasks), Inbox (email catch-up), push notifications, dark mode, multiple users, editing sources from the UI, archive compaction (see §4).

---

## 2. Decisions log

| Topic | Decision |
|---|---|
| Name and address | First Light, `firstlight.noel-sebastian.com` |
| Users | Noel only, but data is stored per user so others could be added later |
| Front end | Angular 22, standalone, zoneless, signals-first, installable PWA, hosted on Vercel Hobby (non-commercial) |
| Design | Full claymorphism; Google Sans Flex (rounded axis on headings) with JetBrains Mono for labels |
| Database and auth | Neon free plan: Postgres, Neon Auth (Google only), Data API with row-level security |
| AI | A Claude Code **routine** on Noel's subscription (no API bill), at 5:32am and 4:02pm Sydney |
| Non-AI automation | GitHub Actions in a **public** repo: CI, missed-run watchdog, 8am reminder email, keepalive |
| Sections | AU economy, AU politics, World, Web dev (includes search/SEO), AI, AU tech market; max 4 stories each |
| Afternoon edition | Only new items since the morning, shown at the top of each section with a "New since <am time>" badge |
| Weather | Open-Meteo forecast; Katoomba and Sydney CBD always shown; today's range against a committed 1991–2020 monthly normal |
| Nudge | One short AI line in the morning edition, written from the edition, weather and key dates; no generic motivation |
| Read and saved state | Synced across devices through the database |
| Emails | No "edition ready" alert. Email on a missing or failed edition. Reminder email at 8am every day if the app hasn't been opened |
| Archive | Full stories kept; once data is older than 12 months, compact to a headline index except saved stories (implemented in v1.1, before Oct 2027) |
| Demo | Hand-written sample edition in the repo, used by the public landing page and demo screens |
| Credit | "Edited by Claude" in small print only (landing footer, Today fine print) |
| Cost | $0 beyond the existing Claude subscription |
| Runtime | Node 24 (Angular CLI 22.2 needs ≥ 24.15) and npm 11 (npm 10.9 crashes resolving Vitest peers) |
| Database | Neon project on Postgres 18, region AWS Sydney (Singapore if the Data API isn't offered there); CI tests against `postgres:18` |
| Candidates | Feed items older than 72 hours are dropped before Claude sees them |
| Afternoon edition | Never carries a nudge or Top 3, even when it runs as a full edition because the morning one is missing |
| Browser bundle | No Zod in the app; the demo area is lazy-loaded; CI fails on secret-like strings in `app/dist` |
| Model text | Limits: title 120, summary 400, why it matters 220, picked because 160, nudge 200 characters. Rejected if empty, if it contains `<` (treated as HTML) or a URL (`http(s)://` or `www.<host>`) |
| Story IDs | `<editionId>-NN`, numbered in the order the model returned the stories (e.g. `ed-2026-10-13-am-01`) |
| Edition IDs | `ed-<date>-<slot>`; the routine picks the slot from the Sydney clock (before noon `am`), so **Run now** after noon writes the pm edition |
| Writing | One transaction: clear old stories for that date and slot, upsert the edition, insert stories and links. An `ok` edition is left alone (`skipped`, exit 0) unless `--force` |
| Failing | `fail` creates or updates only a `failed` row; it never overwrites an `ok` or `partial` edition. A weather fetch failure fails the run (the edition schema needs weather) |
| CSP and critical CSS | Angular's critical-CSS inlining is off: its loader is an inline script the CSP blocks, which would leave the page unstyled. CI fails if `index.html` carries inline script (`npm run check:csp`) |
| Reads and saves on replace | Replacing a `partial` or `failed` edition, or forcing over an `ok` one, deletes its stories, and their reads and saves go with them (cascade). Accepted for v1: reruns happen around 5:30am and 4pm, before Noel is usually reading. If a save is ever actually lost, carry saves across by article URL |
| Keepalive | A monthly workflow re-enables the scheduled workflows with `gh workflow enable` (no commits). The third-party keepalive action has been disabled by GitHub |
| Auth transport | Neon Auth goes through a small same-origin Vercel Function at `/auth/*` that forwards to Neon Auth (no secrets, auth traffic only); the browser still reads the Data API directly with the JWT. Direct is out: Safari blocks Neon's cookie as third-party (session lost on reload, `/token` fails). A `vercel.json` rewrite is out: Vercel adds `X-Forwarded-Host` and Neon answers `400 INVALID_HOSTNAME`. Chosen 2026-10-13. Built as `api/auth.ts` (header rules copied from Neon's own server proxy); spike passed 2026-10-14 on desktop Chrome, macOS Safari, iPhone Safari and the home-screen app |
| Function region | `vercel.json` `regions: ["syd1"]`: the `/auth` proxy runs in Sydney next to Neon (the default `iad1` added a trans-Pacific round trip to every auth call). Hobby allows one region. Chosen 2026-10-14 |
| Data API token errors | Neon's Data API answers an expired JWT with `400 "JWT token has expired"` after ~60 s of leeway, a malformed or missing one with `400`; never `401`. `DataApi` retries once, with a fresh token, on `401` or a `400` whose message names the JWT; other `400`s are not retried. Offline (or the token request can't reach Neon Auth) is status `0`, so callers fall back to the device's copy. Measured 2026-10-14 |

---

## 3. Architecture

```
 5:32am / 4:02pm  Claude Code routine (Noel's subscription, Anthropic cloud, no connectors)
                  └─ clones the repo, runs npm scripts in pipeline/
                     fetch → prepare → Claude edits → validate → write (HTTPS to Neon)
                                                      │
                                                      ▼
                                       Neon Postgres (free plan)
                                       Neon Auth (Google only), Data API, RLS
                                                      │
                                                      ▼
            Angular 22 PWA on Vercel  ──  firstlight.noel-sebastian.com
            Public: landing + demo (fixture data, never touches the database)
            Signed in: Today · News · Archive

 GitHub Actions (public repo, free)
 ├─ on push / PR: lint, type-check, Vitest, Playwright, pipeline snapshot tests, RLS tests (Postgres service container)
 ├─ 6:17am and 4:47pm: watchdog → email if the edition is missing or failed (includes the recorded error)
 ├─ 7:57am daily: reminder → email the nudge and Top 3 titles if the app hasn't been opened today
 └─ monthly: keepalive (API mode, no commits)
```

**Rules that hold everywhere**

- Only the pipeline writes editions and stories, through its own database role.
- The browser holds no secrets. It reads through the Data API with the signed-in user's token; row-level security decides what it sees.
- The demo is a separate data source compiled into the app. It cannot reach the database.
- Model output is rendered as plain text only — never through `innerHTML`.
- Each *desk* (Weather, News; later Plan, Inbox) lives in its own folder with a fetch step, an optional Claude step, a schema, a view and demo data. Adding a desk never changes the core.

### Repository layout (npm workspaces)

```
first-light/
├─ app/                 Angular 22 PWA
├─ pipeline/            Node 24 + TypeScript (run with tsx): fetch, prepare, validate, write, fail, watchdog, reminder
│  ├─ sources.ts        the feed list (code, not a table)
│  ├─ key-dates.yaml    hand-maintained each quarter from the RBA and ABS calendars
│  └─ weather-normals.json   1991–2020 monthly normals, computed once
├─ contracts/           Zod schemas + TypeScript types shared by app and pipeline (Edition, Story, Weather…)
├─ db/                  SQL migrations, RLS policies, RLS tests
├─ fixtures/            demo edition JSON + synthetic feed snapshots for tests
├─ .github/workflows/   ci.yml, watchdog.yml, reminder.yml, keepalive.yml
└─ docs/                this spec, plans, routine prompt template, runbook, session log
```

---

## 4. Data model (Neon Postgres)

All `user_id` columns are `text`, matching `auth.user_id()` (the JWT `sub`).

### Content (written only by `pipeline_writer`)

| Table | Key columns |
|---|---|
| `editions` | `id`, `edition_date` (date, Sydney), `slot` (`am`/`pm`), `status` (`ok`/`partial`/`failed`), `error` (text, null), `nudge` (null for pm), `weather` (jsonb, null on a `failed` row), `key_dates` (jsonb), `source_count`, `created_at` — unique on (`edition_date`, `slot`) |
| `stories` | `id`, `edition_id`, `section` (enum of six), `rank`, `top_rank` (smallint 1–3, null if not in the Top 3), `title`, `summary`, `why_it_matters`, `picked_because`, `search` (generated tsvector over title + summary), `created_at` |
| `story_links` | `story_id`, `source_key`, `url` (normalised), `publisher_title`, `published_at` — URLs come from fetched feed items only |

Sources and key dates live in the repo (`pipeline/sources.ts`, `pipeline/key-dates.yaml`), not in tables. The edition stores the key dates it displayed in its `key_dates` column so the app needs no extra query.

### Personal

| Table | Key columns |
|---|---|
| `private.members` | `user_id`, `email` (a label only), `added_at` — in a `private` schema the Data API does not expose |
| `reads` | `user_id`, `story_id`, `read_at` |
| `saves` | `user_id`, `story_id`, `saved_at` |
| `app_opens` | `user_id`, `opened_at` |

### Access control

- `public.is_member()` is a `SECURITY DEFINER` function returning `exists(select 1 from private.members where user_id = auth.user_id())`. Policies call `(select public.is_member())`.
- **`authenticated` (the Data API role):** `SELECT` on content tables when a member. `SELECT/INSERT/DELETE` on `reads`, `saves`, `app_opens` only where `user_id = auth.user_id()` and a member. `INSERT/UPDATE/DELETE` on content tables explicitly revoked. No access to `private`.
- **`anonymous`:** nothing.
- **`pipeline_writer`:** `SELECT/INSERT/UPDATE` on content tables, plus `DELETE` on `stories` and `story_links` (replacing a failed or partial edition clears its old stories), with policies for that role; no `DELETE` on `editions`; nothing on personal tables. `reads.story_id` and `saves.story_id` cascade on delete.
- **`watchdog_reader`:** `SELECT` on `editions`, `stories`, `app_opens`.
- Any view uses `security_invoker = true`.
- **Bootstrap (runbook):** Noel signs in once; then, from the Neon console, `insert into private.members(user_id, email) select id, email from neon_auth.user where email = '<Noel>'`.
- A signed-in non-member sees nothing and is sent to `/demo/today?private=1`, which explains that this is a private edition.

### Retention

Storage is small (≈ 20–25 MB a year against 0.5 GB), so v1 keeps everything. Before October 2027, v1.1 adds monthly compaction: stories older than 12 months that nobody saved lose `summary`, `why_it_matters` and `picked_because`; title, section, date and links stay forever.

---

## 5. Pipeline

TypeScript in `pipeline/`, run by the routine with plain npm scripts so it also runs on a laptop.

| Step | Who | What |
|---|---|---|
| 1. Fetch | Code | Pull the feeds in `sources.ts` in parallel with per-feed timeouts (Node `fetch` with `NODE_USE_ENV_PROXY=1` in the cloud); Open-Meteo forecast for Katoomba and Sydney; load `key-dates.yaml` (warn if nothing in the next 30 days) and `weather-normals.json`. Every article gets a short ID. |
| 2. Prepare | Code | Normalise URLs; drop duplicates by URL and near-identical titles; drop candidates whose normalised URL appears in `story_links` for editions in the last 48 hours; cap at 25 candidates per section. **pm:** keep only items with `published_at` ≥ the am edition's `created_at` minus 15 minutes and not already in today's am links; include today's am story titles as context. Write `out/candidates.json`. |
| 3. Edit | Claude (the routine session itself) | Read `out/candidates.json` and the editorial brief; write `out/edition.json`: up to 4 stories per section, each with title, summary, why it matters, why it was picked, and the article IDs it rests on. **am:** also the Top 3 and the nudge. **pm:** no Top 3, no nudge; may write an "Update:" story citing new IDs. If today's am edition is missing or failed, pm runs as a full edition. |
| 4. Validate | Code | Zod schema; every cited ID exists in candidates; ≤ 4 per section; Top 3 refer to stories in the edition; length limits; no URLs or HTML in model text. Links are attached from the cited IDs. On failure Claude gets the error list and retries, at most twice. |
| 5. Write | Code | `@neondatabase/serverless` over HTTPS, one `sql.transaction([...])`. Upsert: replaces an existing row for the same date and slot whose status is `failed` or `partial`; refuses to overwrite `ok` unless `--force`. |
| 6. Fail | Code | On a final failure the routine runs `npm run pipeline:fail -- "<step>: <error>"`, which upserts the edition row with `status = 'failed'` and `error`. The watchdog emails the error. |

**Editorial rules for step 3** (template in `docs/routine-prompt.md`; Noel's personal reader profile stays in the routine's private saved prompt, not the public repo): prefer primary sources (RBA, ABS, Treasury) and Australian outlets for Australian stories; summaries and "why it matters" may state only what the candidate's title and snippet support — when unsure, say less; separate fact from opinion; note disagreement between sources; Claude's own words, no quoted article text beyond a short phrase; skip a section with no material story rather than padding; the nudge must reference something real in today's edition, weather or dates.

**Routine setup**

- Schedule: daily at 5:32am and 4:02pm, Australia/Sydney (confirm the stored schedule keeps the time zone across daylight-saving changes; next change 4 April 2027).
- Model: Sonnet, to save subscription usage.
- **No connectors and no API trigger.** The repo is reached through the standard GitHub access.
- A dedicated "First Light" environment:
  - Network access *Custom*: every feed host and its redirect targets, `api.open-meteo.com`, the Neon endpoint host, plus the default package-manager list.
  - Environment variables: `NODE_USE_ENV_PROXY=1`, `DATABASE_URL` (the `pipeline_writer` connection string, used over HTTPS). Environment variables are visible to Noel's sessions, so `pipeline_writer` holds only the minimal grants above.
  - Setup script: `npm ci -w pipeline -w contracts --ignore-scripts` (no Angular, Playwright or browser downloads).
- Week one: run `npm run pipeline:feeds-check` from a routine session and mark any feed that blocks cloud requests as inactive.

**Initial sources (about 20):** RBA media releases and speeches; ABC Business, Politics, World and Top Stories; SBS Australia and World; The Conversation (Business, Politics); iTnews; Startup Daily; JavaScript Weekly; Frontend Focus; Angular Blog; Chrome for Developers; Search Engine Roundtable; Hacker News front page (≥ 150 points); smol.ai AI News; Simon Willison; Techmeme. (Reuters via Google News is excluded: its links are redirects that need JavaScript to resolve.)

---

## 6. Front end

### Routes

| Route | Access | Notes |
|---|---|---|
| `/` | Public | Landing: hero, Morning Machine animation, security notes, "Built with", credit |
| `/demo/today`, `/demo/news`, `/demo/news/:storyId`, `/demo/archive` | Public | The real screens on the demo edition; reads and saves held in memory |
| `/signin` | Public | Google sign-in through Neon Auth |
| `/today`, `/news`, `/news/:storyId`, `/archive` | Members | Signed out → `/signin`; signed-in non-member → `/demo/today?private=1` |

### Offline

The latest edition is kept in IndexedDB as well as the service-worker cache. While `navigator.onLine === false` and a cached edition exists, the guard lets a previously verified member through without refreshing the token. Sign-out clears IndexedDB and the service worker's data caches.

### `app_opens`

On start-up, a signed-in member inserts one `app_opens` row per Sydney day per device (the last date is remembered in `localStorage`); offline inserts are queued and retried.

### How the Angular features earn their place

- **DI for data sources:** an `EDITION_SOURCE` token with `DemoEditionSource` (fixtures) and `NeonEditionSource` (Data API). The same components run the demo and the real app.
- **Route resolvers:** load the edition before Today and News render.
- **`httpResource`:** live weather refresh between editions.
- **`rxResource`:** polls for the afternoon edition every 10 minutes after 4:02pm while the app is open.
- **Signals, `computed`, `linkedSignal`:** section filters, read/unread counts, selected story.
- **Signal Forms:** archive search and filters, and on-device preferences (reduce motion, reading density).
- **`@defer`:** the Morning Machine and sky illustrations load after first paint.
- **Service worker** (`@angular/pwa`): app shell and latest edition offline.

### Today screen

Morning: weather, nudge, Top 3, key dates, section overview. After 4:02pm the am Top 3 and nudge stay; pm stories appear at the top of their sections in News with a "New since <am created_at>" badge (time formatted from data, never hard-coded).

### Navigation

- Desktop: a collapsible side drawer (icons only when collapsed).
- Mobile: a bottom bar of at most five slots — Today, News, Archive, More in v1 (Inbox joins in phase 3). The More sheet holds Preferences, About and Sign out.

### Design system

- Tokens as CSS custom properties: ground `#E9EEF5`, clay surface `#F5F8FC`, ink `#0E1A2B`, secondary ink `#44546A`, primary `#3E6FA3`, sun `#E8833A`, and six pastel section colours.
- Surface recipes: raised clay, pressed (inputs, wells) and pill. Long lists use a lighter shadow.
- Text near-black on light surfaces (WCAG AA); colour lives in fills.
- Motion respects `prefers-reduced-motion` and the in-app "reduce motion" preference.
- Light mode only in v1. "Weather data by Open-Meteo.com" attribution on weather surfaces.

### Morning Machine (landing)

Sun rises over clay hills → six source pods light up → messy story cards tumble into an AI core → the core "thinks" → cards leave one by one on a conveyor, sorted by section, into the edition's slots → weather tile pops in → "Morning edition ready". CSS keyframes and custom properties; paused off-screen; static final frame for reduced motion.

---

## 7. Security, privacy and operations

- **No AI endpoint exists.** The AI only runs inside the routine, which has no connectors and no API trigger. The browser bundle contains no keys; CI fails if a secret-like string appears in `app/dist`.
- **Auth:** Google only; email/password disabled in Neon Auth before the first sign-in. Noel's own Google OAuth client, left in *Testing* status with Noel as the only test user, so strangers cannot complete sign-in. Trusted domains: production and localhost; "Allow localhost" turned off after development. Membership, not sign-in, grants access.
- **Headers:** a Content-Security-Policy and standard security headers in `vercel.json`.
- **Secrets:** routine environment (`DATABASE_URL` for `pipeline_writer`); GitHub Actions secrets `WATCHDOG_DATABASE_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TO`. Nothing in the repo; `.env.example` lists the names.
- **Public logs:** workflows never print query results, headlines, open times or raw errors; they log only `ok`, `sent` or `skipped`. No `pull_request_target`. Branch protection on `main`.
- **Emails** (GitHub Actions, Gmail SMTP with an app password via nodemailer; requires 2-Step Verification on the Google account):
  - *Missing or failed edition* at 6:17am and 4:47pm: which edition, its status and recorded error, and a link to the routines page.
  - *Reminder* at 7:57am daily: sent if today's am edition is `ok` or `partial` and there is no `app_opens` row where `(opened_at at time zone 'Australia/Sydney')::date` is today. Body: the nudge line, the Top 3 titles and a link to `/today`. No story text.
- **Keepalive:** a monthly workflow keeps scheduled workflows from being disabled after 60 quiet days by re-enabling them through the API (`gh workflow enable`; no commits, so no extra Vercel deploys).
- **Copyright:** short summaries in Claude's words, always linked to the publisher; no full text stored; paywalls never bypassed. Test fixtures use synthetic feed items. The public demo uses hand-written sample content.
- **Privacy:** the public repo holds no personal reader profile; the "AU tech market" section name avoids signalling a job search.
- **Cost guards:** Neon max compute 0.25 CU (min and max, also the project default for new branches; set 2026-10-13). Raise it only if real demand needs it, for example slow pipeline writes or the free compute-hours running short, and record the change here. Candidates capped per section.

---

## 8. Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest (Angular 22 default runner) | Signals and computed state, resolvers, data-source services, Zod contracts, pipeline helpers (dedupe, URL normalising, link building). Zoneless: use `vi.useFakeTimers()`, not `fakeAsync`. |
| Pipeline snapshots | Vitest + synthetic feeds in `fixtures/feeds/` | Fetch → prepare produces stable candidates; validator rejects unknown IDs, URLs in text, over-full sections and bad Top 3 |
| Database | SQL tests on a Postgres service container in CI, with an `auth.user_id()` shim | Non-members see nothing; members see content; users see only their own reads and saves; `authenticated` cannot write content or read `private` |
| End to end | Playwright | Landing loads and honours reduced motion; demo Today → News filter → story detail → save; archive search; manifest and service worker present; offline reload; mobile bottom bar and More sheet |
| Accessibility | Playwright + axe | No serious violations on landing, Today, News and Archive |

---

## 9. Build order

1. **Foundations:** repo, workspaces, contracts, design tokens, CI.
2. **Demo first:** landing with the Morning Machine; Today, News, Archive on the demo edition; PWA basics. Deploy to Vercel. Already a working portfolio piece.
3. **Pipeline (offline):** fetch, prepare, validate, write, fail, feeds-check; snapshot tests; routine prompt template.
4. **Database:** migrations, RLS, roles, RLS tests in CI.
5. **Auth spike (one evening):** Google sign-in and one Data API query from the Angular app, tested in iOS Safari and the installed home-screen app, including after token expiry (≈ 15 min). Neon Auth's session cookie is `SameSite=None` on Neon's domain and `@neondatabase/neon-js` is beta with React-only docs, so this must pass before step 6. Fallback: proxy the auth path through the app's own domain, or read through Vercel functions with a server-side connection. (2026-10-13: a plain Vercel rewrite is rejected by Neon; the proxy must be a Vercel Function. See Decisions log, "Auth transport".)
6. **Sign-in and live data:** `NeonEditionSource`, reads/saves sync, `app_opens`, offline guard.
7. **Go live:** create the routine, manual run, then schedule; watchdog, reminder and keepalive workflows.
8. **Polish:** Lighthouse pass, README and portfolio write-up.

Later: v1.1 compaction; Phase 2 Plan (read-only Daybook tasks through its MCP server); Phase 3 Inbox (Gmail and Zoho summaries, sender + summary only).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Routines are a research preview and may change | The pipeline is plain npm scripts; moving the AI step to the Claude API in GitHub Actions is a config change if ever needed |
| A run hits the subscription usage limit | Runs are small and use Sonnet; the watchdog emails if an edition is missing |
| Neon Auth third-party cookie fails on iOS | Auth spike (§9.5) before building on it, with two fallbacks |
| Neon steers new apps toward querying from functions rather than the Data API | The `EDITION_SOURCE` token isolates the data layer; switching to Vercel functions touches one service |
| Neon's free compute sleeps after 5 minutes | The routine wakes it; the app shows the cached edition first |
| A feed changes, dies or blocks cloud requests | Per-feed timeouts; partial editions still publish; `feeds-check` in week one |
| Feed text tries to steer the model (prompt injection) | The routine has no connectors and no email ability; output is validated and rendered as plain text; links come from code |
| Free tiers change | Small, separate pieces keep each provider swappable |
| Gmail app passwords need 2-Step Verification | One-time setup step for Noel |
