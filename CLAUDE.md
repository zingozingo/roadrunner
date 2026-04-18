## How We Work

### Two Modes

**Interactive mode:** Steven directs work in real-time. Normal session flow — diagnose, plan, implement one chunk at a time, verify. Steven provides context, makes judgment calls, and steers priorities. Work happens in chunks with verification after each.

**Task mode:** Steven has prepared a task plan document. Task mode activation:

1. Read `docs/plans/active.md` — it contains the full task list
2. Read all docs listed in "Before Any UI/UX Work" section above
3. Work through tasks in order — each task has scope, intent, context, and done-when
4. After EVERY task, before reporting ready for the next task:
   a. `npx tsc --noEmit` — must pass clean
   b. `npx vitest run` — all tests must pass
   c. `bash scripts/ui-audit.sh` — must pass clean
   d. If the task involved ANY UI changes: create a dated screenshot subfolder (`.claude/screenshots/{date}-{phase-or-task}/`), screenshot all changed pages at 1440, VIEW each screenshot, compare against `.claude/references/` for quality bar, and report what looks good, what looks off, and what you fixed. If something looks off, fix it before committing.
   e. If the task involved interactive behavior changes: run interaction tests via `scripts/interact.ts` to verify flows work
   f. Review what you built — if you established a reusable pattern, update SKILL.md with the pattern name, implementation, where it's used, and why it works. If you improved on an existing SKILL.md pattern, update it in place.
   g. `git commit` with a descriptive message
5. Do not skip ahead — complete and verify one task before starting the next

**Never skip step 4. The verification sequence and visual review are not optional. A task is not complete until all checks pass and any visual issues are fixed.**

In both modes, all rules below apply.

### Before Any UI/UX Work

Read these documents in this order before touching any UI code:
1. `docs/north-star.md` — The vision: what Roadrunner should become, page specs, UX standards, design principles, anti-patterns
2. `.claude/roadrunner-frontend/SKILL.md` — The frontend design system: tokens, components, patterns. This is a LIVING document — update it as you establish new patterns during implementation
3. `.claude/roadrunner-backend/SKILL.md` — The backend architecture: three-layer architecture, data layer, services, validation, sync patterns
4. `docs/entity-model.md` — The schema: tables, FK cascades, Airtable field IDs, ring model. This is your reference for what data exists and how entities connect
5. `.claude/references/ui-ux-best-practices.md` — Interaction patterns: button states, loading, errors, undo, navigation safety, dark theme, spacing, feedback timing

### Path Guardrails — Minimum Necessary Changes

The agent has write access to the entire codebase but must exercise judgment about scope. The rule: make the minimum changes necessary to accomplish the task, and be especially careful with core infrastructure.

**High confidence — change freely:**
- `src/app/` — page components, layouts (NOT `src/app/api/`)
- `src/components/` — UI components
- `src/app/globals.css` — styling
- `scripts/` — tooling
- `docs/` — documentation
- `.claude/` — design system docs, references, screenshots

**Medium confidence — change when the task requires it, note in commit message:**
- `src/app/api/` — API routes (adding fields, validation, error handling)
- `src/lib/` — business logic (extending functions, adding parameters)
- `src/lib/__tests__/` — adding or updating tests to match changes

Always read the existing file thoroughly before modifying any medium-confidence file. Always run the full test suite (`npx vitest run`) after changes to core logic. If a change touches medium-confidence files, the commit message must note which lib/api files were changed and why.

**Requires Steven's explicit approval — never change autonomously:**
- `supabase/migrations/` — schema changes need sequential numbering and Steven's sign-off
- `.env`, `.env.local` — environment config
- Core architectural patterns (new tables, new AI calls, new sync directions)

When in doubt, the task plan will specify which files need modification. If you discover mid-task that a file outside your expected scope needs changes, note it and proceed if the change is small and clearly correct. If it's significant, flag it in your task completion report.

### Git Branching & PR Workflow

Plan execution uses feature branches for visibility and safe iteration.

**At plan start:**
1. Ensure you're on `main` and it's clean: `git checkout main && git pull`
2. Create a plan branch: `git checkout -b plan-{number}/{short-name}` (e.g., `plan-3/daily-driver-mvp`)

**After the first task:**
1. Commit and push: `git add -A && git commit -m "feat: {task description}" && git push -u origin plan-{number}/{short-name}`
2. **STOP and report to Steven:** "First task committed and pushed to `plan-{number}/{short-name}`. Ready for you to create the draft PR on GitHub."
3. Wait for Steven to confirm the draft PR is created before continuing.

**Ongoing execution:**
- Each completed task gets its own commit with a descriptive message
- Push after each task so the PR stays current
- Steven can review incremental progress in the draft PR at any time

**At plan completion:**
- Final push, then Steven reviews and merges the PR on GitHub

**Branch naming convention:** `plan-{number}/{short-kebab-description}`
**Commit convention:** One commit per task. `feat:` for new functionality, `fix:` for bug fixes, `refactor:` for restructuring, `docs:` for documentation-only changes.

### Verification Tools

These tools are available for visual and mechanical verification of UI work:

- `npx tsx scripts/screenshot.ts /path 1440` — Screenshots a page at the given viewport width. Saves PNG to `.claude/screenshots/`. Use to visually verify layout, spacing, and content rendering.
- `npx tsx scripts/interact.ts '[...]'` — Runs a JSON interaction sequence against localhost:3000. Supported actions: `goto`, `click`, `fill`, `wait`, `wait_for`, `screenshot`, `assert_visible`, `assert_hidden`, `assert_text`, `assert_url`. Use to test UX flows: button clicks, loading states, navigation safety, form behavior. Auto-screenshots on failure.
- `bash scripts/ui-audit.sh` — Mechanical code checks scoped to `src/app/` and `src/components/`: no hardcoded hex colors, no off-scale spacing (only 4/8/12/16/24/32), no inline styles, no console.log, no TODO/FIXME. Must pass clean after every task.

### Verification Sequence

Run this after every task (task mode) or after every significant chunk (interactive mode):

1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — all tests pass
3. `bash scripts/ui-audit.sh` — all mechanical checks pass
4. `npx tsx scripts/screenshot.ts` — visual verification at 1280 and 1440
5. `npx tsx scripts/interact.ts` — test key interaction flows for changed pages

### Screenshot Organization

At the start of any task-based run, create a dated subfolder in `.claude/screenshots/`:
`.claude/screenshots/{YYYY-MM-DD}-{description}/`
All screenshots for that run go in the subfolder. Never delete previous run folders — they serve as "before" comparisons for future passes.

All screenshots go in `.claude/screenshots/` — never create other directories like `.claude/audit/` or `.claude/captures/`. One location, always organized by dated subfolders.

### Reference Material

`.claude/references/` contains permanent design inspiration — screenshots from enterprise apps and best-practice documentation. Read `.claude/references/references.md` for guidance on what to learn from each reference.

Before any UI work, view the reference screenshots to calibrate your quality bar. These are inspiration, not templates — learn the principles, don't copy layouts.

### UI/UX Working Principles

These apply to all UI work in both modes:

- **Before implementing any page**, identify every state it can be in: loading, loaded, empty, partial data, error, mid-mutation, unsaved changes. Implement each state deliberately.
- **All spacing uses the 4px scale:** 4/8/12/16/24/32. No other values.
- **Dark theme only.** All colors use CSS custom properties defined in `globals.css`.
- **Data fetching:** use server components with parallel Supabase queries (existing pattern). Don't create new API routes for read operations.
- **Delete, don't stub.** When removing a page or component, delete the file entirely. No dead code.
- **The design system drives everything.** SKILL.md is not documentation — it's the authority on how things look and behave. There are two modes of working with it:

  **When a task is structural or creative** (redesigning a page layout, rethinking how data is presented, building a new interaction pattern): Think about the design system FIRST. Before writing code, ask: "What pattern am I establishing here? Is there an existing pattern in SKILL.md I should follow, or does this task require a new/better one?" If you're creating something new, write the pattern into SKILL.md BEFORE implementing it across pages. If you find a better approach than what SKILL.md currently describes, UPDATE the existing pattern in-place with the improvement and your reasoning. The goal is patterns that are as universal as possible — a pattern for "how collapsible sections work" should apply everywhere sections collapse, not just on one page.

  **When a task is a minor fix or routine change** (fixing a typo, adjusting a number, swapping a label): Follow SKILL.md exactly. Don't innovate. Match the existing patterns precisely. Consistency is the goal, not creativity. If something looks wrong but matches SKILL.md, flag it — don't silently deviate.

  **The test:** After every task, SKILL.md should either be unchanged (because you followed existing patterns) or better (because you evolved a pattern with reasoning). It should never be stale — if you built something that doesn't match what SKILL.md says, either your code or SKILL.md is wrong. Fix whichever one is wrong.
- **Enterprise UX is non-negotiable:** explicit loading states, navigation safety for unsaved changes, confirmation dialogs for destructive actions, professional button labels. See North Star Part 7.

### Tool Usage Expectations

These tools exist in the project. Use them proactively — don't wait to be asked.

**Playwright Screenshots (`scripts/screenshot.ts`):**
- After ANY task that changes what a page looks like: screenshot it at 1440. View the screenshot. Compare against `.claude/references/` for quality bar.
- When debugging a visual issue: screenshot before and after to confirm the fix.
- Screenshots go in `.claude/screenshots/{date}-{description}/` — create the subfolder at the start of each task run.

**Playwright Interaction Tests (`scripts/interact.ts`):**
- After ANY task that changes interactive behavior (button clicks, form submissions, navigation, loading states): write and run an interaction test.
- Test the happy path AND the edge cases (what happens on error? what happens if you click twice? what happens if you navigate away?).
- If a test fails, it auto-screenshots the failure state. View that screenshot to diagnose.

**UI Audit (`scripts/ui-audit.sh`):**
- Run after EVERY task that touches UI code. No exceptions.
- If it flags violations, fix them before committing. Zero violations is the baseline.

**Reference Material (`.claude/references/`):**
- Before starting UI work: view at least 2 reference screenshots and read `ui-ux-best-practices.md`.
- These set the quality bar. If your output doesn't feel as polished as the references, keep iterating.

**The principle:** These tools are not optional verification steps — they're how you do the work. A task that changes UI without screenshots is incomplete. A task that changes interactions without testing is incomplete. Build the habit of using them as part of implementation, not as an afterthought.

### Task Plans

When operating in task mode, the current task plan lives at `docs/plans/active.md`. This document is replaced each time a new plan is created. It contains:
- Business context — who uses the app and how
- Ordered task list with scope, intent, context, and done-when criteria per task
- Mid-task self-check protocol
- Verification requirements

Not every session uses task mode. When working interactively, ignore `docs/plans/active.md` unless Steven specifically references it.

**When a plan is fully completed:**
1. Run the final verification sequence across the entire app
2. Append a "## Completion Summary" section to the active plan file: what was accomplished across all phases, total stats change (before/after), total decisions logged, pre-existing issues noted for future work
3. Move `docs/plans/active.md` to `docs/plans/archive/{date}-{name}.md`
4. Replace `docs/plans/active.md` with the empty placeholder
5. Update `docs/goal-state.md` with the new current state

Completed plans are kept for reference but never re-executed.

### Session Management

Session templates and summaries live in `docs/sessions/`:

```
docs/sessions/
├── templates/
│   ├── diagnostic.md             # "Run the diagnostic" — Claude Code reads and executes
│   ├── plan-template.md          # Plan structure — task format, verification, checkpoints
│   ├── plan-completion.md        # Zero-edit plan closeout — paste into Claude Code after any plan
│   ├── plan-startup.md           # Plan execution startup — paste into Claude Code to begin
│   ├── session-start.md          # Steven pastes into Claude.ai at session start
│   └── session-end.md            # Steven pastes into Claude.ai when wrapping up
└── summaries/
    └── {date}-{name}.md          # One per session, written during session end
```

**When Steven says "run the diagnostic":** Read `docs/sessions/templates/diagnostic.md` and execute every step. Output results in the format specified.

**When creating a task plan:** Reference `docs/sessions/templates/plan-template.md` for the required plan structure — task format, pre-flight steps, verification protocol, and checkpoint expectations.

**When running an end-of-session command:** Write the session summary to `docs/sessions/summaries/{date}-{name}.md`. The summary format and content requirements are specified in the command Steven provides.

---

# Roadrunner (Relay)

> AI-powered partner engagement management for AWS PDMs. Forward emails → human-guided routing → AI synthesis → structured engagements → Airtable sync.
> Current stats in `docs/goal-state.md`

---

## What This Is

Roadrunner turns scattered partner email threads into structured, trackable engagement records. A PDM forwards a partner email to `relay.stevenromero.dev` → Mailgun webhook receives it → Claude AI classifies it, extracts participants, links it to known programs/events/relationships → everything surfaces on a dashboard where you manage partner engagements. Forwarding an email is the only input required. Built for Steven Romero, PDM at AWS, managing ~20 ISV partner relationships. Deployed on Vercel at roadrunner-fawn.vercel.app.

---

## Key Terminology

See `docs/entity-model.md` for complete entity definitions, schema, FK cascades, and Airtable field IDs.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless on Vercel) |
| Database | Supabase PostgreSQL |
| AI | Anthropic Claude Sonnet 4 |
| Email Ingestion | Mailgun (inbound webhook) |
| Partner Data | Airtable (REST API, bidirectional sync) |
| Deployment | Vercel |
| Domain | relay.stevenromero.dev |

---

## Directory Layout

```
src/
├── app/              # Next.js App Router — pages + API routes
│   ├── api/          #   API routes grouped by entity (engagements, meetings, partners, etc.)
│   └── {resource}/   #   UI pages — list (page.tsx) + detail ([id]/page.tsx)
├── components/       # React components organized by concern (actions, layout, notes, partners, shared)
├── hooks/            # React hooks (useFilterParam, useNavigationGuard)
└── lib/              # Core business logic
    ├── db/           #   Database layer — all Supabase queries live here
    ├── sync/         #   Airtable sync engine (pull.ts, push.ts, field-maps.ts)
    └── __tests__/    #   Vitest test suites
supabase/migrations/  # Sequential SQL migrations — check latest number before adding
scripts/              # Playwright screenshots, interaction tests, UI audit, backfill scripts
docs/                 # Project documentation (see Documentation Map below)
```

---

## Data Flow — Email to Dashboard

```
1. USER FORWARDS EMAIL
   ↓
2. MAILGUN WEBHOOK → POST /api/inbound
   Receives raw email (body-plain, headers, calendar attachments)
   ↓
3. EMAIL PARSER (email-parser.ts)
   Extracts: sender, recipients, subject, body, forwarded content
   Strips: quoted replies, signatures, forwarding headers
   ↓
4. ICS PARSER (ics-parser.ts) — if calendar data present
   Extracts: meeting title, date, time, location, attendees, UID
   Source: Mailgun body-calendar field (NOT file attachments)
   ↓
5. MESSAGE STORED (db/messages.ts)
   Raw email saved to messages table with parsed metadata
   Per-message fingerprint dedup (sender_email + body prefix)
   ↓
6. PARTNER DETECTION (partner-detection.ts)
   Mechanical domain matching against contact registry
   Sets partner_id on message — no AI involved
   ↓
7. INBOX (messages WHERE engagement_id IS NULL)
   Messages appear in Inbox UI grouped by forwarded_at (5s window)
   PDM chooses: Assign to existing engagement, Create new, or Discard
   ↓
8. AI SYNTHESIS (classifier.ts → synthesizeIntoEngagement)
   Full thread history → deep analysis via Claude API
   Returns: current_state, participants, entity links, pillar, topic, goal
   ↓
9. PERSIST (classifier.ts → persistClassificationResult)
   Single function handles assign-existing, create-new, and merge paths:
   - Create or update engagement (current_state, topic, goal, pillar)
   - Upsert participants + link to engagement
   - Link engagement↔programs, engagement↔events
   - Create meetings (if ICS data present)
   - Link message to engagement
   ↓
10. SYNC TO AIRTABLE (sync/push.ts — awaited)
    Push: engagements → Partner Engagements table
    Push: meetings → Meetings table
    Pull: partners, programs, events ← catalog tables
    ↓
11. DASHBOARD (Next.js pages)
    Server components query Supabase directly
    Client components use API routes for mutations
```

---

## Data Ownership

Airtable owns **catalog** (Ring 1: Partners, Programs, Events) and **posture** (Ring 3: Partner Goals, Program Enrollments, Event Participations, MPOPP Funding, MDF Funding). Roadrunner owns **activity** (Ring 2: Engagements, Meetings, Notes, Tasks, Messages, Participants, Partner Context). See `docs/entity-model.md` for the complete schema with FK cascade behaviors and Airtable field IDs.

---

## Core Principles

These are **NON-NEGOTIABLE**. Every code change must respect these:

1. **Email-in, insight-out** — The user never leaves Outlook to feed the system. Forwarding is the only input.
2. **Human routes, AI synthesizes** — The PDM decides where emails go. AI handles deep analysis only after routing.
3. **Summaries are the product** — Raw emails are stored but never the primary view. `current_state` is the living output.
4. **Connect, don't create** — The AI is biased toward linking to existing entities, never fabricating new ones. Empty arrays over hallucinated matches.
5. **AI creates engagements only** — Programs, events, and partners are human-curated catalog data.
6. **Data ownership boundary** — Airtable owns catalogs (pull only). Roadrunner owns activity (push only). Never cross the boundary.
7. **Single source of truth per concern** — `contact-parser.ts` for contact format, `user-config.ts` for PDM identity, `field-maps.ts` for Airtable field IDs, `types.ts` for TypeScript types. Don't scatter.
8. **Await all async operations** — No fire-and-forget. Vercel serverless kills processes after HTTP response. An unawaited promise WILL be silently murdered (this happened in production — decisions.md #89).
9. **One persistence path** — Assign-existing, create-new, and merge all share `persistClassificationResult()`. No divergent code paths.
10. **Structured over freeform** — Categorization uses pillar, program links, and relationship links — not free-form labels.
11. **Resolve, don't duplicate** — Every piece of data has one authoritative home. Everything else references it.
12. **Partner is gravity** — Everything orbits the partner. Delete a partner, cascade everything.
13. **Design before code** — For UI work, solve the design problem before writing JSX.

---

## API Route Patterns

**Server Components (reads):** List and detail pages query Supabase directly via server-side functions in `db/`. No API route involved — the component IS the server.

**Client Components (writes):** Action buttons, forms, and mutations call API routes. Routes are thin wrappers: validate input → call service function → format response. Business logic lives in `src/lib/` service files, not in routes.

**External Webhooks:** `/api/inbound` (Mailgun) and `/api/health` (monitoring) are called by external services, not the frontend.

**No stubbed routes.** The old `/api/classify` 410 stub was removed in Phase D cleanup.

**All Supabase queries live in `src/lib/db/`.** No direct `supabase.from()` or `getSupabaseClient()` calls outside `src/lib/db/` and `src/lib/sync/`. API routes, page files, and library files import db functions instead. This is a project rule enforced by Plan 6 — 57 rogue queries were extracted into 46 new db functions.

**Three-layer architecture (Plan 7):** UI → thin API routes → service functions → db layer → Supabase. The 5 largest routes (inbound, reviews/resolve, engagements/merge, engagements/[id]/reassign, meetings/[id]) delegate business logic to dedicated service files: `inbound-pipeline.ts`, `inbox-resolver.ts`, `engagement-merge.ts`, `engagement-manager.ts`, `meeting-recurrence.ts`. Routes handle HTTP concerns only (request parsing, validation, response formatting).

---

## Development

### Environment Variables

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
MAILGUN_API_KEY=
MAILGUN_WEBHOOK_SIGNING_KEY=
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=appy9TT1LRJTAuQ4W
```

### Local Commands

```bash
npm install                        # Install dependencies
npm run dev                        # Start Next.js dev server on :3000
npx vitest run --reporter=verbose  # Run all tests
npx tsc --noEmit                   # TypeScript check (must pass with zero errors)
```

### Testing

**Framework:** Vitest · **Location:** `src/lib/__tests__/`

Run `npx vitest run --reporter=verbose` to see all test files and counts. Tests cover: email parsing, ICS parsing, contact formatting, partner detection, meeting recurrence, phase 2 prompts, dedup, and more.

**DB mocking:** Supabase client is mocked via `vi.mock` with `vi.hoisted()` for mock variables — see existing tests for the pattern.

**Rule:** ALWAYS run tests after changes. NEVER commit with failing tests.

### Migrations

Sequential numbering in `supabase/migrations/`. Check the latest migration number before adding a new one. Write idempotent SQL where possible.

### Key Conventions

- **Types:** All TypeScript types in `src/lib/types.ts` — keep them there, don't scatter.
- **API routes:** `src/app/api/{resource}/route.ts` pattern.
- **UI pages:** `src/app/{resource}/page.tsx` for list, `src/app/{resource}/[id]/page.tsx` for detail.
- **Components:** `src/components/` organized by concern — `layout/`, `shared/`, `inbox/`, `actions/`, `notes/`, `partners/`.
- **No RLS:** Single-user app, service key auth. No row-level security policies.
- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Compiler-driven refactoring:** Strip from `types.ts` first, then use `tsc --noEmit` errors as the fix list. Order: Types → Lib → UI → API/Tests → Migration.

---

## Airtable Sync

### Adding a New Synced Field (End-to-End)

1. **Airtable:** Create or identify the field. Note the field ID (visible in API docs or URL).
2. **field-maps.ts:** Add the field ID to the appropriate constant (PTRF, PF, EF, RF, ENF, MF, or Ring 3 field maps).
3. **pull.ts/push.ts:** Add the field mapping in the relevant build/map function.
4. **types.ts:** Add the field to the TypeScript interface.
5. **Migration:** Add the column to the Supabase table (if it doesn't exist).
6. **db/ module:** Update any query functions that need the new field.
7. **UI:** Add display in the relevant detail/list page.
8. **entity-model.md:** Document the new field in the field-level registry.

See `src/lib/sync/field-maps.ts` for all Airtable field ID constants and table IDs.

### Safe vs. Dangerous Airtable Changes

**Safe (no code changes needed):** Rename fields, reorder fields, add new non-synced fields, change colors, add views.

**Requires field-maps.ts update:** Change a field's type, change select option values, delete a synced field, add a new field you want Roadrunner to use.

**Key principle:** Field IDs are permanent. Names are cosmetic. Types are contracts.

---

## Common Gotchas

- **Airtable field IDs are opaque** — they change if you recreate a field. Always verify against live Airtable (via MCP on claude.ai) before assuming `field-maps.ts` is correct.
- **Supabase PostgREST** returns `{ data, error }` — always check `error` before using `data`.
- **ICS temporal gap** — ICS parsing creates meetings BEFORE classification. Meetings get linked to engagements AFTER Phase 2. The engagement gate in push.ts prevents orphan AT records. By design.
- **Email parser complexity** — Two-pass parser handles Outlook and Gmail differently. Many tests cover edge cases. Don't simplify without running the full suite. Conference boilerplate is stripped BEFORE splitting (decision #258).
- **Mock hoisting** — `vi.mock()` factories hoist above variable declarations. Use `vi.hoisted()` for mock variables.
- **Fire-and-forget is forbidden** — Vercel serverless kills processes after HTTP response. Every async operation must be awaited.
- **Engagement status differs** — Roadrunner uses `active/planned/blocked/completed/archived`, Airtable mapping is in `sync/utils.ts` (`STATUS_TO_AIRTABLE`).

---

## Key Entry Points

**Services:** `inbound-pipeline.ts`, `inbox-resolver.ts`, `engagement-merge.ts`, `engagement-manager.ts`, `meeting-recurrence.ts`
**AI pipeline:** `classifier.ts` → `phase2-prompt.ts` → `claude.ts` · Brain: `brain-synthesizer.ts` → `notes-context.ts`
**Sync:** `sync/pull.ts` / `sync/push.ts` → `sync/field-maps.ts`

---

## Documentation Map

| Doc | Purpose | When to Read |
|-----|---------|--------------|
| `CLAUDE.md` | This file — working patterns, constraints, architecture | Start of every session |
| `docs/goal-state.md` | Living stats, current state, what's next | Session planning |
| `docs/entity-model.md` | Complete schema — tables, FKs, AT field IDs, ring model | Schema/data work |
| `docs/north-star.md` | UI vision spec — page specs, UX standards, design principles | UI/UX work |
| `docs/ai-call-map.md` | AI call reference — synthesis, summarization, brain | AI/prompt work |
| `.claude/roadrunner-frontend/SKILL.md` | Frontend design system — tokens, components, patterns | UI/UX work |
| `.claude/roadrunner-backend/SKILL.md` | Backend architecture — three-layer, data layer, services | Backend work |
| `decisions.md` | Append-only architectural decision log | When you need "why" |

---

## What NOT to Do

- Do NOT add Airtable field IDs anywhere except `field-maps.ts`
- Do NOT create standalone meetings without an engagement (engagement gate)
- Do NOT use fire-and-forget for any Airtable or DB operation
- Do NOT modify the contact format without updating `contact-parser.ts` AND its tests
- Do NOT add new types outside of `types.ts`
- Do NOT skip reading existing code before modifying — always read the file first
- Do NOT push catalog data TO Airtable — sync is pull-only for catalogs
- Do NOT simplify the email parser without running its full test suite
- Do NOT write direct `supabase.from()` queries outside `src/lib/db/` — all data access goes through db functions
- Do NOT band-aid problems — find root cause, fix properly, verify with tests
