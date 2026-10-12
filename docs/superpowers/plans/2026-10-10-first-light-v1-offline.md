# First Light v1 (offline build) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything in the First Light spec that does not need Noel's Neon, Vercel, Gmail or routine accounts: contracts, the full demo app, the pipeline, database migrations with RLS tests, and the operations scripts and workflows.

**Architecture:** npm workspaces. `contracts/` holds Zod schemas shared by `app/` (Angular 22 PWA, demo data source behind an `EDITION_SOURCE` token) and `pipeline/` (Node 22 scripts the routine runs). `db/` holds SQL migrations tested against a Postgres service container in CI.

**Tech Stack:** Angular 22 (zoneless, signals, Signal Forms, `httpResource`/`rxResource`, `@angular/pwa`), Vitest, Playwright + `@axe-core/playwright`, Zod 4, `fast-xml-parser`, `yaml`, `@neondatabase/serverless`, `nodemailer`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-10-first-light-design.md`

## Status (2026-10-13, end of day)

| Tasks | State |
|---|---|
| 1–16 | Done (contracts, demo app, Playwright + axe + PWA + secret/CSP checks, pipeline fetch/prepare/validate/write/fail CLI, db migration + RLS tests, watchdog/reminder/workflows/vercel.json, README) |
| Final | Whole-branch review done (0 Critical, 3 Important fixed in `adc5426`, 6 Minor deferred in the ledger). Merged to `main` as PR #1 (`c67103f`) on 2026-10-13 |
| Next | Follow-up plan written: `docs/superpowers/plans/2026-10-13-first-light-v1-live.md` |

Use `superpowers:executing-plans`. Its ledger, `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md`, is force-added to git (the rest of `.superpowers/` stays ignored) so any machine resumes at the first unfinished task instead of redoing finished tasks. Keep appending to it and commit it with each task.

## Global Constraints

- Node 24 (≥ 24.15) and npm 11, TypeScript strict, **no `any`**.
- Angular: standalone, zoneless, every component `ChangeDetectionStrategy.OnPush`, `input()`/`output()`, `inject()`, built-in control flow, templates in sibling `.html` files; a sibling `.css` only where genuinely needed.
- A "day" is a `YYYY-MM-DD` string in `Australia/Sydney`; never `toISOString()` for a calendar date.
- Sections, in this order and with these labels: `au-economy` "AU economy", `au-politics` "AU politics", `world` "World", `web-dev` "Web dev", `ai` "AI", `au-tech-market` "AU tech market". Max 4 stories per section.
- Model text is rendered as plain text only; never `innerHTML`.
- Links are attached by code from cited article IDs; model text may not contain URLs or HTML.
- Design tokens: ground `#E9EEF5`, clay `#F5F8FC`, ink `#0E1A2B`, ink-2 `#44546A`, primary `#3E6FA3`, sun `#E8833A`; section fills `#FBE3CC`, `#E4DDF3`, `#D9EEE6`, `#DCE7F2`, `#F6E7B8`, `#F0DADA` (same order as sections). Fonts: Google Sans Flex (`'ROND' 100` on headings), JetBrains Mono for labels.
- All motion respects `prefers-reduced-motion` and the in-app reduce-motion preference.
- "Edited by Claude" appears only in small print (landing footer, Today fine print). "Weather data by Open-Meteo.com" on weather surfaces.
- Workflows never print query results, headlines or raw errors; log only `ok`, `sent`, `skipped`.
- $0: no paid service, no API key for Claude.

## Review Focus

1. **A section with no stories** — hidden in News and in Today's overview, never an empty card. Test in Task 6 and Task 7.
2. **Before 4:02pm or no pm edition** — Today shows the am edition only, no "New since" badge, Afternoon toggle explains when it lands. Test in Task 6.
3. **Model cites an unknown article ID, puts a URL in text, or overfills a section** — validation fails with a readable error and nothing is written. Test in Task 12.
4. **One feed times out or returns malformed XML** — that source is skipped and recorded; others proceed; edition status `partial`. Test in Task 11 and Task 13.
5. **Late-night Sydney dates** — at 00:30 Sydney (13:30 UTC the previous day) `sydneyDate()` returns the Sydney date. Test in Task 1.

---

### Task 1: Workspace and contracts

**Files:**
- Create: `package.json` (workspaces `contracts`, `pipeline`, `app`; scripts `test`, `build`, `typecheck`), `tsconfig.base.json`, `.nvmrc` (`22`), `.env.example`
- Create: `contracts/package.json`, `contracts/tsconfig.json`, `contracts/src/index.ts`, `contracts/src/sections.ts`, `contracts/src/edition.ts`, `contracts/src/model-output.ts`, `contracts/src/dates.ts`
- Test: `contracts/src/edition.spec.ts`, `contracts/src/dates.spec.ts`

**Interfaces:**
- Produces:
  - `SECTIONS: readonly SectionKey[]`, `SectionKey`, `SECTION_META: Record<SectionKey, { label: string; fill: string }>`
  - Zod schemas + inferred types: `StoryLink {sourceKey, url, publisherTitle, publishedAt}`, `Story {id, section, rank, topRank: 1|2|3|null, title, summary, whyItMatters, pickedBecause, links: StoryLink[]}`, `WeatherPlace {name, nowC, highC, lowC, normalHighC, normalLowC, summary, rainChancePct, windKmh, sunrise, hourly: {time, tempC}[]}`, `Weather {katoomba, sydney}`, `KeyDate {date, timeLocal: string|null, label, sourceName, url}`, `Edition {id, editionDate, slot: 'am'|'pm', status: 'ok'|'partial'|'failed', createdAt, nudge: string|null, weather, keyDates, sourceCount, stories}`
  - `Candidate {id, sourceKey, publisher, sectionHint, title, snippet, url, publishedAt}`, `CandidatesFile {slot, editionDate, generatedAt, amContext: {createdAt, titles: string[]} | null, candidates: Candidate[]}`
  - `ModelEdition {stories: {section, title, summary, whyItMatters, pickedBecause, articleIds: string[]}[], top3: number[] | null, nudge: string | null}` (top3 = indexes into `stories`)
  - `sydneyDate(at: Date): string`, `sydneyTime(at: Date): string` (`h:mma`, e.g. `5:31am`)

- [ ] **Step 1: Write failing tests** — `edition.spec.ts`: a valid edition parses; a story with `topRank: 4` fails; a section key outside the six fails. `dates.spec.ts`: `sydneyDate(new Date('2026-10-12T13:30:00Z'))` → `'2026-10-13'`; `sydneyDate(new Date('2026-10-12T12:59:00Z'))` → `'2026-10-12'` (23:59 AEDT); `sydneyTime(new Date('2026-10-12T18:31:00Z'))` → `'5:31am'`.
- [ ] **Step 2: Run** `npm test -w contracts` — expect FAIL (modules missing).
- [ ] **Step 3: Implement** schemas with Zod 4; dates with `Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney' })`.
- [ ] **Step 4: Run** `npm test -w contracts` — expect PASS; `npm run typecheck -w contracts` clean.
- [ ] **Step 5: Commit** `feat(contracts): shared edition schemas and Sydney dates`

### Task 2: Demo edition fixture

**Files:**
- Create: `fixtures/demo-edition.json` — `{ "am": Edition, "pm": Edition, "archive": Edition[] }`
- Test: `contracts/src/demo-fixture.spec.ts`

**Interfaces:** Produces `fixtures/demo-edition.json` used by `DemoEditionSource` (Task 4) and pipeline tests.

- [ ] **Step 1: Write failing test** — parses `am`, `pm` and each `archive` item with `Edition`; `am` has exactly 3 stories with `topRank` 1–3; `am.nudge` non-null; `pm.nudge` null and no `topRank`; every section in `am` has 1–4 stories; every story has ≥ 1 link.
- [ ] **Step 2: Run** — FAIL (file missing).
- [ ] **Step 3: Write the fixture.** Date Tuesday 13 Oct 2026, am `createdAt` 5:31am, pm 4:03pm. Content from the mockups (CPI 28 Oct, Labour Force 15 Oct, RBA 2–3 Nov, Angular v20 LTS ends Nov, Signal Forms stable in v22, AI Mode 1B users, State of JS 2025, developer workforce 216,000). Politics and World stories are clearly generic explainers (no invented events), each linking to the publisher's section page. Weather: Katoomba 9°, 7–17°, normal 8–18°, fog till 10; Sydney 14–22°. pm: 2–3 stories. Archive: 6 earlier editions with 2–3 stories each for search.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(fixtures): hand-written demo edition`

### Task 3: Angular app scaffold and design system

**Files:**
- Create via `npx @angular/cli@22 new app --directory app --routing --style css --ssr false --skip-git` then `ng add @angular/pwa`
- Create: `app/src/styles/tokens.css`, `app/src/styles/clay.css` (classes `.clay`, `.dent`, `.pill`, `.tag`, `.btn`, `.btn-pri`, `.btn-sec`), `app/src/styles.css` imports both
- Modify: `app/src/index.html` (fonts, theme-color `#E9EEF5`, title "First Light"), `app/public/manifest.webmanifest` (name "First Light", short_name "First Light", background `#E9EEF5`, theme `#3E6FA3`), icons (sun-over-hill mark)
- Test: `app/src/app/app.spec.ts`

- [ ] **Step 1:** Scaffold; confirm `ng test` uses Vitest and app is zoneless (`provideZonelessChangeDetection` or default). Add `"@first-light/contracts": "*"` dependency.
- [ ] **Step 2:** Replace default `App` with a router-outlet shell; test: renders a `router-outlet`.
- [ ] **Step 3: Run** `npm test -w app` and `npm run build -w app` — PASS; build output includes `ngsw.json` and `manifest.webmanifest`.
- [ ] **Step 4: Commit** `feat(app): Angular 22 PWA scaffold with clay design tokens`

### Task 4: Edition source, demo source and preferences

**Files:**
- Create: `app/src/app/core/edition-source.ts`, `app/src/app/core/demo-edition-source.ts`, `app/src/app/core/prefs.ts`
- Test: `app/src/app/core/demo-edition-source.spec.ts`, `app/src/app/core/prefs.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TodayEditions { am: Edition; pm: Edition | null }
  export interface ArchiveQuery { text: string; section: SectionKey | 'all'; savedOnly: boolean }
  export interface ArchiveHit { story: Story; editionDate: string; slot: 'am' | 'pm' }
  export interface EditionSource {
    today(): Promise<TodayEditions>;
    story(id: string): Promise<{ story: Story; edition: Edition } | null>;
    search(q: ArchiveQuery): Promise<ArchiveHit[]>;
    readIds: Signal<ReadonlySet<string>>;
    savedIds: Signal<ReadonlySet<string>>;
    markRead(id: string): Promise<void>;
    toggleSave(id: string): Promise<void>;
  }
  export const EDITION_SOURCE: InjectionToken<EditionSource>;
  ```
  `Prefs` service: `reduceMotion: WritableSignal<boolean>` (defaults to the media query), `density: WritableSignal<'comfortable' | 'compact'>`, persisted in `localStorage` key `firstlight.prefs.v1` inside try/catch.

- [ ] **Step 1: Failing tests** — `today()` returns fixture am+pm; `story('unknown')` → null; `search({text:'angular', section:'all', savedOnly:false})` returns hits whose title or summary contains "angular" case-insensitively, newest first; `savedOnly` filters to saved; `toggleSave` twice leaves it unsaved; `markRead` adds to `readIds()`. Prefs: setting `reduceMotion` persists and a new instance reads it back; a throwing `localStorage` falls back to defaults.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** (demo state in memory only).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(app): edition source token and demo source`

### Task 5: Shell, navigation and routes

**Files:**
- Create: `app/src/app/shell/shell.ts|html|css`, `app/src/app/shell/nav.ts`, `app/src/app/shell/more-sheet.ts|html`, `app/src/app/app.routes.ts`, `app/src/app/signin/signin.ts|html`
- Test: `app/src/app/shell/shell.spec.ts`

**Interfaces:**
- Routes: `''` → Landing (Task 9); `'demo'` → `Shell` with `providers: [{ provide: EDITION_SOURCE, useClass: DemoEditionSource }]`, children `today`, `news`, `news/:storyId`, `archive`, `''` → redirect `today`; `'signin'` → `Signin` (explains sign-in arrives with the database step, links to `/demo/today`); `'**'` → `''`.
- `Nav`: `drawerOpen: WritableSignal<boolean>` (persisted `firstlight.nav.v1`), `moreOpen: WritableSignal<boolean>`.
- Shell reads `?private=1` and shows the private-edition note.

- [ ] **Step 1: Failing tests** — desktop: drawer toggle button has `aria-expanded` that flips and hides labels when collapsed; mobile: bottom bar shows Today, News, Archive, More; clicking More opens a dialog with Preferences, About, Sign in; `?private=1` shows "This is a private edition".
- [ ] **Step 2–4:** Run (FAIL) → implement (CSS breakpoint 900px: drawer ≥ 900, bottom bar below) → Run (PASS).
- [ ] **Step 5: Commit** `feat(app): shell with collapsible drawer and mobile bottom bar`

### Task 6: Today page

**Files:**
- Create: `app/src/app/today/today.ts|html`, `app/src/app/today/today.resolver.ts`, `app/src/app/weather/weather-card.ts|html`, `app/src/app/weather/range-bar.ts|html`
- Test: `app/src/app/today/today.spec.ts`, `app/src/app/weather/range-bar.spec.ts`

**Interfaces:**
- `todayResolver: ResolveFn<TodayEditions>` — calls `inject(EDITION_SOURCE).today()`.
- `RangeBar` inputs: `low`, `high`, `normalLow`, `normalHigh`, `now`, `min = 0`, `max = 30`; exposes `computed` percentages; `role="img"` with an `aria-label` like "Today 7 to 17 degrees; average 8 to 18".
- Weather refresh: `WeatherLive` uses `httpResource` against Open-Meteo only when the source says `live = true` (demo passes false) — demo shows fixture weather.

- [ ] **Step 1: Failing tests** — renders the date "Tuesday 13 October", nudge, three Top 3 cards in `topRank` order, key dates, a section overview tile per non-empty section (a section emptied in the test fixture is not rendered); Morning/Afternoon toggle: with `pm = null` choosing Afternoon shows "The afternoon edition isn't out yet"; with pm present shows "New since 5:31am" count. Range bar: low 7 high 17 on 0–30 → left 23.3%, width 33.3%.
- [ ] **Step 2–4:** FAIL → implement to the mockup → PASS. Fine print includes "Edited by Claude" and "Weather data by Open-Meteo.com".
- [ ] **Step 5: Commit** `feat(app): Today screen`

### Task 7: News and story detail

**Files:**
- Create: `app/src/app/news/news.ts|html`, `app/src/app/news/story-detail.ts|html`
- Test: `app/src/app/news/news.spec.ts`

**Interfaces:**
- `News` state: `filter = signal<SectionKey | 'all'>('all')`; `stories = computed(...)` merges pm stories first (with `isNew: true`) then am, grouped in section order; `selected = linkedSignal(() => visible()[0]?.id ?? null)`.
- `/demo/news/:storyId` renders `StoryDetail` full-width on mobile; on desktop the detail panel sits beside the list.

- [ ] **Step 1: Failing tests** — chips show counts per section and hide empty sections; choosing "Web dev" shows only web-dev stories; selecting a story marks it read (unread dot gone, counter decrements); Save toggles label "Save for later" ↔ "Saved"; links render as `<a href>` from `story.links` with `rel="noopener"` and `target="_blank"`; text with `<b>` renders literally (no HTML).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(app): News list, filters and story detail`

### Task 8: Archive

**Files:**
- Create: `app/src/app/archive/archive.ts|html`, `app/src/app/archive/month-grid.ts|html`
- Test: `app/src/app/archive/archive.spec.ts`

**Interfaces:**
- Signal Form over model `signal<ArchiveQuery>({ text: '', section: 'all', savedOnly: false })`; results via `resource` keyed on the debounced (250 ms) query calling `source.search()`.
- `MonthGrid` input `editions: {date: string; am: boolean; pm: boolean}[]`, `month: string` (`'2026-10'`); Monday-first; 1 Oct 2026 is a Thursday (3 leading blanks).

- [ ] **Step 1: Failing tests** — typing "rba" shows matching hits; section filter narrows; "Saved only" shows only saved; no match shows "Nothing matches…"; grid for 2026-10 has 3 blanks then 31 days. Use `vi.useFakeTimers()` for the debounce.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(app): Archive with Signal Forms search`

### Task 9: Landing page and Morning Machine

**Files:**
- Create: `app/src/app/landing/landing.ts|html`, `app/src/app/landing/morning-machine.ts|html|css`
- Test: `app/src/app/landing/landing.spec.ts`

**Interfaces:** `MorningMachine` input `animate: boolean` (false when reduced motion); host gets class `paused` when false or when off-screen (IntersectionObserver).

- [ ] **Step 1: Failing tests** — landing has the H1 "Your morning, already read.", links to `/demo/today`, the three Gather/Think/Deliver steps, "Safe by design" cards, "Built with" chips and footer "Edited by Claude"; with reduce-motion pref on, the machine host has class `paused`.
- [ ] **Step 2–4:** FAIL → port the mockup's Morning Machine v2 (CSS keyframes + custom properties, `@defer (on viewport)`) → PASS.
- [ ] **Step 5: Commit** `feat(app): landing page with the Morning Machine`

### Task 10: End-to-end, accessibility and PWA checks

**Files:**
- Create: `app/playwright.config.ts`, `app/e2e/demo.spec.ts`, `app/e2e/pwa.spec.ts`, `app/e2e/a11y.spec.ts`, `scripts/check-dist-secrets.mjs`

- [ ] **Step 1: Write tests** — demo flow: `/` → "Explore the demo edition" → Today → News → filter "AI" → open story → Save → Archive search "angular" finds it; mobile viewport 390×844: bottom bar + More sheet; reduced motion: machine paused; PWA: `link[rel=manifest]` present and `navigator.serviceWorker` registers on the production build (`npx http-server dist`); offline: after first load, `context.setOffline(true)` and reload still shows Today; axe: no `serious`/`critical` violations on `/`, `/demo/today`, `/demo/news`, `/demo/archive`. Secret scan: fails if `dist` matches `/postgres(ql)?:\/\/|sk-ant-|npg_[A-Za-z0-9]{8,}/`.
- [ ] **Step 2: Run** `npm run e2e -w app` — fix until PASS.
- [ ] **Step 3: Commit** `test(app): Playwright, axe and PWA checks`

### Task 11: Pipeline fetch (feeds, weather, key dates)

**Files:**
- Create: `pipeline/package.json`, `pipeline/tsconfig.json`, `pipeline/src/sources.ts`, `pipeline/src/fetch/feeds.ts`, `pipeline/src/fetch/weather.ts`, `pipeline/src/key-dates.ts`, `pipeline/key-dates.yaml`, `pipeline/weather-normals.json`, `pipeline/scripts/compute-normals.ts`
- Create: `fixtures/feeds/*.xml` (synthetic RSS and Atom, plus one malformed)
- Test: `pipeline/src/fetch/feeds.spec.ts`, `pipeline/src/fetch/weather.spec.ts`, `pipeline/src/key-dates.spec.ts`

**Interfaces:**
- `Source {key, name, url, section: SectionKey, active: boolean, minPoints?: number}`; `SOURCES: Source[]` (spec §5 list with real feed URLs).
- `RawItem {sourceKey, publisher, sectionHint, title, snippet, url, publishedAt}`
- `parseFeed(xml: string, source: Source): RawItem[]` (RSS 2.0 and Atom; snippet = plain text ≤ 400 chars, HTML stripped).
- `fetchAllFeeds(sources: Source[], fetchImpl: typeof fetch, timeoutMs = 10000): Promise<{ items: RawItem[]; failed: { key: string; reason: string }[] }>`
- `fetchWeather(fetchImpl, normals, editionDate): Promise<Weather>` — Open-Meteo forecast for Katoomba (-33.71, 150.31) and Sydney CBD (-33.87, 151.21), `timezone=Australia/Sydney`.
- `loadKeyDates(yamlText: string, today: string, horizonDays = 45): { dates: KeyDate[]; warning: string | null }` (warning when none in the next 30 days).

- [ ] **Step 1: Failing tests** — RSS and Atom fixtures parse to expected items; HTML stripped from snippets; malformed XML returns `failed` entry not a throw; a fetch that never resolves fails after the timeout (fake timers); weather maps a recorded Open-Meteo JSON fixture to `Weather` with normals from the JSON; key dates filter to the horizon and warn when empty.
- [ ] **Step 2–4:** FAIL → implement → PASS. `compute-normals.ts` (run by hand, not in CI) reads the Historical Weather API and writes `weather-normals.json`; commit an initial file with the 12 monthly values per place.
- [ ] **Step 5: Commit** `feat(pipeline): feed, weather and key-date fetching`

### Task 12: Pipeline prepare and validate

**Files:**
- Create: `pipeline/src/prepare.ts`, `pipeline/src/validate.ts`, `pipeline/src/url.ts`
- Test: `pipeline/src/prepare.spec.ts`, `pipeline/src/validate.spec.ts`, `pipeline/src/url.spec.ts`

**Interfaces:**
- `normaliseUrl(url: string): string` — lower-case host, strip `utm_*`, `fbclid`, `gclid`, fragments and trailing slash.
- `prepare(input: { items: RawItem[]; slot: 'am' | 'pm'; editionDate: string; now: Date; recentUrls: Set<string>; am: { createdAt: string; urls: Set<string>; titles: string[] } | null; perSectionCap?: number }): CandidatesFile` — ids `c001…`; near-duplicate titles = same normalised title after removing punctuation and stop words; pm keeps items with `publishedAt ≥ am.createdAt − 15 min` and URL not in `am.urls`; pm with `am = null` behaves as am.
- `validateEdition(model: unknown, candidates: CandidatesFile, ctx: { editionId: string; createdAt: string; weather: Weather; keyDates: KeyDate[]; sourceCount: number; status: 'ok' | 'partial' }): { ok: true; edition: Edition } | { ok: false; errors: string[] }`

- [ ] **Step 1: Failing tests** — dedupe by URL and near-duplicate title; drops `recentUrls`; caps at 25 per section; pm window and am-URL exclusion; snapshot of `prepare()` on the fixture feeds. Validate: unknown article ID → error naming it; a URL or `<` in any text field → error; 5 stories in one section → error; am without nudge or with top3 ≠ 3 distinct valid indexes → error; pm with nudge or top3 → error; text over limits (title 120, summary 400, whyItMatters 220, pickedBecause 160, nudge 200) → error; valid input → `Edition` whose links come from the cited candidates and whose `topRank` matches `top3` order.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(pipeline): prepare candidates and validate model output`

### Task 13: Pipeline writer, CLI and routine docs

**Files:**
- Create: `pipeline/src/db.ts`, `pipeline/src/write.ts`, `pipeline/src/cli.ts`, `docs/routine-prompt.md`, `docs/runbook.md`
- Test: `pipeline/src/write.spec.ts`, `pipeline/src/cli.spec.ts`

**Interfaces:**
- `type SqlTx = (queries: ...) => Promise<unknown>`; `createSql(url: string)` wraps `neon(url)`.
- `planWrite(existing: { status: Edition['status'] } | null, force: boolean): 'insert' | 'replace' | 'refuse'`
- `buildWriteStatements(edition: Edition): { text: string; params: unknown[] }[]` (edition upsert, delete old stories for that edition on replace, insert stories, insert links).
- CLI (`npm run pipeline -- <cmd>`): `fetch --slot am|pm` (writes `out/candidates.json` and `out/context.json`; reads recent URLs and am context from DB when `DATABASE_URL` is set, else empty), `validate` (reads `out/edition.json`, prints errors or `ok`, writes `out/validated.json`), `write [--force]`, `fail "<step>: <error>"`, `feeds-check` (prints per-feed ok/failed), `demo-run` (fetch from fixtures → uses `fixtures/model-edition.sample.json` → validate, no DB; for local smoke tests).
- Exit codes: 0 ok, 1 validation errors, 2 infrastructure error.

- [x] **Step 1: Failing tests** — `planWrite(null,false)='insert'`, `({status:'failed'},false)='replace'`, `({status:'partial'},false)='replace'`, `({status:'ok'},false)='refuse'`, `({status:'ok'},true)='replace'`; `buildWriteStatements` uses parameters only (no interpolated text) and inserts one link row per story link; `demo-run` exits 0 and produces a valid edition.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Write** `docs/routine-prompt.md` (generic template: the exact command sequence fetch → read candidates → write `out/edition.json` → validate → retry up to twice → write → on final failure `fail`; editorial rules from spec §5; placeholder `<<READER PROFILE: kept in the private routine prompt>>`) and `docs/runbook.md` (Neon setup, roles, member bootstrap SQL, routine environment settings, GitHub secrets, recovering a missed edition with Run now).
- [x] **Step 6: Commit** `feat(pipeline): writer, CLI and routine prompt template`

### Task 14: Database migrations and RLS tests

**Files:**
- Create: `db/migrations/0001_init.sql`, `db/test/shim.sql` (creates `authenticated`, `anonymous` roles if missing and `auth.user_id()` reading `current_setting('request.jwt.claim.sub', true)`), `db/test/rls.sql`, `db/test/run.sh`

**Interfaces:** Schema per spec §4: `editions`, `stories` (with `top_rank`, generated `search` tsvector, GIN index), `story_links`, `private.members`, `reads`, `saves`, `app_opens`; `public.is_member()` `SECURITY DEFINER` with `set search_path = ''`; roles `pipeline_writer`, `watchdog_reader` created `NOLOGIN` in the migration (Noel sets passwords in Neon, see runbook); grants and policies exactly as spec §4.

- [x] **Step 1: Write `rls.sql`** as assertions (`DO $$ … RAISE EXCEPTION … $$`): as `authenticated` with sub `stranger` → 0 editions; with sub `noel` (member) → editions visible; `noel` cannot insert into `editions`; `noel` cannot select `private.members`; `noel` sees own reads only, not `other`'s; `anonymous` sees nothing; `pipeline_writer` can insert an edition and cannot select `reads`; `watchdog_reader` can select `app_opens` and cannot insert.
- [x] **Step 2: Run** `db/test/run.sh` against a local Postgres 18 (`DATABASE_URL`, matching the Neon project) — FAIL before migration exists.
- [x] **Step 3: Write `0001_init.sql`** — idempotent role creation (`DO` blocks), schema, policies.
- [x] **Step 4: Run** — PASS.
- [x] **Step 5: Commit** `feat(db): schema, roles and RLS with tests`

### Task 15: Operations scripts and workflows

**Files:**
- Create: `pipeline/src/ops/watchdog.ts`, `pipeline/src/ops/reminder.ts`, `pipeline/src/ops/mail.ts`
- Create: `.github/workflows/ci.yml`, `watchdog.yml`, `reminder.yml`, `keepalive.yml`, `vercel.json`
- Test: `pipeline/src/ops/watchdog.spec.ts`, `pipeline/src/ops/reminder.spec.ts`

**Interfaces:**
- `watchdogDecision(edition: { status: Edition['status']; error: string | null } | null, slot: 'am' | 'pm'): { send: false } | { send: true; subject: string; body: string }`
- `reminderDecision(am: { status: Edition['status']; nudge: string | null; topTitles: string[] } | null, openedToday: boolean, appUrl: string): { send: false } | { send: true; subject: string; body: string }`
- `sendMail(cfg: { user: string; pass: string; to: string }, msg: { subject: string; text: string }): Promise<void>` (nodemailer Gmail SMTP).
- Workflows: `ci.yml` on push/PR — `npm ci`, typecheck, unit tests, build, secret scan, Playwright (with browsers), and a `db` job with `postgres:18` service (Neon project is Postgres 18) running `db/test/run.sh`. `watchdog.yml` cron `17 6 * * *` and `47 16 * * *` with `timezone: Australia/Sydney`; `reminder.yml` `57 7 * * *`; `keepalive.yml` monthly using the keepalive action in API mode. All print only `ok`/`sent`/`skipped`.
- `vercel.json`: SPA rewrite to `/index.html`; headers: CSP (`default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://api.open-meteo.com https://*.neon.tech https://*.neonauth.*; img-src 'self' data:; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

- [x] **Step 1: Failing tests** — watchdog: null edition → send "First Light: morning edition missing"; `failed` with error → send with the error in the body; `ok`/`partial` → no send. Reminder: am ok and not opened → send with subject "Today's edition is ready" and body containing nudge, 3 titles and the URL; opened → no send; am missing or failed → no send.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(ops): watchdog, reminder and workflows`

### Task 16: README

**Files:** Create `README.md` — what it is, screenshots placeholder list, architecture diagram (text), "Safe by design", local dev commands, how the routine works, credits ("Edited by Claude", Open-Meteo).

- [x] **Step 1:** Write; check every command in it runs.
- [x] **Step 2: Commit** `docs: README`

---

**Not in this plan (needs Noel's accounts):** Neon project and migration apply, auth spike and `NeonEditionSource`, Vercel deploy and domain, routine creation, GitHub secrets. A short follow-up plan covers them once Neon exists.
