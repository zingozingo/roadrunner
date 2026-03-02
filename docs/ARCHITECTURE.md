# Roadrunner — Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS |
| Backend | Next.js API Routes (serverless on Vercel) |
| Database | Supabase PostgreSQL |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Email Ingestion | Mailgun (inbound webhook) |
| Partner Data | Airtable (REST API, bidirectional sync) |
| Deployment | Vercel |
| Domain | relay.stevenromero.dev |

## Directory Structure

```
roadrunner/
├── docs/                          # Project documentation
│   ├── PROJECT.md                 #   Business context & principles
│   ├── ARCHITECTURE.md            #   This file — tech stack & structure
│   ├── CLASSIFICATION.md          #   Two-phase AI pipeline & prompt architecture
│   ├── DATA-MODEL.md              #   Entity schemas & relationships
│   ├── FIELD-MAPPING.md           #   Airtable ↔ Supabase field IDs
│   ├── DEVELOPMENT.md             #   Setup, testing, workflows
│   └── goal-state.md              #   Living orientation doc — current state & next steps
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── api/                   #   API routes (grouped by entity)
│   │   │   ├── classify/          #     Classification endpoints + test routes
│   │   │   ├── engagements/       #     CRUD + participants
│   │   │   ├── events/            #     CRUD
│   │   │   ├── health/            #     Health check
│   │   │   ├── inbound/           #     Mailgun webhook
│   │   │   ├── inbox/             #     Approval queue count (sidebar badge)
│   │   │   ├── meetings/          #     CRUD
│   │   │   ├── participant-links/ #     Delete link
│   │   │   ├── participants/      #     Update participant
│   │   │   ├── partners/          #     CRUD
│   │   │   ├── programs/          #     CRUD
│   │   │   ├── relationships/     #     CRUD
│   │   │   ├── reviews/           #     Resolve approval
│   │   │   └── sync/              #     Trigger Airtable sync
│   │   ├── engagements/           #   Engagement list + detail pages
│   │   ├── events/                #   Event list + detail pages
│   │   ├── inbox/                 #   Approval review queue
│   │   ├── meetings/              #   Meeting list + detail pages
│   │   ├── partners/              #   Partner list + detail pages
│   │   ├── programs/              #   Program list + detail pages
│   │   ├── relationships/         #   AWS Relationship list + detail pages
│   │   ├── layout.tsx             #   Root layout + sidebar
│   │   └── page.tsx               #   Dashboard home
│   ├── components/                # React components (organized by function)
│   │   ├── actions/               #   Entity action buttons (5 files)
│   │   ├── engagement/            #   Engagement-specific cards/forms (4 files)
│   │   ├── inbox/                 #   Review queue UI (4 files)
│   │   ├── layout/                #   App structure — sidebar, headers (4 files)
│   │   └── shared/                #   Reusable primitives — CompactRow, DetailHeader, badges (10 files)
│   └── lib/                       # Core business logic
│       ├── airtable.ts            #   Airtable REST API client
│       ├── classifier.ts          #   Two-phase classification orchestrator
│       ├── claude.ts              #   Anthropic API client (Phase 1 + Phase 2)
│       ├── phase1-prompt.ts       #   Phase 1 system prompt + context builders
│       ├── phase2-prompt.ts       #   Phase 2 system prompt + context builders
│       ├── prompt-builder.ts      #   Shared section builders (events, programs, etc.)
│       ├── email-parser.ts        #   Forwarded email chain parser (two-pass)
│       ├── ics-parser.ts          #   ICS calendar event parser (RFC 5545)
│       ├── meeting-detector.ts    #   Fallback meeting detection from plain-text bodies
│       ├── name-resolver.ts       #   Contact name resolution from JSONB columns
│       ├── contact-parser.ts      #   Universal "Name <email> (Title)" parser
│       ├── format-utils.ts        #   Display name formatting utilities
│       ├── types.ts               #   Shared TypeScript interfaces
│       ├── user-config.ts         #   Canonical user identity config
│       ├── db/                    #   Database layer (11 modules)
│       │   ├── client.ts          #     Supabase singleton client
│       │   ├── engagements.ts     #     Engagement CRUD + history
│       │   ├── messages.ts        #     Message storage + fingerprint dedup
│       │   ├── meetings.ts        #     Meeting CRUD + ICS creation
│       │   ├── partners.ts        #     Partner queries (read-only)
│       │   ├── catalog.ts         #     Events + Programs CRUD
│       │   ├── relationships.ts   #     AWS Relationships + junction queries
│       │   ├── participants.ts    #     Participant upsert + linking
│       │   ├── entity-links.ts    #     Entity link CRUD
│       │   ├── inbox.ts           #     Approval queue operations
│       │   └── index.ts           #     Barrel re-exports
│       ├── sync/                  #   Airtable sync engine (4 modules)
│       │   ├── pull.ts            #     AT → RR catalog sync
│       │   ├── push.ts            #     RR → AT activity sync
│       │   ├── field-maps.ts      #     Airtable field ID constants
│       │   └── utils.ts           #     Coercion helpers + validation
│       └── __tests__/             #   466 tests across 15 test files
├── supabase/
│   └── migrations/                # 49 migration files (001-049)
├── scripts/
│   └── seed-data.ts               # CLI script to seed events/programs
├── data/
│   ├── seed-events.json           # Event catalog seed data
│   └── seed-programs-v2.json      # Program catalog seed data
├── .claude/                       # Claude Code memory + skills + settings
│   └── roadrunner-ui/             #   UI design system skill (SKILL.md + references/)
└── ...
```

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
6. TWO-PHASE CLASSIFIER (classifier.ts)
   Phase 1 (phase1-prompt.ts): Compact engagement index → routing decision
   Phase 2 (phase2-prompt.ts): Full engagement history → deep analysis
   Returns: engagement match, current_state, participants, entity links, pillar
   ↓
7. CONFIDENCE CHECK
   ≥ 0.85 → auto-persist (step 8)
   < 0.85 → create approval_queue item → appears in Inbox UI
   ↓
8. PERSIST (classifier.ts → persistClassificationResult)
   Single function handles both auto-assign and approval-resolve paths:
   - Create or update engagement (current_state, topic, goal, pillar)
   - Create participants + participant_links
   - Create entity_links (programs, events, relationships)
   - Create meetings (if ICS data present)
   - Link message to engagement
   ↓
9. SYNC TO AIRTABLE (sync/push.ts — awaited)
   Push: engagements → Partner Engagements table
   Push: meetings → Meetings table
   Pull: partners, programs, events, relationships ← catalog tables
   ↓
10. DASHBOARD (Next.js pages)
    Server components query Supabase directly
    Client components use API routes for mutations
```

## API Route Patterns

The app uses two data access patterns:

**Server Components (reads):** List and detail pages query Supabase directly via server-side functions in db/. No API route involved — the component IS the server.

**Client Components (writes):** Action buttons, forms, and mutations call API routes. The routes validate input and call db/ functions.

**External Webhooks:** /api/inbound (Mailgun) and /api/health (monitoring) are called by external services, not the frontend.

**Dev-only Routes:** /api/classify/test, /api/classify/live-test, /api/classify/test-cleanup are available for classification pipeline testing via direct API calls.

## Deployment

Vercel handles deployment automatically from the main branch. Environment variables are configured in Vercel's dashboard. The Supabase database is a hosted instance. Mailgun is configured to forward emails to relay.stevenromero.dev → POST /api/inbound webhook.