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
│   ├── DATA-MODEL.md              #   Entity schemas & relationships
│   ├── FIELD-MAPPING.md           #   Airtable ↔ Supabase field IDs
│   ├── CLASSIFICATION.md          #   AI pipeline & prompt architecture
│   └── DEVELOPMENT.md             #   Setup, testing, workflows
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
│       ├── classifier.ts          #   Email classification orchestrator
│       ├── claude.ts              #   Claude API wrapper
│       ├── email-parser.ts        #   Forwarded email chain parser
│       ├── ics-parser.ts          #   ICS calendar event parser (RFC 5545)
│       ├── prompt-builder.ts      #   Modular context builders for Claude
│       ├── supabase.ts            #   Database client + 80+ query functions
│       ├── sync.ts                #   Airtable ↔ Supabase sync engine
│       ├── types.ts               #   Shared TypeScript interfaces
│       ├── user-config.ts         #   Canonical user identity config
│       └── __tests__/             #   350 tests across 11 test files
├── supabase/
│   └── migrations/                # 40 migration files (001-040)
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
5. MESSAGE STORED (supabase.ts)
   Raw email saved to messages table with parsed metadata
   ↓
6. CLASSIFIER (classifier.ts → claude.ts → prompt-builder.ts)
   Builds context: partner list, programs, events, relationships, existing engagements
   Sends to Claude API with modular prompt sections
   Returns: engagement match/create, participants, entity links, meetings, confidence score
   ↓
7. CONFIDENCE CHECK
   ≥ 0.85 → auto-persist (step 8)
   < 0.85 → create approval_queue item → appears in Inbox UI
   ↓
8. PERSIST (supabase.ts → persistClassificationResult)
   Single function handles both auto-assign and approval-resolve paths:
   - Create or update engagement (current_state, tags)
   - Create participants + participant_links
   - Create entity_links (programs, events, relationships)
   - Create meetings (if ICS data present)
   - Link message to engagement
   ↓
9. SYNC TO AIRTABLE (sync.ts)
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

**Server Components (reads):** List and detail pages query Supabase directly via server-side functions in supabase.ts. No API route involved — the component IS the server.

**Client Components (writes):** Action buttons, forms, and mutations call API routes. The routes validate input and call supabase.ts functions.

**External Webhooks:** /api/inbound (Mailgun) and /api/health (monitoring) are called by external services, not the frontend.

**Dev-only Routes:** /api/classify/test, /api/classify/live-test, /api/classify/test-cleanup are available for classification pipeline testing via direct API calls.

## Deployment

Vercel handles deployment automatically from the main branch. Environment variables are configured in Vercel's dashboard. The Supabase database is a hosted instance. Mailgun is configured to forward emails to relay.stevenromero.dev → POST /api/inbound webhook.