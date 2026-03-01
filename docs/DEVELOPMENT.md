# Roadrunner — Development Guide

## Environment Setup

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (Claude API)
ANTHROPIC_API_KEY=

# Mailgun
MAILGUN_API_KEY=
MAILGUN_WEBHOOK_SIGNING_KEY=

# Airtable
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=appy9TT1LRJTAuQ4W
```

### Local Development

```bash
npm install
npm run dev          # Start Next.js dev server on :3000
npx vitest run       # Run all tests
npx tsc --noEmit     # TypeScript check (no output files)
```

## Testing

**Framework:** Vitest
**Test count:** 405 tests across 14 test suites
**Location:** `src/lib/__tests__/`

| Test File | Tests | Covers |
|-----------|-------|--------|
| email-parser.test.ts | 123 | Email chain parsing, forwarded content extraction |
| name-resolver.test.ts | 28 | Contact name resolution from JSONB columns |
| contact-parser.test.ts | 26 | Universal contact format parsing/rendering |
| prompt-builder.test.ts | 19 | Context section builders |
| ics-parser.test.ts | 18 | ICS calendar parsing (RFC 5545) |
| user-config.test.ts | 18 | User identity matching |
| claude.test.ts | 16 | Claude API wrapper, response parsing |
| phase1-prompt.test.ts | 14 | Phase 1 prompt building |
| phase2-prompt.test.ts | 14 | Phase 2 prompt building |
| resolve-open-items.test.ts | 13 | Open item extraction |
| classifier.test.ts | 11 | Classification orchestration, confidence routing |
| meeting-pipeline.test.ts | 87 | Meeting creation, ICS parsing, linking |
| meeting-status-map.test.ts | 5 | Meeting status mapping |
| dedup.test.ts | 6 | Message deduplication |
| resolve-route.test.ts | 7 | Inbox resolve route logic |

```bash
npx vitest run                              # All tests
npx vitest run src/lib/__tests__/claude      # Single file
npx vitest run --reporter=verbose            # Detailed output
```

**Known pre-existing issues:** 3 TypeScript errors (non-blocking). Run `npx tsc --noEmit` to check.

## Database Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially (001-048).

```bash
# Apply migrations to local Supabase
supabase db push

# Create a new migration
# Name it: NNN_descriptive_name.sql
# Example: 049_add_some_column.sql
```

**Migration naming:** Always use the next sequential number. Include a descriptive name. Write idempotent SQL where possible.

## Airtable Sync

The sync engine lives in `src/lib/sync/` (pull.ts, push.ts, field-maps.ts, utils.ts). It connects to Airtable using **field IDs**, not field names.

### Adding a New Synced Field (End-to-End)

1. **Airtable:** Create or identify the field. Note the field ID (visible in API docs or URL).
2. **field-maps.ts:** Add the field ID to the appropriate constant (PTRF, PF, EF, RF, ENF, MF).
3. **pull.ts/push.ts:** Add the field mapping in the relevant build/map function.
4. **types.ts:** Add the field to the TypeScript interface.
5. **Migration:** Add the column to the Supabase table (if it doesn't exist).
6. **supabase.ts:** Update any query functions that need the new field.
7. **UI:** Add display in the relevant detail/list page.
8. **FIELD-MAPPING.md:** Document the new field.

### Sync Constants

| Constant | Entity | Direction | Table ID |
|----------|--------|-----------|----------|
| PTRF | Partners | AT → RR | tbl9zC6nxfLEp8xUx |
| PF | Programs | AT → RR | tblpnW8ibVmkWi5Dt |
| EF | Events | AT → RR | tblPDGUSqSvn8mflJ |
| RF | AWS Relationships | AT → RR | tblqVBssFsUeAt9bj |
| ENF | Engagements | RR → AT | tblTC491AUVcrKvq2 |
| MF | Meetings | RR → AT | tbl6LsEqSvEZgqBdW |

### Safe vs. Dangerous Airtable Changes

**Safe (no code changes needed):** Rename fields, reorder fields, add new non-synced fields, change colors, add views.

**Requires field-maps.ts update:** Change a field's type, change select option values, delete a synced field, add a new field you want Roadrunner to use.

**Key principle:** Field IDs are permanent. Names are cosmetic. Types are contracts.

## Adding a New Entity Type

1. **Migration:** Create the table with standard columns (id, name, airtable_record_id, created_at, updated_at).
2. **types.ts:** Add the TypeScript interface.
3. **supabase.ts:** Add query functions (getAll, getById, create, update, delete).
4. **sync.ts:** Add field constant + mapping functions (if synced with Airtable).
5. **API routes:** Create `src/app/api/[entity]/route.ts` and `[id]/route.ts`.
6. **Pages:** Create list page, detail page, and client component.
7. **Components:** Create action component in `src/components/actions/`.
8. **Sidebar:** Add navigation link in `src/components/layout/Sidebar.tsx`.

## Sherpa Workflow (Claude Code Sessions)

Each Claude Code session should start with a diagnostic command that:

1. Reads the relevant docs (PROJECT.md for context, then task-specific docs).
2. Checks current state: `npx tsc --noEmit`, test counts, any failing tests.
3. Scopes the task with clear requirements before making changes.

**Task-to-doc mapping:**
- Schema/data work → DATA-MODEL.md + FIELD-MAPPING.md
- Prompt/AI work → CLASSIFICATION.md
- New feature → ARCHITECTURE.md + DATA-MODEL.md
- Bug fix → ARCHITECTURE.md (for data flow understanding)
- Airtable changes → FIELD-MAPPING.md + DEVELOPMENT.md (sync section)

## Dev-Only Routes

These routes exist for development and testing. They are not called by the production UI:

| Route | Purpose |
|-------|---------|
| `/test` | Classification test page — paste an email, see what Claude does |
| `/api/classify/test` | Dry-run classification (no persistence) |
| `/api/classify/live-test` | Full pipeline test (with persistence) |
| `/api/classify/test-cleanup` | Delete test data |
| `/api/health` | Vercel health check |

## Deployment

**Platform:** Vercel (auto-deploy from main branch)
**Domain:** relay.stevenromero.dev
**Webhook:** Mailgun configured to POST to /api/inbound

### Post-Deploy Checklist

1. Verify /api/health returns 200
2. Check Vercel function logs for any startup errors
3. If schema changed: ensure Supabase migration was applied
4. If Airtable fields changed: trigger a manual sync via the dashboard Sync button