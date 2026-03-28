## UI Overhaul — Agent Context

**Before any UI work, read these documents in order:**
1. `docs/north-star.md` — The complete vision: what Roadrunner should become, data architecture, interaction flows, enterprise UX standards
2. `.claude/roadrunner-ui/SKILL.md` — The design system: containers, typography, tokens, patterns. This is a LIVING document — update it as you establish new patterns
3. `.claude/roadrunner-ui/references/design-tokens.md` — Color palette, typography hierarchy, spacing
4. `.claude/roadrunner-ui/references/entity-catalog.md` — Per-entity field mappings and layout specs

**Agent working rules:**
- Read the North Star FIRST. Understand the vision before touching code.
- Read SKILL.md SECOND. Understand the design system before creating components.
- When you establish a new UI pattern (e.g., how financial data is displayed, how loading states work, how performance bars look), DOCUMENT IT IN SKILL.md BEFORE reusing it across multiple pages. Consistency comes from documenting patterns, not from memory.
- After EVERY page change: run `npx tsc --noEmit` and `npx vitest run`. Fix any breaks before moving on.
- NEVER modify these files unless explicitly directed: src/lib/sync/*, src/lib/email-parser.ts, src/lib/ics-parser.ts, src/lib/classifier.ts, src/lib/phase2-prompt.ts, src/lib/meeting-recurrence.ts, src/app/api/inbound/route.ts. These are stable production pipelines.
- The brain synthesizer prompt (src/lib/brain-synthesizer.ts, src/lib/notes-context.ts) has been rewritten to produce a single Strategic Posture paragraph (3-6 sentences). The prompt and context are stable — do not modify unless explicitly directed.
- All database modules (src/lib/db/*) are stable. Use existing query functions. Add new query functions if needed for new data displays, but don't restructure existing ones.
- All 437+ tests must pass at every checkpoint. If a test fails, fix it before continuing.
- Enterprise UX is non-negotiable: explicit loading states, navigation safety for unsaved changes, confirmation dialogs for destructive actions, professional button labels. See North Star Part 7.
- Dark theme only. All colors use CSS custom properties defined in globals.css. See design-tokens.md.
- Data fetching: use server components with parallel Supabase queries (existing pattern). Don't create new API routes for read operations unless there's a specific need.

**What to rebuild:**
- Sidebar (simplify navigation)
- Landing page (Today screen — replaces redirect-to-partners)
- Partner list page (add performance indicators)
- Partner detail page (scrollable sections, visual refinement — synthesis paragraph + financial snapshot already wired)
- Meeting detail page (enterprise loading states, button labels, navigation safety)
- Tasks page (visual refinement)
- Inbox page (enterprise UX polish)

**What to remove:**
- Standalone engagements list page → accessed through partners
- Standalone programs list page → accessed through partner enrollments
- Standalone events list page → accessed through partner event participations
- Standalone relationships list page → accessed through partner people section
- Slide-over panel on partner page → replaced by inline scrollable sections
- 4-section brain accordion → replaced by synthesis paragraph

**What to preserve:**
- The sync layer, email/ICS parsers, AI pipeline (except brain prompt refinement)
- All database modules and test files
- The Mailgun webhook
- The meeting recurrence engine

---

# Roadrunner (Relay)

> AI-powered partner engagement management for AWS PDMs. Forward emails → human-guided routing → AI synthesis → structured engagements → Airtable sync.
> 75 migrations · 23 tables · 31 API routes · 18 UI pages · 437 passing tests

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
├── docs/                          # Project documentation (4 files)
│   ├── CLASSIFICATION.md          #   AI synthesis pipeline documentation (rewrite pending)
│   ├── ai-call-map.md             #   AI call reference (3 calls: synthesis, summarization, brain)
│   ├── entity-model.md            #   Canonical schema — ERD + field-level registry + AT field IDs
│   └── goal-state.md              #   Living orientation doc — current state & next steps
├── decisions.md                   # Append-only architectural decision log (338 entries)
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
│   │   │   ├── relationships/     #     CRUD
│   │   │   ├── reviews/           #     Inbox resolve (assign/create/discard)
│   │   │   └── sync/              #     Trigger Airtable sync
│   │   ├── engagements/           #   Engagement list + detail pages
│   │   ├── events/                #   Event list + detail pages
│   │   ├── inbox/                 #   Inbox triage UI
│   │   ├── meetings/              #   Meeting list + detail pages (inline NoteWorkspace)
│   │   ├── partners/              #   Partner list + detail pages
│   │   ├── programs/              #   Program list + detail pages
│   │   ├── relationships/         #   Relationship list + detail pages
│   │   ├── tasks/                 #   Cross-partner task dashboard
│   │   ├── layout.tsx             #   Root layout + sidebar
│   │   └── page.tsx               #   Redirects to /partners
│   ├── components/                # React components (32 across 6 groups)
│   │   ├── actions/               #   Entity action buttons + MergeButton (6 files)
│   │   ├── inbox/                 #   Inbox triage UI — InboxClient (1 file)
│   │   ├── layout/                #   App structure — sidebar, headers (4 files)
│   │   ├── notes/                 #   NoteWorkspace, ContextSidebar, PreviousNotes, TaskEditor, MeetingNotesSection
│   │   ├── partners/              #   BrainSynthesis, PartnerReferencePanel, PartnerScratchpad
│   │   └── shared/                #   Reusable primitives — CompactRow, DetailHeader, EngagementLinker, RecurrenceEditor, SlideOverPanel, badges (15 files)
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
│       ├── brain-synthesizer.ts   #   AI partner brain synthesis (structured executive briefing)
│       ├── types.ts               #   All shared TypeScript interfaces
│       ├── user-config.ts         #   Canonical user identity config
│       ├── airtable.ts            #   Airtable REST API client
│       ├── db/                    #   Database layer (14 modules)
│       │   ├── client.ts          #     Supabase singleton client
│       │   ├── engagements.ts     #     Engagement CRUD + history
│       │   ├── messages.ts        #     Message storage + fingerprint dedup
│       │   ├── meetings.ts        #     Meeting CRUD + ICS creation
│       │   ├── meeting-notes.ts   #     Meeting notes + tasks CRUD
│       │   ├── partners.ts        #     Partner queries (read-only)
│       │   ├── partner-context.ts #     Scratchpad CRUD
│       │   ├── catalog.ts         #     Events + Programs CRUD
│       │   ├── relationships.ts   #     Relationships + junction queries
│       │   ├── participants.ts    #     Participant upsert + registry joins
│       │   ├── engagement-links.ts #     Engagement↔program/event junction queries
│       │   ├── inbox.ts           #     Inbox queries, grouped count, set-partner, INBOX_GROUP_WINDOW_MS
│       │   ├── ring3.ts           #     Ring 3 upsert + queries (goals, enrollments, funding)
│       │   └── index.ts           #     Barrel re-exports
│       ├── sync/                  #   Airtable sync engine
│       │   ├── pull.ts            #     AT → RR catalog + posture sync (9 tables)
│       │   ├── push.ts            #     RR → AT activity sync
│       │   ├── field-maps.ts      #     Airtable field ID constants (6 pull + 2 push + 5 Ring 3)
│       │   └── utils.ts           #     Coercion helpers + validation
│       └── __tests__/             #   437 passing tests across 14 test files
├── supabase/
│   ├── migrations/                # 75 migration files (001-075)
│   └── (authoritative schema lives in migrations/)
├── scripts/
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
   - Link engagement↔programs, engagement↔events, engagement↔relationships
   - Create meetings (if ICS data present)
   - Link message to engagement
   ↓
10. SYNC TO AIRTABLE (sync/push.ts — awaited)
    Push: engagements → Partner Engagements table
    Push: meetings → Meetings table
    Pull: partners, programs, events, relationships ← catalog tables
    ↓
11. DASHBOARD (Next.js pages)
    Server components query Supabase directly
    Client components use API routes for mutations
```

---

## Data Ownership

Airtable owns **catalog** (Ring 1: Partners, Programs, Events, Relationships) and **posture** (Ring 3: Partner Goals, Program Enrollments, Event Participations, MPOPP Funding, MDF Funding). Roadrunner owns **activity** (Ring 2: Engagements, Meetings, Notes, Tasks, Messages, Participants, Partner Context). See `docs/entity-model.md` for the complete schema with all 23 tables, FK cascade behaviors, and Airtable field IDs.

---

## Core Principles

These are **NON-NEGOTIABLE**. Every code change must respect these:

1. **Email-in, insight-out** — The user never leaves Outlook to feed the system. Forwarding is the only input.
2. **Human routes, AI synthesizes** — The PDM decides where emails go. AI handles deep analysis only after routing.
3. **Summaries are the product** — Raw emails are stored but never the primary view. `current_state` is the living output.
4. **Connect, don't create** — The AI is biased toward linking to existing entities, never fabricating new ones. Empty arrays over hallucinated matches.
5. **AI creates engagements only** — Programs, events, partners, and relationships are human-curated catalog data.
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
npx vitest run --reporter=verbose  # Run tests (437 passing, 0 failures)
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
| RF | Relationships | AT → RR | tblqVBssFsUeAt9bj |
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

**Data layer:** `db/index.ts` → `db/engagements.ts` → `db/messages.ts` → `db/meetings.ts` → `db/meeting-notes.ts` → `db/participants.ts` → `db/partner-context.ts` → `db/catalog.ts` → `db/engagement-links.ts` → `db/relationships.ts` → `db/partners.ts` → `db/inbox.ts` → `db/ring3.ts`

**Email:** `email-parser.ts` → `ics-parser.ts` → `name-resolver.ts` → `contact-parser.ts` → `format-utils.ts` · Recurrence: `meeting-recurrence.ts`

**Entry points:** `/api/inbound` (Mailgun webhook), `/api/reviews/resolve` (inbox routing — assign/create/discard), `/api/engagements/merge` (engagement merge), `/api/sync` (catalog sync)

---

## Documentation Map

| Doc | Purpose | When to Read |
|-----|---------|--------------|
| `CLAUDE.md` | This file — project overview, architecture, development | Start of every session |
| `docs/entity-model.md` | Complete schema — 23 tables, all FKs, AT field IDs, ring model | Schema/data work |
| `docs/CLASSIFICATION.md` | AI synthesis pipeline (rewrite pending — Phase 2 docs still accurate) | Prompt/AI work |
| `docs/ai-call-map.md` | AI call reference — 3 calls: synthesis, summarization, brain | AI/prompt work |
| `docs/goal-state.md` | Living status — current state + what's next | Session planning |
| `decisions.md` | Append-only architectural decision log (338 entries) | When you need "why" |

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
