# First Light — design spec

**Date:** 10 October 2026
**Owner:** Noel Sebastian
**Status:** Draft for review
**Mockups:** "First Light mockups" canvas (landing, Today, News, Archive, mobile, phase 2–3, typefaces)

---

## 1. What this is

First Light is a personal morning-briefing web app. Twice a day a scheduled Claude run reads about forty sources, picks what matters to Noel, and publishes an *edition*: weather for Katoomba and Sydney, a one-line nudge, the three things to know, and up to four stories in each of six sections. Noel reads it on his phone on the train or on the desktop.

It has two jobs, and both must succeed:

1. **Daily tool.** Something Noel opens every morning because it is faster and better than scrolling news sites.
2. **Portfolio piece.** A public, well-engineered Angular 22 project with a distinctive claymorphism design that shows senior frontend, design and AI-integration skill.

### Success criteria

- An edition is ready by 5:35am and 4:05pm Sydney time on at least 95% of days, and Noel is emailed whenever one is missing.
- Every story links to a real publisher article; no link is ever written by the model.
- The public site shows a complete, clickable demo without exposing any personal data or any way to run the AI.
- Running cost is **$0** beyond Noel's existing Claude subscription.
- Lighthouse PWA, accessibility and performance scores of 90+ on the Today screen.

### Out of scope for version 1

Plan (Daybook tasks), Inbox (email catch-up), push notifications, dark mode, multiple users, editing sources from the UI.

---

## 2. Decisions log

| Topic | Decision |
|---|---|
| Name and address | First Light, `firstlight.noel-sebastian.com` |
| Users | Noel only, but data is stored per user so others could be added later |
| Front end | Angular 22, standalone, zoneless, signals-first, installable PWA, hosted on Vercel Hobby |
| Design | Full claymorphism; Google Sans Flex (rounded axis on headings) with JetBrains Mono for labels |
| Database and auth | Neon free plan: Postgres, Neon Auth (Google sign-in), Data API with row-level security |
| AI | A Claude Code **routine** on Noel's subscription (no API bill), at 5:30am and 4:00pm daily |
| Non-AI automation | GitHub Actions in a **public** repo: CI, missed-run watchdog, 8am nudge, monthly compaction |
| Sections | AU economy, AU politics, World, Web dev (includes search/SEO), AI, AU tech jobs; max 4 stories each |
| Afternoon edition | Only what is new or changed since the morning, flagged "New since 5:31" |
| Weather | Open-Meteo; Katoomba and Sydney CBD always shown; today's range against the month's average |
| Nudge | One short AI line written from the edition, weather and key dates; no generic motivation |
| Read and saved state | Synced across devices through the database |
| Notifications | No "edition ready" alert. Email on a missed run. Email at 8:00am every day if the app hasn't been opened |
| Archive | Full stories for 12 months, then a headline index kept forever; saved stories kept in full |
| Demo | Hand-written sample edition in the repo, used by the public landing page and demo screens |
| Credit | "Edited by Claude" in small print only (landing footer, Today fine print) |
| Cost | $0 beyond the existing Claude subscription |

---

## 3. Architecture

```
 5:30am / 4:00pm  Claude Code routine (Noel's subscription, Anthropic cloud)
                  └─ clones the repo, runs pipeline/ commands
                     fetch → prepare → Claude edits → validate → write
                                                      │
                                                      ▼
                                       Neon Postgres (free plan)
                                       Neon Auth (Google), Data API, RLS
                                                      │
                                                      ▼
            Angular 22 PWA on Vercel  ──  firstlight.noel-sebastian.com
            Public: landing + demo (fixture data, never touches the database)
            Signed in: Today · News · Archive

 GitHub Actions (public repo, free)
 ├─ on push / PR: lint, type-check, Vitest, Playwright, pipeline snapshot tests
 ├─ 6:15am and 4:45pm: watchdog → email if the edition is missing or failed
 ├─ 8:00am daily: nudge → email the Top 3 if the app hasn't been opened today
 └─ 1st of each month: compaction of stories older than 12 months
```

**Rules that hold everywhere**

- Only the pipeline writes editions and stories, through its own database role.
- The browser holds no secrets. It reads through the Data API with the signed-in user's token; row-level security decides what it sees.
- The demo is a separate data source compiled into the app. It cannot reach the database.
- Each *desk* (Weather, News; later Plan, Inbox) lives in its own folder with a fetch step, an optional Claude step, a schema, a view and demo data. Adding a desk never changes the core.

### Repository layout (npm workspaces)

```
first-light/
├─ app/                 Angular 22 PWA
├─ pipeline/            Node 22 + TypeScript: fetch, prepare, validate, write, watchdog, nudge, compact
├─ contracts/           Zod schemas + TypeScript types shared by app and pipeline (Edition, Story, Weather…)
├─ db/                  SQL migrations, RLS policies, seed data, RLS tests
├─ fixtures/            demo edition JSON + recorded feed snapshots for tests
├─ .github/workflows/   ci.yml, watchdog.yml, nudge.yml, compact.yml, keepalive.yml
└─ docs/                this spec, ADRs, routine prompt, runbook
```

---

## 4. Data model (Neon Postgres)

### Content (written only by the `pipeline_writer` role)

| Table | Key columns |
|---|---|
| `sources` | `id`, `name`, `feed_url`, `domain`, `default_section`, `active` |
| `editions` | `id`, `edition_date` (date, Sydney), `slot` (`am`/`pm`), `status` (`ok`/`partial`/`failed`), `nudge`, `weather` (jsonb), `top_story_ids` (int[]), `source_count`, `created_at` — unique on (`edition_date`, `slot`) |
| `stories` | `id`, `edition_id`, `section` (enum of six), `rank`, `title`, `summary`, `why_it_matters`, `picked_because`, `new_since_am` (bool), `compacted` (bool), `search` (generated tsvector over title + summary), `created_at` |
| `story_links` | `story_id`, `source_id`, `url`, `publisher_title`, `published_at` — URLs come from fetched feed items only |
| `key_dates` | `id`, `date`, `time_local`, `label`, `source_name`, `url` |

### Personal (one row per user)

| Table | Key columns |
|---|---|
| `members` | `user_id`, `email`, `added_at` — the allowlist; Noel only at launch |
| `reads` | `user_id`, `story_id`, `read_at` |
| `saves` | `user_id`, `story_id`, `saved_at` |
| `app_opens` | `user_id`, `opened_at` |

### Row-level security

- Content tables: `SELECT` allowed only when `auth.user_id()` is in `members`. No `INSERT/UPDATE/DELETE` for app users.
- `reads`, `saves`, `app_opens`: a user can select, insert and delete only rows where `user_id = auth.user_id()`, and only if they are a member.
- A stranger who signs in with Google gets an account but sees nothing, and the app shows "This is a private edition. Explore the demo instead."
- Roles: `pipeline_writer` (writes content only), `watchdog_reader` (read-only on `editions`, `stories` and `app_opens`; used by the watchdog and nudge workflows), and the Data API's authenticated role for the app.

### Compaction (monthly)

Stories older than 12 months that are not in anyone's `saves`: set `summary`, `why_it_matters` and `picked_because` to null and `compacted = true`. Title, section, date and links stay forever, so archive search still finds them.

---

## 5. Pipeline

TypeScript in `pipeline/`, run by the routine with plain `npm` commands so it can also run on a laptop or in GitHub Actions.

| Step | Who | What |
|---|---|---|
| 1. Fetch | Code | Pull active RSS/Atom feeds in parallel with timeouts; Open-Meteo forecast for Katoomba and Sydney plus the monthly average from its climate data; load `key_dates`. Every article gets a short ID. |
| 2. Prepare | Code | Normalise URLs, drop duplicates by URL and near-identical titles, drop anything published in the last 48 hours of editions. The 4pm run keeps only items published since the morning run. Write `candidates.json` with IDs, titles, snippets, publisher and section hint. |
| 3. Edit | Claude (the routine) | Read `candidates.json` and the editorial brief in `docs/routine-prompt.md`; write `edition.json`: up to 4 stories per section, each with title, summary, why it matters to Noel, why it was picked, and the article IDs it is based on; the Top 3 (story references); the nudge. |
| 4. Validate | Code | Zod schema check; every cited ID exists in candidates; ≤ 4 per section; Top 3 come from the stories; text lengths within limits; no URLs in model text. Links are attached from the cited IDs. On failure Claude gets the error list and retries, at most twice. |
| 5. Write | Code | One transaction: insert the edition, stories and links; set `status`. A partial edition (for example, one feed group failed) is written with `status = partial`. |
| 6. Report | Claude (the routine) | On any failure, email Noel through the Gmail connector with the step that failed and the error. |

**Editorial rules for step 3** (kept in `docs/routine-prompt.md`): prefer primary sources (RBA, ABS, Treasury) and Australian outlets for Australian stories; separate fact from opinion; say so when sources disagree; write summaries in Claude's own words with no quoted article text beyond a short phrase; skip a section with no material story rather than padding; the nudge must reference something real in today's edition, weather or dates.

**Routine setup:** schedule at 5:30am and 4:00pm Sydney (entered as 5:32 and 4:02 to avoid the top-of-hour delay); environment with custom network access allowing the feed domains, `api.open-meteo.com`, the Neon host and npm; the Neon connection string for `pipeline_writer` stored as a network secret; only the GitHub and Gmail connectors included.

**Initial sources:** RBA media releases and speeches, ABS (via key dates), ABC Business, Politics, World and Top Stories, SBS Australia and World, The Conversation (Business, Politics), Reuters via Google News, iTnews, Startup Daily, JavaScript Weekly, Frontend Focus, Angular Blog, Chrome for Developers, Search Engine Roundtable, Hacker News front page (≥150 points), smol.ai AI News, Simon Willison, Techmeme, and the OpenAI, Google DeepMind and Hugging Face blogs.

---

## 6. Front end

### Routes

| Route | Access | Notes |
|---|---|---|
| `/` | Public | Landing page with the Morning Machine animation, security notes, "Built with" and the credit |
| `/demo/today`, `/demo/news`, `/demo/archive` | Public | The real screens fed by the demo edition |
| `/signin` | Public | Google sign-in through Neon Auth |
| `/today`, `/news`, `/news/:storyId`, `/archive` | Members | Guarded by an auth guard; non-members are sent to `/demo/today` with a short note |

### How the Angular features earn their place

- **Dependency injection for data sources:** an `EDITION_SOURCE` token with `DemoEditionSource` (fixtures) and `NeonEditionSource` (Data API). The same components run the demo and the real app.
- **Route resolvers:** load the edition before Today and News render, so there is never a half-drawn page.
- **`httpResource`:** live weather refresh between editions, with loading and error states as signals.
- **`rxResource`:** polls for the afternoon edition every 10 minutes after 4:00pm while the app is open.
- **Signals, `computed`, `linkedSignal`:** section filters, read/unread counts, selected story.
- **Signal Forms:** archive search and filters, and on-device preferences (reduce motion, reading density).
- **`@defer`:** the Morning Machine and the sky illustrations load after the first paint.
- **Service worker:** caches the app shell and the latest edition so the app opens offline on the train.

### Navigation

- Desktop: a collapsible side drawer (icons only when collapsed).
- Mobile: a bottom bar with at most five slots — Today, News, Archive and More in version 1; Inbox takes a slot in phase 3. Everything else lives in the More sheet.

### Design system

- Tokens as CSS custom properties: ground `#E9EEF5`, clay surface `#F5F8FC`, ink `#0E1A2B`, secondary ink `#44546A`, primary `#3E6FA3`, sun `#E8833A`, and six pastel section colours.
- Three surface recipes: raised clay, pressed (inputs, wells) and pill. Long lists use a lighter shadow for performance.
- Text stays near-black on light surfaces to meet WCAG AA; colour lives in fills.
- All animation respects `prefers-reduced-motion` and the in-app "reduce motion" preference.
- Light mode only in version 1.

### Morning Machine (landing)

Sun rises over clay hills → six source pods light up → messy story cards tumble into an AI core → the core "thinks" → cards leave one by one on a conveyor, sorted by section, into the edition's slots → weather tile pops in → "Morning edition ready". Built with CSS keyframes and custom properties; paused off-screen; a static final frame for reduced motion.

---

## 7. Security, privacy and operations

- **No AI endpoint exists.** The AI only runs inside the routine. The browser bundle contains no keys; a test fails the build if a secret-like string is found in `app/dist`.
- **Auth:** Google sign-in via Neon Auth. Membership, not sign-in, grants access.
- **Secrets:** routine network secret (pipeline writer connection string); GitHub Actions secrets (watchdog reader connection string, Gmail address and app password for emails). Nothing in the repo; a `.env.example` documents the names.
- **Emails** (GitHub Actions, via Gmail SMTP with an app password):
  - *Missed or failed edition* at 6:15am and 4:45pm, with the latest status and a link to the routine runs page.
  - *Daily nudge* at 8:00am when there is an edition and no `app_opens` row for today: the Top 3 headlines and a link.
- **GitHub keeps scheduled workflows alive** only while the repo has activity; a `keepalive.yml` workflow prevents them from being disabled after 60 quiet days.
- **Copyright:** short summaries in Claude's words, always linked to the publisher; no full text stored; paywalls never bypassed. The public demo uses hand-written sample content.
- **Data retention:** as in section 4.

---

## 8. Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | Signals and computed state, resolvers, data-source services, Zod contracts, pipeline helpers (dedupe, URL normalising, link building) |
| Pipeline snapshots | Vitest + recorded feeds in `fixtures/feeds/` | Fetch → prepare produces stable candidates; validator rejects missing IDs, invented URLs, over-full sections and bad Top 3 |
| Database | SQL test script on a Neon branch | Non-members see nothing; members see content; users only see their own reads and saves; app role cannot write content |
| End to end | Playwright | Landing loads and the animation honours reduced motion; demo Today → News filter → story detail → save; archive search; offline reload shows the cached edition; mobile bottom bar and More sheet |
| Accessibility | Playwright + axe | No serious violations on landing, Today, News and Archive |

CI runs everything except the database tests on every push; database tests run against a throwaway Neon branch when `db/` changes.

---

## 9. Build order

1. **Foundations:** repo, workspaces, contracts, design tokens, CI.
2. **Demo first:** landing with the Morning Machine, plus Today, News and Archive on the demo edition. Deploy to Vercel. This is already a working portfolio piece.
3. **Database and sign-in:** Neon project, migrations, RLS, Neon Auth, `NeonEditionSource`, reads and saves sync.
4. **Pipeline:** fetch, prepare, validate, write; the routine prompt; a manual run end to end; then the schedule.
5. **Operations:** watchdog, nudge and compaction workflows; failure emails.
6. **PWA polish:** offline edition, install prompt, Lighthouse pass, README and portfolio write-up.

Later: Phase 2 Plan (read-only Daybook tasks through its MCP server), Phase 3 Inbox (Gmail and Zoho summaries, sender + summary only).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Routines are a research preview and may change | The pipeline is plain npm commands; switching the AI step to the Claude API in GitHub Actions is a config change if ever needed |
| A run hits the subscription usage limit | Runs are small; the watchdog emails if an edition is missing |
| Neon's free compute sleeps after 5 minutes | The routine wakes it; the app shows the cached edition first, so a short wake-up delay is hidden |
| A feed changes or dies | Per-feed timeouts; partial editions are still published; the run report lists failed feeds |
| Free tiers change | Small, separate pieces (contracts, data-source token, plain SQL) keep each provider swappable |
| Gmail app passwords need 2-step verification | One-time setup step for Noel |
