# CLAUDE.md

Project instructions live in [`AGENTS.md`](./AGENTS.md). Read that file.

It holds the repo conventions, shared by Claude Code, Cowork and Command Code.
Nothing project-specific belongs here. Two memory files that drift apart are
worse than one.

The source of truth for what First Light is and why:
[`docs/superpowers/specs/2026-10-10-first-light-design.md`](docs/superpowers/specs/2026-10-10-first-light-design.md).

Chronological log of past sessions: [`docs/SESSIONS.md`](./docs/SESSIONS.md).

## Starting a session

```
/session-handoff start
```

The skill lives in `.agents/skills/session-handoff/`, symlinked into
`.claude/skills/` so Claude Code discovers it. Edit the `.agents/` copy.
