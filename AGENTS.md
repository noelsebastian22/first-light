# AGENTS.md

Conventions for this repo. Read this before changing anything.

**The design spec is the single source of truth** for what First Light is and why:
[`docs/superpowers/specs/2026-10-10-first-light-design.md`](docs/superpowers/specs/2026-10-10-first-light-design.md).
If a change contradicts it, update the spec in the same commit or don't make the change.

## Session log

Start every session with `/session-handoff start` and end it with `/session-handoff`.
`docs/SESSIONS.md` is the only shared memory between agents.

The skill's canonical copy is `.agents/skills/session-handoff/SKILL.md`, symlinked to
`.claude/skills/session-handoff` so Claude Code discovers it. Claude Code only reads skills
from `.claude/skills/`, so that symlink is load-bearing. Edit the `.agents/` copy.

The `neon`, `neon-auth` and `neon-postgres` skills in `.claude/skills/` are vendored from
`neondatabase/agent-skills` and pinned in `skills-lock.json`. Don't edit or move them;
update with `npx skills update`. `.mcp.json` adds the project-scoped Neon MCP (OAuth).

## Status

The offline v1 is merged (PR #1; ledger `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md`).
Current work: `docs/superpowers/plans/2026-10-13-first-light-v1-live.md` (status table at the top),
ledger `.superpowers/sdd/2026-10-13-first-light-v1-live/progress.md` (tracked in git, unlike the
rest of `.superpowers/`; every ruling is there). Account setup steps: `docs/runbook.md`.

## Setup on a new machine

```bash
nvm install 24 && nvm use 24        # Node >= 24.15 (Angular CLI 22.2 refuses older)
npm i -g npm@11                     # npm 10.9 crashes resolving Vitest peers
npm install
npx playwright install chromium     # once, for app e2e tests (run from app/)
npm test                            # contracts, pipeline, app unit tests, api (auth proxy)
npm run build -w app                # e2e serves app/dist; without a build it times out
npm run e2e -w app
npm run pipeline -- demo-run       # pipeline end to end on fixtures, no network or DB
```

No `.env` is needed for any of the above; `.env.example` lists the names. RLS tests need a
throwaway Postgres 18: see "Local development" in `README.md` (`db/test/run.sh`).

## Design references

Mockups: `docs/design/` (README explains how to read them and where the spec overrides
them). Live canvas: the "First Light mockups" design artifact linked there.

## Stack

- npm workspaces: `contracts/`, `pipeline/`, `app/` (plus `db/`, `fixtures/`, `scripts/` folders)
- **Node 24 (≥ 24.15) and npm 11.** Older versions fail; see `.nvmrc` and `engines`.
- Angular 22: standalone, zoneless, OnPush, signals-first, PWA
- Neon: Postgres, Neon Auth (Google), Data API, row-level security
- Pipeline: Node 24 + TypeScript (tsx), run by a Claude Code routine at 5:32am and 4:02pm Sydney
- Pipeline writes to Neon over HTTPS (`@neondatabase/serverless`); the routine has no connectors
- GitHub Actions: CI, watchdog email, 8am reminder email, keepalive
- Vercel Hobby at `firstlight.noel-sebastian.com` (Cloudflare DNS, grey cloud). One Vercel Function,
  `api/auth.ts`: the same-origin Neon Auth proxy at `/auth/*`, region `syd1`. Typecheck: root `tsconfig.api.json`

## Hard rules

- **TypeScript everywhere. No `any`.** Shared shapes live in `contracts/` as Zod schemas.
- **Standalone only, no `NgModule`. No `zone.js`.** Anything that mutates state goes
  through a signal.
- **Built-in control flow** (`@if`, `@for`, `@switch`), never `*ngIf` / `*ngFor`.
- **Every component is `ChangeDetectionStrategy.OnPush`.**
- `input()` / `output()` functions, not decorators. `inject()`, not constructor injection.
- **Templates live in a sibling `.html` file**, never inline (a stray backtick in an inline
  template breaks the build with misleading errors).
- **Dates:** a "day" is a local `YYYY-MM-DD` string in `Australia/Sydney`. Never use
  `toISOString()` to get a calendar date.
- **The browser holds no secrets** and has no way to run the AI. A CI check fails the
  build if a secret-like string appears in `app/dist`, and `check:csp` fails it if `index.html`
  carries inline script or loads an origin missing from the CSP's `connect-src`.
- **Links are never written by the model.** Stories cite article IDs; code attaches URLs
  from fetched feed items.
- **The demo never touches the database.** It uses `DemoEditionSource` and
  `fixtures/demo-edition.json`.
- **Desks are self-contained:** each has fetch, optional Claude step, schema, view and
  demo data. Adding a desk never changes the core.

## Database

- Migrations live in `db/migrations/`, numbered, never edited once applied.
- Every migration ends by inserting its version into private.schema_migrations.
- **RLS on every table, always.** Content readable only when `public.is_member()`;
  personal tables owner-only. `private.members` is never exposed to the Data API.
- **Model output is plain text.** Never render it with `innerHTML`.
- Only the `pipeline_writer` role writes editions and stories.

## Cost

Everything runs on free tiers plus Noel's existing Claude subscription. Anything that
would add a bill needs Noel's explicit OK first.
