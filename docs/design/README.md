# Design references

The approved mockups, copied from the "First Light mockups" design canvas on 2026-10-13:
https://claude.ai/artifact/HNr91gp2vHBGhoCVyV9RPT (open it to see them rendered and clickable).

| File | Board |
|---|---|
| `mockups/Main.dc.html` | Landing page with the Morning Machine animation (v2: sun rise, source pods, AI core, conveyor) |
| `mockups/Today.dc.html` | Today: sky hero, weather with average range, nudge, Top 3, key dates, section overview |
| `mockups/News.dc.html` | News: section filter chips, story list, detail panel (why it matters, why Claude picked it, coverage) |
| `mockups/Archive.dc.html` | Archive: search form, month calendar with am/pm dots, results |
| `mockups/Mobile.dc.html` | Mobile PWA at 390×844: bottom bar, More sheet |
| `mockups/Later.dc.html` | Phase 2 (Plan from Daybook) and phase 3 (Inbox) |
| `mockups/Type.dc.html` | Typeface options (Google Sans Flex chosen) |
| `mockups/canvas.json` | Canvas layout and board titles |

## How to use them

- The `.dc.html` files need the canvas runtime (`support.js`), so they won't render on their own in a browser. Read them as source: the CSS (clay shadows, radii, colours), the copy and the sample content are exact. For a visual, open the canvas link.
- The Angular app already implements these screens (`app/src/app/`, `app/src/styles/`). Treat the app as the current state and the mockups as the visual target.
- **The spec wins where they differ.** Known drift in the mockups:
  - Section "AU tech jobs" is now **"AU tech market"** (`au-tech-market`).
  - The mobile bottom bar shows an Inbox tab; v1 has **Today, News, Archive, More** only (Inbox joins in phase 3).
  - Some mockup surfaces use `#EEF2F6` / `#FFFFFF`; the app uses the spec tokens (ground `#E9EEF5`, clay `#F5F8FC`), in `app/src/styles/tokens.css`.
  - Politics and World stories are placeholders in the mockups; the demo edition (`fixtures/demo-edition.json`) has the real sample copy.
- Design tokens and rules: spec §6 "Design system" and `AGENTS.md`. The `impeccable` skill in `.claude/skills/` is available for design passes.
