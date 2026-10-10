---
name: session-handoff
description: Record what happened this session into docs/SESSIONS.md so the next session — in Cowork, Claude Code or Command Code — can pick up cleanly. Use when the user says "wrap up", "handoff", "log this session", "I'm done for today", or before ending a work session. Also use at the START of a session to read the last entry and re-establish context.
argument-hint: "[start|end] (defaults to end)"
---

# Session handoff

First Light is built across agents and surfaces — Cowork, Claude Code, Command Code — used
interchangeably. None of them can see another's conversation history. `docs/SESSIONS.md`
is the only shared memory. It is not a changelog; git already does that. It records
**intent, dead ends, and open threads** — the things that live in a conversation and die
with it.

## Mode: start

Run when opening a session.

1. Read the **first entry** in `docs/SESSIONS.md` (newest is at the top).
2. Read `AGENTS.md`, the design spec in `docs/superpowers/specs/`, and the **status**
   section of the current plan in `docs/superpowers/plans/` (if one exists).
3. Run `git log --oneline -10` and `git status --short` to see what actually landed
   versus what the last entry claimed.
4. If the Neon MCP is connected, list the applied migrations and compare against
   `db/migrations/`. The live project is the truth; the folder can lag.
5. Report back in three lines: where things stand, what the last session left open, and
   what you propose doing now. Then stop and wait — do not start work off the log alone.

If the log's "Next" and the git state disagree, say so. That gap is the most useful thing
the log produces.

## Mode: end (default)

Run before finishing. Do not skip steps because the session felt small.

### 1. Gather the facts

Run these and read the output — do not write the entry from memory:

```bash
git log --oneline "$(git log -1 --format=%H --before=@{6.hours.ago} 2>/dev/null || echo HEAD~10)"..HEAD 2>/dev/null | head -30
git status --short
git diff --stat HEAD
npm run build --workspace app 2>&1 | tail -12
npm test --workspaces --if-present 2>&1 | tail -12
```

Record the real bundle size and the real test count. If a build or test run was not
done this session, say that rather than quoting the last known numbers.

If the schema changed, list migrations on the Neon MCP and note what applied.
If the pipeline or routine prompt changed, note whether a manual routine run was done
and what it produced.

### 2. Write the entry

Prepend to `docs/SESSIONS.md`, directly under the `<!-- newest first -->` marker. Never
append to the bottom, never edit a previous entry — if something in an old entry turned
out wrong, say so in the new one.

Use exactly this shape:

```markdown
## YYYY-MM-DD · <agent> · <2–5 word topic>

**Did**
- Terse, factual, one line each. What changed and where.

**Decided**
- Only decisions that outlive this session. Include the reasoning, briefly.
- Omit this section entirely if nothing was decided.

**Didn't work**
- Approaches tried and abandoned, and why. This is the highest-value section —
  it is what stops the next agent burning an hour rediscovering the same wall.
- Omit if genuinely nothing was abandoned.

**Open**
- Unfinished threads, known-broken things, questions for Noel.
- Say "nothing open" rather than deleting the heading.

**Next**
- The single most sensible next action, specific enough to start from cold.

**Touched** — `path/one.ts`, `path/two.sql`
```

`<agent>` is `cowork`, `claude-code` or `command-code`. Get the date from `date +%F`, not
from memory.

### 3. Rules for the entry

- **Terse.** Six lines beats sixteen. If it reads like prose, cut it.
- **No praise, no summary of how well it went.** Facts only.
- **Name files and functions**, not vague areas. "Fixed the pipeline" is useless;
  "made `validateEdition()` reject story IDs missing from `candidates.json`" is usable.
- **Record the false starts.** An entry with no "Didn't work" section on a hard session
  is a sign the entry is too shallow.
- **Any decision that outlives the session goes in the design spec too** (its
  Decisions log). The session log records that a decision was made; the spec records
  what the decision *is*. Do not let them drift.
- If a change contradicts `AGENTS.md`, update that file in the same commit.

### 4. Update the plan

If an implementation plan exists in `docs/superpowers/plans/`, tick off finished tasks
and add newly discovered ones in the same commit. The plan is current state; the log is
history. The plan is the one that goes stale silently.

### 5. Commit

```bash
git add -A && git commit -m "session: <same topic as the entry heading>"
```

Do not push unless asked.

## Keeping the file usable

Once `docs/SESSIONS.md` passes roughly 40 entries, fold everything older than the current
milestone into a single `## Archive — <period>` block at the bottom, keeping only the
Decided and Didn't-work lines. Never delete a "Didn't work" line.
