# Sync Architecture

Reference document for how data flows between Roadrunner (Supabase) and Airtable.

## Two-Tier Sync Model

Roadrunner uses two distinct sync patterns:

| Tier | Direction | Entities | Trigger |
|------|-----------|----------|---------|
| **Catalog Pull** | Airtable → Supabase | partners, programs, events, relationships | Manual "Sync from Airtable" button |
| **Activity Push** | Supabase → Airtable | engagements, meetings | Auto (fire-and-forget) + manual "Push to Airtable" button |

**Catalogs** are reference data maintained in Airtable. Roadrunner pulls them to populate dropdowns and resolve linked records. They are never modified by Roadrunner.

**Activities** (engagements, meetings) are created and managed in Roadrunner, then pushed to Airtable for reporting and stakeholder visibility.

## Sync Order

When "Sync All" runs from the dashboard, it pulls catalogs in dependency order:

1. **Partners** — no dependencies
2. **Programs** — no dependencies
3. **Events** — no dependencies
4. **Relationships** — links to partners and programs (needs their airtable_record_ids)

Engagements and meetings are NOT included in "Sync All" — they use the per-entity "Push to Airtable" buttons on their respective list pages.

## Match Strategy (3-Tier)

All push operations use a 3-tier match to find or create Airtable records:

1. **airtable_record_id** — stored on the Supabase row from a previous push (fastest, most reliable)
2. **Roadrunner ID formula field** — Airtable formula field that stores the Supabase UUID; searched via `filterByFormula`
3. **Natural key match** — engagement name or meeting title+date; searched via `filterByFormula`

If no match is found, a new Airtable record is created. After any create, the `airtable_record_id` is written back to Supabase.

## Auto-Push (Fire-and-Forget)

When an activity record is created or deleted in Roadrunner, a fire-and-forget push runs in the background. This uses dynamic `import("./sync")` to avoid circular dependencies.

### Meeting Auto-Push Hooks (centralized in `supabase.ts`)

| Function | Hook |
|----------|------|
| `createMeeting()` | `pushMeetingToAirtable()` after insert |
| `createMeetingFromICS()` | `pushMeetingToAirtable()` after insert |
| `linkMeetingToEngagement()` | `pushMeetingToAirtable()` after update |
| `deleteMeeting()` | `deleteMeetingFromAirtable()` before cascade delete |

### Engagement Auto-Push Hooks (scattered across callers)

| Caller | Hook |
|--------|------|
| `src/lib/classifier.ts` | `pushEngagementToAirtable()` after classification creates engagement |
| `POST /api/engagements` | `pushEngagementToAirtable()` after manual create |
| `PUT /api/engagements/[id]` | `pushEngagementToAirtable()` after update |

### Known Gaps

These code paths create or update activity records **without** an auto-push hook:

| Code Path | Action | Missing Hook |
|-----------|--------|--------------|
| `POST /api/reviews/resolve` | Creates engagement | No push |
| `POST /api/sms/webhook` | Creates engagement via SMS reply | No push |
| `updateMeeting()` in supabase.ts | Updates meeting fields | No push |
| `updateEngagementSummary()` in supabase.ts | Updates engagement summary | No push |

These records will sync on the next manual "Push to Airtable" click but will not appear in Airtable immediately.

## Manual Sync Buttons

| Page | Button | Action |
|------|--------|--------|
| Dashboard (`/`) | "Sync from Airtable" | `syncAllCatalogs()` — pulls partners, programs, events, relationships |
| Partners (`/partners`) | "Sync from Airtable" | `syncEntity("partners")` |
| Programs (`/programs`) | "Sync from Airtable" | `syncEntity("programs")` |
| Events (`/events`) | "Sync from Airtable" | `syncEntity("events")` |
| Relationships (`/relationships`) | "Sync from Airtable" | `syncEntity("relationships")` |
| Engagements (`/engagements`) | "Push to Airtable" | `syncEntity("engagements")` |
| Meetings (`/meetings`) | "Push to Airtable" | `syncEntity("meetings")` |

## Linked Record Resolution

When pushing activities to Airtable, linked record fields require Airtable record IDs (not Supabase UUIDs). Resolution paths:

- **partner** → `partners.airtable_record_id` via FK, fallback to name lookup in Airtable
- **program** → `programs.airtable_record_id` via FK
- **event** → `events.airtable_record_id` via FK
- **engagement** (on meetings) → `engagements.airtable_record_id` via FK
- **relationships** (on meetings) → `meeting_relationships` join table → `relationships.airtable_record_id`

## Bulk Push Change Detection

`syncEngagementsToAirtable()` and `syncMeetingsToAirtable()` compare local fields against existing Airtable values using `hasChanges()`. Records are skipped if all mapped fields match, avoiding unnecessary API calls. A 200ms sleep between writes prevents Airtable rate-limit errors.

## Key Files

| File | Role |
|------|------|
| `src/lib/sync.ts` | All sync logic — pull functions, push functions, field mapping, lookups |
| `src/lib/airtable.ts` | Low-level Airtable API helpers (fetch pages, create, update, delete) |
| `src/lib/supabase.ts` | Database operations + fire-and-forget push hooks |
| `src/app/api/sync/route.ts` | HTTP endpoint for sync buttons |
| `src/components/SyncButton.tsx` | Reusable UI button component |
