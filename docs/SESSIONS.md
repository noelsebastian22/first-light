# Sessions

<!-- newest first -->

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
