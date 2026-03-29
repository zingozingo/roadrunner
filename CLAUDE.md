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
2. `.claude/roadrunner-ui/SKILL.md` — The design system: tokens, components, patterns. This is a LIVING document — update it as you establish new patterns during implementation
3. `docs/entity-model.md` — The schema: all 20 tables, FK cascades, Airtable field IDs, ring model. This is your reference for what data exists and how entities connect
4. `.claude/references/ui-ux-best-practices.md` — Interaction patterns: button states, loading, errors, undo, navigation safety, dark theme, spacing, feedback timing

### Path Guardrails

These apply in ALL modes, ALL sessions:

**READ-ONLY — do not modify any files in these paths:**
- `src/lib/` — all database, sync, AI, parsing, and utility modules
- `src/app/api/` — all API routes
- `supabase/migrations/` — never create migrations
- `src/lib/__tests__/` — never modify existing tests
- `.env`, `.env.local` — never touch environment config

**WRITE-ALLOWED:**
- `src/app/` (page components, layouts — but NOT `src/app/api/`)
- `src/components/` — UI components
- `src/app/globals.css` — styling
- `scripts/` — tooling
- `docs/` — documentation updates
- `.claude/` — design system docs, references, screenshots

The agent may READ anything in `src/lib/` to understand data shapes, types, and existing query functions. It must not WRITE to those files. If a page needs data in a shape the existing API doesn't provide, filter or transform client-side.

**Guardrail adjustments:** These are the DEFAULT guardrails. For sessions involving backend, sync, or schema work, Steven will expand the write-allowed paths at session start. Always confirm with Steven before modifying any file in a READ-ONLY path. If a task plan requires changes to src/lib/ or src/app/api/, Steven will grant explicit permission per-task or per-phase.

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
- **Evolve the design system.** After every task that touches UI, review what you built and ask: "Did I establish a pattern that should be reused?" If yes, write it into SKILL.md as a named pattern with: what it is, where it's used, the specific implementation (classes, spacing, structure), and WHY it works that way. If you found a better way to do something than what SKILL.md currently describes, UPDATE the existing pattern — don't just add a new one. SKILL.md should get smarter and more opinionated with every task, not just longer. The next person (or agent) reading SKILL.md should inherit your design reasoning, not just your code.
- **Enterprise UX is non-negotiable:** explicit loading states, navigation safety for unsaved changes, confirmation dialogs for destructive actions, professional button labels. See North Star Part 7.

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
6. Update CLAUDE.md stats if they changed

Completed plans are kept for reference but never re-executed.

### Session Management

Session templates and summaries live in `docs/sessions/`:

```
docs/sessions/
├── templates/
│   ├── quick-diagnostic.md       # "Run the quick diagnostic" — read and execute this
│   ├── deep-diagnostic.md        # "Run the deep diagnostic" — read and execute this
│   └── claude-ai-session.md      # Steven pastes this into Claude.ai planning sessions
└── summaries/
    └── {date}-{name}.md          # One per session, written during session end
```

**When Steven says "run the quick diagnostic":** Read `docs/sessions/templates/quick-diagnostic.md` and execute every step in it. Output the results in the format specified.

**When Steven says "run the deep diagnostic":** Read `docs/sessions/templates/deep-diagnostic.md` and execute every step in it. Output the results in the format specified.

**When running an end-of-session command:** Write the session summary to `docs/sessions/summaries/{date}-{name}.md`. The summary format is specified in the command Steven provides.

`docs/sessions/templates/claude-ai-session.md` is the Claude.ai planning session prompt — Steven pastes this into Claude.ai, not into Claude Code.

---

# Roadrunner (Relay)

> AI-powered partner engagement management for AWS PDMs. Forward emails → human-guided routing → AI synthesis → structured engagements → Airtable sync.
> 79 migrations · 20 tables · 29 API routes · 12 UI pages · 435 passing tests

---

## What This Is

Roadrunner turns scattered partner email threads into structured, trackable engagement records. A PDM forwards a partner email to `relay.stevenromero.dev` → Mailgun webhook receives it → Claude AI classifies it, extracts participants, links it to known programs/events/relationships → everything surfaces on a dashboard where you manage partner engagements. Forwarding an email is the only input required. Built for Steven Romero, PDM at AWS, managing ~20 ISV partner relationships. Deployed on Vercel at roadrunner-fawn.vercel.app.

---

## Key Terminology

| Term | Definition |
|------|-----------|
| **Engagement** | A trackable workstream with a partner. Has a living summary (current_state) that evolves as new emails arrive. |
| **Meeting** | A calendar event extracted from ICS attachments. Linked to a partner and optionally to an engagement. |
| **Partner** | An ISV in the portfolio. Catalog data owned by Airtable. |
| **Program** | An AWS partner program (ISV Accelerate, Security Competency, etc.). Catalog data owned by Airtable. |
| **Event** | A shared calendar anchor like re:Invent or a summit. NOT a partner-specific call. Catalog data owned by Airtable. |
| **Relationship** | A named relationship with an AWS person or team. Catalog data owned by Airtable. |
| **Task** | An action item extracted from meeting notes or created manually. Belongs to a partner, optionally linked to a meeting note. |
| **Participant** | A person in the system. The canonical person registry — every contact resolves here. |
| **Partner Context** | PDM scratchpad notes about a partner. Wired into AI context pipeline for meeting note summarization. |
| **Inbox** | Unrouted messages (engagement_id IS NULL). PDM triages via assign, create new, or discard. |

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

## Directory Structure

```
roadrunner/
├── docs/                          # Project documentation
│   ├── ai-call-map.md             #   AI call reference (3 calls: synthesis, summarization, brain)
│   ├── entity-model.md            #   Canonical schema — ERD + field-level registry + AT field IDs
│   ├── goal-state.md              #   Living orientation doc — current state & next steps
│   ├── north-star.md              #   UI vision spec — what Roadrunner should become
│   ├── plans/                     #   Task plans
│   │   ├── active.md              #     Current task plan (empty when no plan active)
│   │   └── archive/               #     Completed plans for reference
│   └── sessions/                  #   Session management
│       ├── templates/             #     Diagnostic + session prompts
│       │   ├── quick-diagnostic.md
│       │   ├── deep-diagnostic.md
│       │   └── claude-ai-session.md
│       └── summaries/             #     Session summaries (one per session)
├── decisions.md                   # Append-only architectural decision log (360 entries)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── api/                   #   API routes (31 route files, grouped by entity)
│   │   │   ├── engagements/       #     CRUD + merge + participants
│   │   │   ├── events/            #     CRUD
│   │   │   ├── health/            #     Health check
│   │   │   ├── inbound/           #     Mailgun webhook
│   │   │   ├── inbox/             #     Inbox grouped count + set-partner
│   │   │   ├── meetings/          #     CRUD
│   │   │   ├── notes/             #     Notes CRUD + summarize + tasks + context
│   │   │   ├── participants/      #     Update participant
│   │   │   ├── partners/          #     CRUD + partner context
│   │   │   ├── programs/          #     CRUD
│   │   │   ├── reviews/           #     Inbox resolve (assign/create/discard)
│   │   │   └── sync/              #     Trigger Airtable sync
│   │   ├── engagements/           #   Engagement list + detail pages
│   │   ├── events/                #   Event list + detail pages
│   │   ├── inbox/                 #   Inbox triage UI
│   │   ├── meetings/              #   Meeting list + detail pages (inline NoteWorkspace)
│   │   ├── partners/              #   Partner list + detail pages
│   │   ├── programs/              #   Program list + detail pages
│   │   ├── tasks/                 #   Cross-partner task dashboard
│   │   ├── layout.tsx             #   Root layout + sidebar
│   │   └── page.tsx               #   Today page (meetings + inbox signal)
│   ├── components/                # React components (30 across 6 groups)
│   │   ├── actions/               #   Entity action buttons + MergeButton (5 files)
│   │   ├── inbox/                 #   Inbox triage UI — InboxClient (1 file)
│   │   ├── layout/                #   App structure — sidebar, headers (4 files)
│   │   ├── notes/                 #   NoteWorkspace, ContextSidebar, PreviousNotes, TaskEditor, MeetingNotesSection
│   │   ├── partners/              #   BrainSynthesis, PartnerScratchpad
│   │   └── shared/                #   Reusable primitives — EngagementLinker, RecurrenceEditor, SlideOverPanel, badges, ContactGroup, Timeline (13 files)
│   └── lib/                       # Core business logic
│       ├── classifier.ts          #   Synthesis orchestrator (synthesizeIntoEngagement, persistClassificationResult)
│       ├── claude.ts              #   Anthropic API client (synthesis calls)
│       ├── partner-detection.ts   #   Mechanical partner detection via domain matching
│       ├── phase2-prompt.ts       #   Synthesis system prompt + context builders
│       ├── prompt-builder.ts      #   Forwarder section builder (buildForwarderSection only)
│       ├── email-parser.ts        #   Forwarded email chain parser (two-pass)
│       ├── ics-parser.ts          #   ICS calendar event parser (RFC 5545)
│       ├── name-resolver.ts       #   Contact name resolution from JSONB columns
│       ├── contact-parser.ts      #   Universal "Name <email> (Title)" parser
│       ├── format-utils.ts        #   Display name formatting + stripPartnerPrefix
│       ├── meeting-recurrence.ts  #   Recurring meeting engine (spawn, overdue detection)
│       ├── notes-summarizer.ts    #   AI meeting note summarizer (Claude API)
│       ├── notes-context.ts       #   Context builders (buildPartnerContext, buildMeetingNoteContext, buildBrainContext)
│       ├── contact-display.ts     #   Contact display formatting for UI
│       ├── brain-synthesizer.ts   #   AI partner brain synthesis (single Strategic Posture paragraph)
│       ├── types.ts               #   All shared TypeScript interfaces
│       ├── user-config.ts         #   Canonical user identity config
│       ├── airtable.ts            #   Airtable REST API client
│       ├── db/                    #   Database layer (13 modules)
│       │   ├── client.ts          #     Supabase singleton client
│       │   ├── engagements.ts     #     Engagement CRUD + history
│       │   ├── messages.ts        #     Message storage + fingerprint dedup
│       │   ├── meetings.ts        #     Meeting CRUD + ICS creation
│       │   ├── meeting-notes.ts   #     Meeting notes + tasks CRUD
│       │   ├── partners.ts        #     Partner queries (read-only)
│       │   ├── partner-context.ts #     Scratchpad CRUD
│       │   ├── catalog.ts         #     Events + Programs CRUD
│       │   ├── engagement-links.ts #     Engagement↔program/event junction queries
│       │   ├── participants.ts    #     Participant upsert + registry joins
│       │   ├── inbox.ts           #     Inbox queries, grouped count, set-partner, INBOX_GROUP_WINDOW_MS
│       │   ├── ring3.ts           #     Ring 3 upsert + queries (goals, enrollments, funding)
│       │   └── index.ts           #     Barrel re-exports
│       ├── sync/                  #   Airtable sync engine
│       │   ├── pull.ts            #     AT → RR catalog + posture sync (9 tables)
│       │   ├── push.ts            #     RR → AT activity sync
│       │   ├── field-maps.ts      #     Airtable field ID constants (6 pull + 2 push + 5 Ring 3)
│       │   └── utils.ts           #     Coercion helpers + validation
│       └── __tests__/             #   435 passing tests across 14 test files
├── supabase/
│   ├── migrations/                # 79 migration files (001-079)
│   └── (authoritative schema lives in migrations/)
├── scripts/
│   ├── screenshot.ts              # Playwright: screenshot a page at given viewport width
│   ├── interact.ts                # Playwright: run JSON interaction sequences (click, assert, etc.)
│   ├── ui-audit.sh                # Mechanical UI checks (spacing, colors, inline styles)
│   ├── seed-data.ts               # CLI script to seed events/programs
│   ├── hydrate-contact-registry.ts # Backfill contact registry join tables
│   ├── backfill-notes.ts          # One-time: re-summarize all meeting notes
│   ├── backfill-engagements.ts    # One-time: re-synthesize all engagements
│   └── backfill-brains.ts         # One-time: re-synthesize all partner brains
└── data/
    ├── seed-events.json           # Event catalog seed data
    └── seed-programs-v2.json      # Program catalog seed data
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

Airtable owns **catalog** (Ring 1: Partners, Programs, Events) and **posture** (Ring 3: Partner Goals, Program Enrollments, Event Participations, MPOPP Funding, MDF Funding). Roadrunner owns **activity** (Ring 2: Engagements, Meetings, Notes, Tasks, Messages, Participants, Partner Context). See `docs/entity-model.md` for the complete schema with all 20 tables, FK cascade behaviors, and Airtable field IDs.

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

**Client Components (writes):** Action buttons, forms, and mutations call API routes. The routes validate input and call `db/` functions.

**External Webhooks:** `/api/inbound` (Mailgun) and `/api/health` (monitoring) are called by external services, not the frontend.

**No stubbed routes.** The old `/api/classify` 410 stub was removed in Phase D cleanup.

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
npx vitest run --reporter=verbose  # Run tests (435 passing, 0 failures)
npx tsc --noEmit                   # TypeScript check (must pass with zero errors)
```

### Testing

**Framework:** Vitest · **Location:** `src/lib/__tests__/`

| Test File | Tests | Covers |
|-----------|-------|--------|
| email-parser.test.ts | 126 | Email chain parsing, forwarded content extraction, conference boilerplate splits |
| phase2-prompt.test.ts | 50 | Phase 2 prompt building, context sections, scratchpad/digests |
| contact-display.test.ts | 41 | Contact display formatting |
| format-utils.test.ts | 39 | Display name formatting utilities |
| contact-parser.test.ts | 34 | Universal contact format parsing/rendering |
| ics-parser.test.ts | 32 | ICS calendar parsing (RFC 5545), multi-VEVENT guardrail |
| name-resolver.test.ts | 27 | Contact name resolution from JSONB columns |
| partner-detection.test.ts | 25 | Mechanical partner detection via domain matching |
| meeting-recurrence.test.ts | 18 | Recurring meeting engine (calculateNextDate, overdue detection, spawn) |
| user-config.test.ts | 18 | User identity matching |
| meeting-pipeline.test.ts | 13 | Meeting creation, ICS parsing, linking |
| prompt-builder.test.ts | 3 | Forwarder section builder (buildForwarderSection) |
| dedup.test.ts | 6 | Message fingerprint deduplication |
| meeting-status-map.test.ts | 5 | Meeting status mapping (mapMeetingStatus in sync/utils) |

**DB mocking:** Supabase client is mocked via `vi.mock` with `vi.hoisted()` for mock variables — see existing tests for the pattern.

**Rule:** ALWAYS run tests after changes. NEVER commit with failing tests.

### Migrations

Sequential numbering in `supabase/migrations/` (currently 001-075). New migrations get the next number (076, 077, ...). Write idempotent SQL where possible.

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

### Sync Constants

| Constant | Entity | Direction | Table ID |
|----------|--------|-----------|----------|
| PTRF | Partners | AT → RR | tbl9zC6nxfLEp8xUx |
| PF | Programs | AT → RR | tblpnW8ibVmkWi5Dt |
| EF | Events | AT → RR | tblPDGUSqSvn8mflJ |
| ENF | Engagements | RR → AT | tblTC491AUVcrKvq2 |
| MF | Meetings | RR → AT | tbl6LsEqSvEZgqBdW |
| PARTNER_GOALS_FIELDS | Partner Goals | AT → RR | tblmboZKyBasfh5pV |
| PARTNER_PROGRAMS_FIELDS | Partner Programs | AT → RR | tbl1CPtbVzQvRN8LA |
| PARTNER_EVENTS_FIELDS | Partner Events | AT → RR | tblYljQDnXwjTDy2T |
| MPOPP_FIELDS | MPOPP Funding | AT → RR | tbl2ilHOaXYsgxqFY |
| MDF_FIELDS | MDF Funding | AT → RR | tblRSsochM23QGQpS |

### Safe vs. Dangerous Airtable Changes

**Safe (no code changes needed):** Rename fields, reorder fields, add new non-synced fields, change colors, add views.

**Requires field-maps.ts update:** Change a field's type, change select option values, delete a synced field, add a new field you want Roadrunner to use.

**Key principle:** Field IDs are permanent. Names are cosmetic. Types are contracts.

---

## Common Gotchas

- **Airtable field IDs are opaque** — they change if you recreate a field. Always verify against live Airtable (via MCP on claude.ai) before assuming `field-maps.ts` is correct.
- **Supabase PostgREST** returns `{ data, error }` — always check `error` before using `data`.
- **ICS temporal gap** — ICS parsing creates meetings BEFORE classification. Meetings get linked to engagements AFTER Phase 2. The engagement gate in push.ts prevents orphan AT records. By design.
- **Email parser complexity** — Two-pass parser handles Outlook and Gmail differently. 126 tests cover edge cases. Don't simplify without running the full suite. Conference boilerplate is stripped BEFORE splitting (decision #258).
- **Mock hoisting** — `vi.mock()` factories hoist above variable declarations. Use `vi.hoisted()` for mock variables.
- **Fire-and-forget is forbidden** — Vercel serverless kills processes after HTTP response. Every async operation must be awaited.
- **Engagement status differs** — Roadrunner uses `active/planned/blocked/completed/archived`, Airtable mapping is in `sync/utils.ts` (`STATUS_TO_AIRTABLE`).

---

## File Quick Reference

**Classification:** `classifier.ts` → `phase2-prompt.ts` → `claude.ts` · Partner detection: `partner-detection.ts` · Brain: `brain-synthesizer.ts` → `notes-context.ts` (buildBrainContext)

**Sync:** `sync/pull.ts` / `sync/push.ts` → `sync/field-maps.ts` → `sync/utils.ts`

**Data layer:** `db/index.ts` → `db/engagements.ts` → `db/messages.ts` → `db/meetings.ts` → `db/meeting-notes.ts` → `db/participants.ts` → `db/partner-context.ts` → `db/catalog.ts` → `db/engagement-links.ts` → `db/partners.ts` → `db/inbox.ts` → `db/ring3.ts`

**Email:** `email-parser.ts` → `ics-parser.ts` → `name-resolver.ts` → `contact-parser.ts` → `format-utils.ts` · Recurrence: `meeting-recurrence.ts`

**Entry points:** `/api/inbound` (Mailgun webhook), `/api/reviews/resolve` (inbox routing — assign/create/discard), `/api/engagements/merge` (engagement merge), `/api/sync` (catalog sync)

---

## Documentation Map

| Doc | Purpose | When to Read |
|-----|---------|--------------|
| `CLAUDE.md` | This file — project overview, architecture, development | Start of every session |
| `docs/entity-model.md` | Complete schema — 20 tables, all FKs, AT field IDs, ring model | Schema/data work |
| `docs/north-star.md` | UI vision spec — page specs, UX standards, design principles | UI/UX work |
| `docs/ai-call-map.md` | AI call reference — 3 calls: synthesis, summarization, brain | AI/prompt work |
| `docs/goal-state.md` | Living status — current state + what's next | Session planning |
| `docs/plans/active.md` | Current task plan (empty when no plan active) | Task mode |
| `docs/sessions/templates/` | Session templates — diagnostics and Claude.ai session prompt | Reference when needed |
| `docs/sessions/summaries/` | Session summaries — one per session, latest is handoff for next session | Session start (paste latest into Claude.ai) |
| `decisions.md` | Append-only architectural decision log (360 entries) | When you need "why" |

---

## What NOT to Do

- Do NOT add Airtable field IDs anywhere except `field-maps.ts`
- Do NOT create standalone meetings without an engagement (engagement gate)
- Do NOT use fire-and-forget for any Airtable or DB operation
- Do NOT modify the contact format without updating `contact-parser.ts` AND its 26 tests
- Do NOT add new types outside of `types.ts`
- Do NOT skip reading existing code before modifying — always read the file first
- Do NOT push catalog data TO Airtable — sync is pull-only for catalogs
- Do NOT simplify the email parser without running its 126-test suite
- Do NOT band-aid problems — find root cause, fix properly, verify with tests
