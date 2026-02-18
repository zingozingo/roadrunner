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
**Test count:** 176 tests across 8 test files
**Location:** `src/lib/__tests__/`

| Test File | Tests | Covers |
|-----------|-------|--------|
| email-parser.test.ts | 72 | Email chain parsing, forwarded content extraction |
| ics-parser.test.ts | 18 | ICS calendar parsing (RFC 5545) |
| claude.test.ts | 16 | Claude API wrapper, response parsing |
| prompt-builder.test.ts | 16 | Context section builders |
| user-config.test.ts | 18 | User identity matching |
| resolve-open-items.test.ts | 13 | Open item extraction |
| classifier.test.ts | 12 | Classification orchestration, confidence routing |
| dedup.test.ts | 6 | Message deduplication |

```bash
npx vitest run                              # All tests
npx vitest run src/lib/__tests__/claude      # Single file
npx vitest run --reporter=verbose            # Detailed output
```

**Known pre-existing issues:** 2 TypeScript errors related to AwsRelationship `partner_name` field from migration 031. Non-blocking.

## Database Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially (001-033).

```bash
# Apply migrations to local Supabase
supabase db push

# Create a new migration
# Name it: NNN_descriptive_name.sql
# Example: 034_add_some_column.sql
```

**Migration naming:** Always use the next sequential number. Include a descriptive name. Write idempotent SQL where possible.

## Airtable Sync

The sync engine lives in `src/lib/sync.ts`. It connects to Airtable using **field IDs**, not field names.

### Adding a New Synced Field (End-to-End)

1. **Airtable:** Create or identify the field. Note the field ID (visible in API docs or URL).
2. **sync.ts:** Add the field ID to the appropriate constant (PTRF, PF, EF, RF, ENF, MF).
3. **sync.ts:** Add the field mapping in the relevant build/map function.
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
| EF | Events | AT → RR | tblEEtdZRO6AD1JrU |
| RF | AWS Relationships | AT → RR | tblqVBssFsUeAt9bj |
| ENF | Engagements | RR → AT | tblTC491AUVcrKvq2 |
| MF | Meetings | RR → AT | tbl6LsEqSvEZgqBdW |

### Safe vs. Dangerous Airtable Changes

**Safe (no code changes needed):** Rename fields, reorder fields, add new non-synced fields, change colors, add views.

**Requires sync.ts update:** Change a field's type, change select option values, delete a synced field, add a new field you want Roadrunner to use.

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