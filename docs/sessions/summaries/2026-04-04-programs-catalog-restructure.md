# Session Summary: 2026-04-04 — Programs Catalog Restructure

## What Was Done

This session completely restructured the Programs catalog — Roadrunner's reference table for all AWS partner programs, competencies, service ready designations, funding vehicles, and strategic agreements. The work was purely catalog/data focused, not frontend feature development.

The session began with a deep examination of the Programs and Events tables in Airtable via MCP, identifying structural problems: the flat "Type" field mixed fundamentally different program mechanisms (competencies, funding, SCAs) into one taxonomy, MDF dollar amounts were buried in freetext, lifecycle data was inaccurate (competencies don't expire on a 12-month cycle), and 13 Service Ready designations were missing from the catalog entirely.

A two-level taxonomy was designed and implemented: Category (5 values: Specialization, Funding, Agreement, Operational, Enablement) × Subtype (13 values). Six new structured fields were added to Airtable (Category, Subtype, MDF Value, SCA Stackable, Partner Path, Parent Program), populated across all 85 records, and the old Type field was deleted. Migration 084 added corresponding columns to Supabase and dropped the old type column with its CHECK constraint.

The sync pipeline was overhauled end-to-end: field-maps.ts (8→13 entries), pull.ts mapper, utils.ts validation sets, types.ts (ProgramType union replaced with ProgramCategory + ProgramSubtype), TypeBadge component (8-type color map → 5-category), ProgramsClient (filter bar, grouping, display), program detail page (new structured field display), API PUT validation, and db/catalog.ts update signature. All 444 tests continue passing.

After the structural work, all 85 records were corrected for lifecycle accuracy: competencies and service ready changed from "recurring" to "indefinite" with duration "Maintained while FTR and prerequisites are met", SCAs changed from "6-12 months" to "1–3 years, individually negotiated", and text field boilerplate was stripped from Requirements and What It Unlocks (MDF amounts now live in the structured field).

One mistake occurred: I advised Steven to delete the "From field: Parent Program" inverse link field, which destroyed the Parent Program forward link. This was fixed by recreating the link field with a new field ID and re-linking the Agentic AI Category record. Lesson documented in decision #408.

## Stats Change

| Metric | Before | After |
|--------|--------|-------|
| Migrations | 83 | 84 |
| Programs records | 72 | 85 |
| Tests | 444 | 444 |
| Pages | 14 | 14 |
| Decisions | #405 | #412 |

## Key Changes

- Migration 084: Added category, subtype, mdf_value, sca_stackable, partner_path, parent_program_airtable_id columns to programs table. Dropped type column and programs_type_check constraint.
- 6 new Airtable fields created on Programs table: Category, Subtype, MDF Value, SCA Stackable, Partner Path, Parent Program
- Old Type field deleted from Airtable (was already dropped from Supabase via migration)
- 13 new Service Ready records created: Outposts, EC2 Spot, CloudFront, Connect, EKS, Security Lake, Control Tower, SageMaker, Redshift, API Gateway, Config, Security Incident Response, Direct Connect
- Sync field map overhauled: PF constant went from 8 to 13 entries
- ProgramType union → ProgramCategory + ProgramSubtype in types.ts
- ProgramTypeBadge → ProgramCategoryBadge with 5-category color map
- ProgramsClient filter bar: 8 old types → 5 categories with subtype secondary display
- Program detail page: shows Partner Path, MDF Value, SCA Stackable indicator, subtype pill
- API PUT validation updated for new field set
- All 85 records: lifecycle corrected, text boilerplate stripped, structured fields populated
- Parent Program link field recreated after accidental deletion (new field ID: fldI4mLHW39Abk2c4)

## Decisions Logged: #406–#412

| # | Title | Impact |
|---|-------|--------|
| 406 | Programs two-level taxonomy | Category + Subtype replaces flat Type, migration 084 |
| 407 | Structured MDF/funding fields | MDF Value, SCA Stackable, Partner Path as first-class columns |
| 408 | Parent Program self-referencing link | Sub-category pattern; inverse fields must be hidden not deleted |
| 409 | Competencies/Service Ready lifecycle = indefinite | No expiration, persists while FTR maintained |
| 410 | Programs catalog expanded 72→85 | 13 new Service Ready designations from AWS research |
| 411 | Text field boilerplate extraction | Stripped repeated MDF/renewal language, kept domain-specific content |
| 412 | Sync pipeline full field map overhaul | 7 files updated across sync, types, UI, API layers |

## Docs Updated

- decisions.md: +7 entries (#406–#412)
- docs/goal-state.md: completed items, new catalog-focused priorities, stats updated
- docs/entity-model.md: Programs table section rewritten for new schema
- CLAUDE.md: migration count, decision count updated

## Current State

84 migrations, 17 tables, 35 API routes, 14 pages, 444 tests, tsc clean. Programs catalog fully restructured with 85 records across 5 categories, all with accurate lifecycle data, structured MDF values, and clean text fields. Sync pipeline pulls all new fields. /programs page displays category badges, subtype labels, and MDF values. Programs is production-ready.

## Next Session Priorities

1. **Immediate: Partner Programs junction table** — Review the structure of the Partner Programs table (tbl1CPtbVzQvRN8LA, ~80 records). Key issues to address: Type field only has 4 values vs catalog's 13 subtypes, 58/80 records have null program_id (not linked to catalog), freetext "Program ID" field is inconsistent with catalog names. Goal: clean structure, accurate enrollment data, every record linked to catalog.
2. **Immediate: Events catalog** — Same structural analysis as Programs. Review field schema, research current 2026 event data, verify dates/locations, check for missing events, improve metadata. 44 records currently.
3. **Immediate: Partner Events junction** — Currently 0 records. After Events catalog is clean, seed partner event participation data.
4. **Soon: Docs update pass** — entity-model.md Programs section was rewritten this session, but a broader docs refresh may be needed after junction tables are also restructured.

## Open Questions

- Should the Partner Programs junction table adopt the same Category/Subtype taxonomy as the catalog, or keep its own simplified classification?
- For Events catalog: do we need a "Relevance" or "Priority" field to distinguish events Steven actively tracks vs. reference events?

## Pre-existing Issues

- 58/80 Partner Programs junction records have null program_id (display works via program_name fallback)
- Partner Events junction is completely empty — needs seeding
- 5 null-email participants in registry
- 4 nameless participants
- 41 tasks without engagement_id
- Vasion duplicate Partner Cadence series needs manual merge
- 11 completely orphaned participants

## Process Learnings

- Catalog data sessions are fundamentally different from dev sessions — the work is research → structure → seed → verify, not diagnose → plan → implement → test. The session template still works but the rhythm is different.
- Web research for AWS program data was effective for identifying missing records and validating structure, but insufficient for lifecycle/renewal accuracy. Steven's operational knowledge was essential for correcting "rolling 12-month renewal" to "indefinite."
- The Airtable MCP is powerful for batch data operations but has footguns: self-referencing link fields create paired forward/inverse fields, and deleting the inverse destroys the forward link. This must be documented as a constraint. Hide, never delete.
- Doing schema changes in Airtable first, then building the Roadrunner sync/UI to match, is the right order for catalog work. Trying to do both simultaneously would have been error-prone.
- The boilerplate extraction was worth doing but should have been done during the initial data population, not as a separate pass afterward. For Events, we should establish clean text patterns upfront.
