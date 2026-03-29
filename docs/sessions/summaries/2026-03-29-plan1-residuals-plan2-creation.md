# Session Summary: 2026-03-29 — Plan 1 Residuals & Plan 2 Creation

## What was done

Major interactive session addressing Plan 1 residual issues and preparing Plan 2. Started with diagnostics on three known issues from Plan 1 execution: Third Parties not rendering on partner pages, duplicate contacts in engagement contributors, and "Unlinked" program enrollment display. The Third Parties issue was diagnosed as a data gap — AT contacts without emails can't enter the email-keyed participant registry; Steven will backfill emails in Airtable. The duplicate contacts issue had two root causes: the classifier insertion path didn't normalize emails to lowercase (creating case-mismatched duplicates), and the PDM appeared on every engagement. Fixed with app-level normalization on all 3 insertion paths, a case-insensitive UNIQUE(lower(email)) database index (migration 080), merging 4 existing duplicates, and adding isUserEmail() exclusion to getEngagementContributors().

The "Unlinked" enrollment display led to a broader architectural decision: programs and events should connect at the partner level only, not the engagement level. Dissolved all three engagement-level junction tables (engagement_programs, engagement_events, engagement_relationships) in migration 081 — 14 files cleaned, dead CRUD code removed. Added program_name column to partner_program_enrollments, synced from AT text field, wired to UI as primary display label.

Then tackled meeting data quality: investigated all 51 meetings via Airtable MCP, discovered the anchor_day column doesn't actually exist in production (migrations 078/079 tracked but DDL never ran), backfilled 11 null meeting_types, renamed 12 "Partner Sync" meetings to "Partner Cadence", deleted 2 test Cloudaware QBR records. Established meeting type definitions for all 10 types.

Restructured SKILL.md into a three-layer design system (Visual Foundations, Interaction Patterns, Data Visualization Patterns) with skeleton framework and pattern documentation format. Updated entity-model.md to reflect all dissolved tables and new columns.

Created Plan 2: 4 phases, 16 tasks — Foundation & Verification, Meeting Recurrence Overhaul, People Page, Today Page Rebalancing. Includes series timeline visualization (Task 2.7) and shifted-occurrence indicators. Plan ready to be placed in active.md.

## Stats change

| Metric | Before | After |
|--------|--------|-------|
| Migrations | 79 | 81 |
| Tables | 20 | 17 |
| Meetings | 51 | 49 |
| Tests | 435 | 435 |
| Decisions | #360 | #366 |

## Key changes

- Migration 080: merged 4 duplicate participants, replaced UNIQUE(email) with UNIQUE(lower(email))
- Migration 081: dropped engagement_programs, engagement_events, engagement_relationships; added program_name to partner_program_enrollments
- All 3 participant insertion paths normalize email to lowercase
- PDM filtered from engagement contributors via isUserEmail()
- engagement-links.ts deleted (8 dead CRUD functions)
- 14 files cleaned of junction table references
- Pull sync populates program_name; UI uses it as primary label
- 11 meeting types backfilled, 12 meetings renamed, 2 test records deleted
- SKILL.md restructured into 3-layer design system with skeleton framework
- entity-model.md updated for all schema changes
- Plan 2 created: 16 tasks across 4 phases

## Decisions logged: #361 through #366

- **#361:** Case-insensitive email uniqueness at DB level
- **#362:** PDM excluded from engagement contributors
- **#363:** Engagement-level program/event junctions dissolved
- **#364:** program_name as primary enrollment display label
- **#365:** Meeting naming convention standardized
- **#366:** SKILL.md three-layer design system architecture

## Docs updated

- **decisions.md:** +6 entries (#361-366)
- **goal-state.md:** stats, completed items, new What's Next
- **CLAUDE.md:** stats header, directory tree (engagement-links.ts removed), data layer reference
- **entity-model.md:** dissolved tables removed, program_name added, email index noted (done earlier this session)
- **SKILL.md:** three-layer restructure (done earlier this session)

## Current state

81 migrations, 17 active tables, 49 meetings (all typed and named consistently), 435 tests passing, tsc clean, audit clean. Case-insensitive email uniqueness enforced at DB level. Programs/events are partner-level only — engagement junctions dissolved. SKILL.md has three-layer framework ready for Plan 2 population. Plan 2 created and ready for execution. anchor_day column does NOT exist in production — critical first task in Plan 2.

## Next session priorities

1. **Immediate:** Place Plan 2 in docs/plans/active.md and begin execution. Phase 1 Task 1.1 (anchor_day fix) is the critical foundation — all recurrence work depends on it.
2. **Soon:** After Plan 2 Phase 2 completes, interactive session to clean up meeting series ownership (merge Vasion duplicates, convert standalones to series roots) using the new recurrence tooling.
3. **Later:** Calendar/timeline view for cross-partner meeting history. Full Airtable exit path planning.

## Open questions

- Plan 2 needs Task 2.7 added (series timeline strip) and Task 2.2 updated (shifted-occurrence indicator) before execution — Steven will update the plan file.
- How should the series timeline strip interact with the partner detail page vs meeting detail page? Could live on both.
- Post-Plan 2: is a cross-partner meeting calendar view worth building, or does the series timeline strip provide enough visibility?

## Pre-existing issues noted

- Third Parties group on partner pages will remain empty until Steven backfills emails in Airtable contact fields
- 5 participants with NULL email exist in the registry (name-only, from classifier) — these can't be deduplicated by email; future decision needed on whether to support email-less participants
- 58/80 program enrollments still have null program_id (AT linked records not populated) — display works via program_name but click-through navigation unavailable for those
- Vasion has duplicate Partner Cadence series that needs manual merge after Phase 2 tooling is built
- KnowBe4, NinjaOne, Cloudaware have standalone cadence meetings that should become series roots after Phase 2 standalone-to-series conversion is built
