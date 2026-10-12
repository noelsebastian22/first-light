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

## Status

Spec approved. Building the offline v1 on branch `feat/v1-offline` from
`docs/superpowers/plans/2026-10-10-first-light-v1-offline.md` (see its Status section).
Execution ledger with every ruling: `.superpowers/sdd/2026-10-10-first-light-v1-offline/progress.md`
(tracked in git, unlike the rest of `.superpowers/`; it tells executing-plans which tasks are done).

## Setup on a new machine

```bash
git checkout feat/v1-offline        # the build lives here until the final PR
nvm install 24 && nvm use 24        # Node >= 24.15 (Angular CLI 22.2 refuses older)
npm i -g npm@11                     # npm 10.9 crashes resolving Vitest peers
npm install
npx playwright install chromium     # once, for app e2e tests (run from app/)
npm test                            # contracts, pipeline, app unit tests
```

No `.env` is needed until the database and email tasks; `.env.example` lists the names.

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
- Vercel Hobby at `firstlight.noel-sebastian.com` (Cloudflare DNS, grey cloud)

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
  build if a secret-like string appears in `app/dist`.
- **Links are never written by the model.** Stories cite article IDs; code attaches URLs
  from fetched feed items.
- **The demo never touches the database.** It uses `DemoEditionSource` and
  `fixtures/demo-edition.json`.
- **Desks are self-contained:** each has fetch, optional Claude step, schema, view and
  demo data. Adding a desk never changes the core.

## Database

- Migrations live in `db/migrations/`, numbered, never edited once applied.
- **RLS on every table, always.** Content readable only when `public.is_member()`;
  personal tables owner-only. `private.members` is never exposed to the Data API.
- **Model output is plain text.** Never render it with `innerHTML`.
- Only the `pipeline_writer` role writes editions and stories.

## Cost

Everything runs on free tiers plus Noel's existing Claude subscription. Anything that
would add a bill needs Noel's explicit OK first.
