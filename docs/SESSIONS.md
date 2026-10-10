# Sessions

<!-- newest first -->

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
