# First Light

A personal morning briefing, edited by Claude twice a day.

At 5:32am and 4:02pm Sydney time a scheduled Claude run reads about twenty news feeds,
picks what matters, and publishes an *edition*: weather for Katoomba and Sydney, a
one-line nudge, the three things to know, and up to four stories in each of six sections
(AU economy, AU politics, World, Web dev, AI, AU tech market). It is an installable
Angular 22 PWA with a claymorphism design, at `firstlight.noel-sebastian.com`.

The public site shows a complete demo built from hand-written sample data. The real
editions are private to one reader.

## Screenshots

To come:

- Landing page (the Morning Machine)
- Today on a phone
- News on desktop, with the story panel open
- Archive search
- Offline reload

## How it fits together

```
 5:32am / 4:02pm  Claude Code routine (subscription, Anthropic cloud, no connectors)
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

 GitHub Actions
 ├─ push / PR: typecheck, unit tests, build, secret and CSP checks, Playwright, RLS tests
 ├─ 6:17am and 4:47pm: watchdog emails if an edition is missing or failed
 ├─ 7:57am: reminder emails the nudge and Top 3 if the app hasn't been opened
 └─ monthly: keepalive
```

| Folder | What lives there |
|---|---|
| `app/` | Angular 22: standalone, zoneless, signals, OnPush, PWA |
| `pipeline/` | Node 24 + TypeScript: fetch, prepare, validate, write, fail, watchdog, reminder |
| `contracts/` | Zod schemas and types shared by the app and the pipeline |
| `db/` | SQL migrations and row-level-security tests |
| `fixtures/` | The demo edition and synthetic feeds for tests |
| `docs/` | Design spec, plans, routine prompt template, runbook, session log |

## Safe by design

- **No AI endpoint exists.** Claude runs only inside the scheduled routine, which has no
  connectors and no API trigger. The browser cannot start it.
- **The browser holds no secrets.** CI fails the build if anything secret-shaped lands in
  `app/dist`.
- **Links are never written by the model.** Claude cites candidate article IDs; code
  attaches the publisher URLs from the fetched feeds. Validation rejects unknown IDs, URLs
  or HTML in model text, and overfull sections, and Claude gets the errors to fix (at most
  two retries).
- **Model text is plain text.** It is never rendered with `innerHTML`.
- **Row-level security on every table.** Content is readable only by members; reads and
  saves only by their owner. The pipeline has its own role that can write content and
  touch nothing personal. `db/test/rls.sql` proves it against Postgres 18.
- **The demo never touches the database.** It is compiled from `fixtures/demo-edition.json`.
- **Quiet logs.** The public workflows print only `sent`, `skipped` or `error`.
- **$0.** Free tiers plus an existing Claude subscription; no API key.

## Local development

Node 24 (≥ 24.15) and npm 11.

```bash
npm install
npx playwright install chromium     # run from app/, once
npm test                            # contracts, pipeline and app unit tests
npm run typecheck
npm run test:scripts                # build-check scripts
npm start -w app                    # dev server at http://localhost:4200
npm run build -w app
npm run check:secrets               # after a build
npm run check:csp                   # after a build
npm run e2e -w app                  # after a build: Playwright, axe, PWA
```

The pipeline runs end to end against the fixtures with no network and no database:

```bash
npm run pipeline -- demo-run        # writes pipeline/out/validated.json
```

RLS tests need a throwaway Postgres 18 and a superuser URL:

```bash
docker run -d --name fl-pg18 -e POSTGRES_PASSWORD=postgres postgres:18
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
  PSQL="docker exec -i fl-pg18 psql" db/test/run.sh
```

(With `psql` installed and the container's port published, drop the `PSQL=` override.)

## How the routine works

Each run is a Claude Code session following `docs/routine-prompt.md`:

1. `npm run pipeline -- fetch --slot am|pm` pulls every feed, the Open-Meteo forecast and
   the key dates, drops duplicates and stories already covered, and writes
   `pipeline/out/candidates.json`.
2. Claude reads the candidates and writes `pipeline/out/edition.json`: stories citing
   candidate IDs, plus the Top 3 and a nudge in the morning.
3. `npm run pipeline -- validate` checks it. On errors, Claude fixes and retries, twice at most.
4. `npm run pipeline -- write` stores it in one transaction. It replaces a failed or
   partial edition and never overwrites a good one.
5. If anything fails for good, `npm run pipeline:fail -- "<step>: <error>"` records it and
   the watchdog emails the error.

Setup for Neon, the routine and GitHub secrets is in `docs/runbook.md`.

## Credits

Edited by Claude. Weather data by [Open-Meteo.com](https://open-meteo.com/). Stories
link to their publishers; summaries are written fresh and quote no more than a phrase.
