# Sessions

<!-- newest first -->

## 2026-10-13 · claude-code · Tasks 13–16, review, merge

**Did**
- Pulled `fa8d365` (Postgres 18 docs, from a cloud session the log never recorded).
- Task 13: `pipeline/src/db.ts` (`createSql`, `loadRecentUrls`, `loadAmContext`, `loadExisting`), `write.ts` (`planWrite`, `buildWriteStatements`, `buildFailStatement`), `cli.ts` (`fetch`, `validate`, `write [--force]`, `fail`, `feeds-check`, `demo-run`), `fixtures/model-edition.sample.json`, `docs/routine-prompt.md`, `docs/runbook.md`. Root scripts `pipeline`, `pipeline:fail`, `pipeline:feeds-check`.
- Task 14: `db/migrations/0001_init.sql`, plus `db/test/{shim.sql,rls.sql,run.sh}`. `rls.sql` also runs the exact `write.ts`/`fail` SQL as `pipeline_writer`. Two policies were mutation-checked.
- Task 15: `pipeline/src/ops/{mail,watchdog,reminder}.ts`, the four workflows, `vercel.json`, and `scripts/check-dist-csp.mjs` (`check:csp`).
- Task 16: `README.md`. Every command in it was run.
- Final review (fresh opus subagent): 0 Critical, 3 Important, all fixed in `adc5426`:
  - fonts added to the CSP `connect-src`;
  - `loadRecentUrls` excludes the edition being replaced;
  - a partial-edition CLI test.
- PR #1 merged to `main` as a merge commit (`c67103f`) after CI passed (build and db jobs).
- Neon: CLI installed, Noel logged in. Project `bold-heart-62307789` checked: PG 18, `aws-ap-southeast-2`, max compute 2 CU. Project-level Neon MCP (OAuth) and skills `neon`, `neon-auth`, `neon-postgres` installed, **uncommitted**.
- Numbers: contracts 13, pipeline 79, app 38, scripts 8, e2e 8, RLS pass, typecheck clean. Initial bundle 307 kB (84 kB transfer).

**Decided** (all in the spec's Decisions log and §4)
- `editions.key_dates` column. `weather` is null on a failed row.
- `pipeline_writer` gets DELETE on `stories`/`story_links` (needed to replace), never on `editions`. Reads and saves cascade with their story.
- Edition id `ed-<date>-<slot>`. The slot comes from the Sydney clock (before noon is `am`), so Run now after noon writes pm.
- `write` over an `ok` edition prints `skipped:` and exits 0. `fail` touches only a `failed` row.
- Angular `inlineCritical` is off: its loader is an inline script the CSP blocks.
- Keepalive runs `gh workflow enable`.

**Didn't work**
- `gautamkrishnar/keepalive-workflow` (named in the plan): GitHub has disabled the repo.
- CSP `https://*.neonauth.*` is invalid; wildcards are allowed only on the leftmost label. `*.neon.tech` is used instead.
- The original CSP `connect-src` would have blocked Google Fonts. The Angular service worker refetches every GET under the worker's own CSP, so the installed PWA would have had no fonts. Playwright can't catch this because `serve` sends no Vercel headers.
- `echo '\connect db'` in a psql pipe: some shells treat `\c` as "stop output". Use `printf`. Also, `set -e` inside `{ … } | psql` quits the group at the first failed `cat`, so the SQL never reaches psql.
- No `psql` on the Mac. Locally use `PSQL="docker exec -i fl-pg18 psql"` (Docker Desktop must be running).
- `neon login` from an agent was blocked by the permission check; Noel ran it with `!neon login`.
- GitGuardian flags `POSTGRES_PASSWORD: postgres` in `ci.yml` (`f225a08`). Since `a77f0bb`, CI uses `POSTGRES_HOST_AUTH_METHOD: trust`, but the old commit keeps the check red.

**Open**
- **GitGuardian incident 38146939:** Noel should mark it as a false positive in the dashboard (it's the throwaway CI container password).
- **Neon files are uncommitted** (`.mcp.json`, `.claude/skills/neon*`, `skills-lock.json`). Commit them? Move the skills to `.agents/skills/` and symlink them, per `AGENTS.md`? On restart, approve the project MCP and sign in.
- **Neon max compute is 2 CU**; the spec's cost guard says 0.25. Lower it in the console?
- **Not run yet:** `neon link`, `neon config init`, `neon deploy` (`auth: true`). First confirm `neon.ts` can do Google-only with email/password off before the first sign-in.
- **Replacing a partial edition deletes its reads and saves.** Decide in the follow-up plan whether a replace keeps saves.
- **Unverified:** whether `gh workflow enable` resets the 60-day clock.
- **Six deferred review minors:** see the `Final: minor (deferred)` lines in the ledger.
- **Housekeeping:** the `fl-pg18` Docker container is still running. `feat/v1-offline` still exists on the remote.

**Next**
- Write the follow-up plan for the account-dependent work: Neon Auth (Google only) → Data API → apply `0001_init.sql` → role passwords → member bootstrap → `NeonEditionSource` → Vercel → routine → GitHub secrets. Follow `docs/runbook.md` §1–3, and decide the Neon files and the 2 CU limit first.

**Touched** — `pipeline/src/{db,write,cli}.ts`, `pipeline/src/ops/*.ts`, `db/migrations/0001_init.sql`, `db/test/*`, `.github/workflows/*.yml`, `vercel.json`, `scripts/check-dist-csp.mjs`, `app/angular.json`, `fixtures/model-edition.sample.json`, `docs/routine-prompt.md`, `docs/runbook.md`, `README.md`, `AGENTS.md`, `docs/superpowers/specs/2026-10-10-first-light-design.md`, `docs/superpowers/plans/2026-10-10-first-light-v1-offline.md`, `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md`, `docs/SESSIONS.md`

## 2026-10-13 · claude-code · Git sync and Task 12

**Did**
- Local clone had never fetched: `main` was 2 behind, `feat/v1-offline` missing locally. Fast-forwarded `main`, created tracking `feat/v1-offline`. Nothing rewritten.
- Mac setup per `AGENTS.md` (Node 24.19, npm 11.17); `npm install`, Playwright Chromium.
- Task 12: `pipeline/src/validate.ts` (`LIMITS`, `validateEdition`) passes `validate.spec.ts`; added tests for empty text and repeated article IDs. Plan status and ledger updated.
- `test:scripts` now `node --test 'scripts/*.test.mjs'`; contracts gets `@types/node` + `"types": ["node"]` (its `demo-fixture.spec.ts` imports `node:fs`).
- `AGENTS.md` setup: build the app before `npm run e2e -w app`.
- Numbers: contracts 13/13, pipeline 46/46, app 38/38, e2e 8/8, scripts 3/3, typecheck clean, secret scan clean. Initial bundle 307 kB (84 kB transfer). Pushed `feat/v1-offline` to `f16314b`.

**Decided**
- Story IDs are `<editionId>-NN` in model order; empty model text is rejected; a repeated article ID in one story gives one link; the built Edition is re-parsed before return. Model-text rules and ID format added to the spec's Decisions log.

**Didn't work**
- Fresh clone: `npm run e2e -w app` times out on `config.webServer`. It serves `app/dist/app/browser`; run `npm run build -w app` first.
- `node --test scripts/` on Node 24.19 treats the directory as a module ("Cannot find module …/scripts"). The previous entry's "scripts 3/3" no longer held on this Node; neither did a clean root `typecheck` (contracts lacked Node types).
- `npm audit` flags `compression@1.8.1` (high, DoS) via `serve@14.2.6`, the dev-only e2e static server, which pins it exactly. Root `"overrides": { "compression": "^1.8.2" }` (and exact `1.8.2`) were ignored by npm 11.17 on install/update; deleting the lockfile entry made npm drop `compression` from the tree entirely. Reverted. `npm audit fix --force` would downgrade `serve` to v10 — don't.

**Open**
- `compression` audit warning stays until `serve` releases a fix, or swap `serve` for another static server in `app/playwright.config.ts`.
- npm 11 `allowScripts` skipped install scripts (esbuild, lmdb, @parcel/watcher, fsevents, msgpackr-extract); everything works without them. If a build breaks, try `npm approve-scripts esbuild` first.
- Tasks 13–16, the whole-branch review, then a PR to `main`. Noel's account setup unchanged (see the 2026-10-10 claude-code entry).
- Stray `docs/superpowers/specs/*.md.bak` still in Noel's local folder (git-ignored); safe to delete.

**Next**
- `/session-handoff start`, then `superpowers:executing-plans` at Task 13 (writer, CLI, routine prompt, runbook): `task-start` on the plan with N=13, BASE `f16314b` or the session commit after it.

**Touched** — `pipeline/src/validate.ts`, `pipeline/src/validate.spec.ts`, `package.json`, `package-lock.json`, `contracts/package.json`, `contracts/tsconfig.json`, `AGENTS.md`, `docs/superpowers/plans/2026-10-10-first-light-v1-offline.md`, `docs/superpowers/specs/2026-10-10-first-light-design.md`, `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md`, `docs/SESSIONS.md`

## 2026-10-13 · claude-code · Handoff readiness check

**Did**
- Copied the approved mockups from the "First Light mockups" design artifact into `docs/design/mockups/` with `docs/design/README.md` (how to read them, known drift vs the spec).
- Force-added the executing-plans ledger `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md` so a fresh clone resumes at Task 12.
- `AGENTS.md`: setup-on-a-new-machine steps (Node 24, npm 11, Playwright browser) and a design-references pointer.

**Decided**
- The ledger is tracked in git (rest of `.superpowers/` stays ignored): without it, executing-plans on another machine would restart at Task 1.
- Mockups are a visual target only; the spec and the built app win where they differ ("AU tech market", no Inbox tab in v1, spec colour tokens).

**Didn't work**
- The `.dc.html` mockups can't render outside the canvas runtime (`support.js`); kept as readable source plus the canvas link.

**Open**
- Same as the previous entry: Task 12 `validate.ts`, then Tasks 13–16, review, PR. Noel's account setup unchanged.

**Next**
- On the Mac: `git fetch && git checkout feat/v1-offline`, follow `AGENTS.md` "Setup on a new machine", then `/session-handoff start` and continue executing-plans at Task 12 Step 3.

**Touched** — `docs/design/`, `AGENTS.md`, `docs/superpowers/plans/2026-10-10-first-light-v1-offline.md`, `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md`

## 2026-10-10 · claude-code · v1 offline build, tasks 1–11

**Did**
- Branch `feat/v1-offline` (from `main` 35ab5db): plan Tasks 1–11 done, Task 12 half done. Last commit `7617414` (wip).
- `contracts/`: Zod schemas (Edition, Story, Candidate, ModelEdition), `sydneyDate`/`sydneyTime`, Zod-free `sections-meta.ts`.
- `fixtures/build-demo-edition.mjs` generates `fixtures/demo-edition.json` (am + pm + 6 archive days).
- `app/`: Angular 22.2 zoneless PWA: shell (drawer + mobile bottom bar + More sheet), Today, News + story detail, Archive (Signal Forms search, month grid), landing with the Morning Machine, `/signin` placeholder. Demo uses `DemoEditionSource` behind `EDITION_SOURCE`.
- Playwright: demo flow, mobile, reduced motion, PWA offline, axe on 4 routes. `scripts/check-dist-secrets.mjs` (+ `npm run check:secrets`).
- `pipeline/`: `sources.ts` (21 real feeds), `fetch/feeds.ts` (RSS/RDF/Atom, timeouts), `fetch/weather.ts` (Open-Meteo), `key-dates.ts` + `key-dates.yaml` (real RBA/ABS dates to Mar 2027), `weather-normals.json`, `scripts/compute-normals.ts`, `url.ts`, `prepare.ts`.
- Numbers at stop: app 38/38 unit, 8/8 Playwright; contracts green; pipeline 33 pass + `validate.spec.ts` RED (by design); scripts 3/3. Initial bundle 307 kB (84 kB transfer).

**Decided** (also in the spec's Decisions log where durable)
- Node 24 (Angular CLI 22.2 refuses 22.22.0) and npm 11 (npm 10.9 crashes on Vitest peers). Vitest ^5.
- App consumes contracts as TS source via tsconfig paths; the app bundle ships no Zod; demo routes lazy-loaded.
- Fonts not inlined at build (`fonts.inline: false`); loaded at runtime, so CSP must allow fonts.googleapis.com and fonts.gstatic.com.
- `EditionSource` gained `live` and `editionDays()`. rxResource pm polling deferred to `NeonEditionSource`.
- Component style budget 10 kB warn / 14 kB error (Morning Machine CSS).
- News: detail uses today's story, else `resource()` loads it; on mobile, opening a story navigates to `/news/:id`.
- Pipeline: no `minPoints` (HN threshold in the hnrss URL); candidates older than 72 h dropped; pm never has nudge/Top 3; "HTML in text" = any `<`.
- `weather-normals.json` seeded with approximate BOM 1991–2020 means; regenerate with `compute-normals.ts` from a machine that can reach Open-Meteo. Open-Meteo fixtures are synthetic JSON in the documented shape.

**Didn't work**
- npm 10.9: arborist "edgesOut" crash. Use npm 11.
- Listing workspaces that don't exist yet: npm errors. Add `db`/other workspaces only when created.
- Angular font inlining: the build fetches Google Fonts and gets 403 in sandboxes/CI.
- Eager demo + runtime Zod parsing: 701 kB initial bundle.
- nodejs.org, api.open-meteo.com and archive-api.open-meteo.com are blocked from the cloud sandbox; Node 24 came from the npm package `node-linux-x64@24`.
- `<br>` separators in the weather meta collapsed on mobile; replaced with spans.

**Open**
- Task 12: write `pipeline/src/validate.ts` (`LIMITS`, `validateEdition`) to pass `validate.spec.ts`.
- Tasks 13–16, the whole-branch review, then a PR to `main` (nothing merged yet; branch not pushed unless this entry's commit was pushed).
- Noel's setup (all free): Neon project + connector `https://mcp.neon.tech/mcp`; Vercel import + `firstlight.noel-sebastian.com` on Cloudflare (grey cloud); Gmail app password; GitHub secrets `WATCHDOG_DATABASE_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TO`; the routine; the Neon Auth cookie spike on iPhone.
- Stray `.bak` file in Noel's local specs folder; safe to delete.
- The paused Supabase project `noelsebastian22's Project` can be deleted only with Noel's explicit OK.

**Next**
- `/session-handoff start`, then continue `superpowers:executing-plans` at Task 12 Step 3: implement `validateEdition` until `npm test -w pipeline` is green, commit `feat(pipeline): prepare candidates and validate model output`.

**Touched** — `contracts/`, `app/`, `pipeline/`, `fixtures/`, `scripts/check-dist-secrets.mjs`, `package.json`, `AGENTS.md`, `docs/superpowers/specs/2026-10-10-first-light-design.md`, `docs/superpowers/plans/2026-10-10-first-light-v1-offline.md`

## 2026-10-10 · cowork · Design and project setup

**Did**
- Researched morning-briefing options; ran a design session (brainstorming + grilling).
- Built mockups on the "First Light mockups" canvas: landing with the Morning Machine, Today, News, Archive, mobile PWA, phase 2–3, typefaces.
- Wrote the design spec `docs/superpowers/specs/2026-10-10-first-light-design.md`.
- Created this folder with `AGENTS.md`, `CLAUDE.md`, the session-handoff skill (adapted from Daybook) and the impeccable design skill.

**Decided**
- Neon (Postgres + Neon Auth + Data API + RLS) instead of Supabase: the Supabase free plan's two active projects are taken by `daybook` and `sweep`.
- AI runs as a Claude Code routine on Noel's subscription, not the Claude API, to keep the cost at $0. GitHub Actions does CI, watchdog, nudge and compaction.
- Full claymorphism; Google Sans Flex + JetBrains Mono; public repo; demo edition is hand-written.
- Six sections, max 4 stories each; afternoon edition carries only changes; Sydney weather always shown.
- Emails: missed or failed run (6:15am, 4:45pm) and an 8am daily nudge if the app wasn't opened.
- Archive: full stories for 12 months, then headline index forever; saved stories kept in full.

**Didn't work**
- Domino-chain animation for the landing page: Noel didn't like it; replaced with "messy in, neat out" conveyor.
- Supabase schema-in-Daybook option: rejected to keep the apps independent.

**Open**
- Noel to review the spec (sections 6–8 were written without a separate walkthrough).
- Accounts and connectors for Noel to set up (see spec §9 and the setup checklist in the chat).
- No git repo yet: `git` cannot delete its lock files in this folder from Cowork, so Noel runs `git init` (or the folder becomes a clone of the GitHub repo).

**Next**
- Once the spec is approved: write the implementation plan, then start milestone 1 (foundations).

**Touched** — `AGENTS.md`, `CLAUDE.md`, `docs/SESSIONS.md`, `docs/superpowers/specs/2026-10-10-first-light-design.md`, `.agents/skills/session-handoff/SKILL.md`, `.claude/skills/`
