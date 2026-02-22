# Roadrunner — Architectural Decisions

> Append-only log. Newest entries at the bottom.

---

## ADR-001: Meeting Notes — Airtable-Only Scratch Space

**Date:** 2026-02-18
**Status:** Implemented

**Decision:** Stop pushing meeting.notes from Roadrunner to Airtable. Stop populating meeting.notes from ICS DESCRIPTION in Supabase. Airtable Notes field on Meetings table is manual-only.

**Context:** ICS DESCRIPTION contains Zoom/Teams boilerplate (dial-in numbers, passcodes, SIP addresses) that dominated the meeting detail UI and Airtable Notes field with useless data.

**Rationale:** Meeting structured fields (date, time, location, attendees, links) already capture everything useful. Notes in Airtable serves as optional scratch space for post-meeting annotations. ICS DESCRIPTION has no value once the structured fields are populated.

**Impact:** `createMeetingFromICS()` no longer sets notes. `sync.ts` no longer pushes `MF.notes`. UI conditionally hides empty notes section.

---

## ADR-002: Meeting Partner as Linked Record

**Date:** 2026-02-18
**Status:** Implemented

**Decision:** Convert Meeting Partner field from singleLineText to multipleRecordLinks, matching Engagement Partner pattern.

**Context:** `sync.ts` was already doing record ID lookups but writing to a text field, which would fail or write literal record ID strings.

**Rationale:** Consistency with Engagement Partner. Enables cross-table views. Sync code already had the right logic, just needed the Airtable field type to match.

**Impact:** Airtable field manually converted. `sync.ts` partner push already sent `[recordId]` format. No code change needed.

---

## ADR-003: Engagement Participants Synced to Stakeholder Fields

**Date:** 2026-02-18
**Status:** Implemented

**Decision:** Populate AWS Stakeholders, Partner Stakeholders, and Third Parties in Airtable from Roadrunner's participants + participant_links tables.

**Context:** These three text fields existed in Airtable but were only manually populated. Roadrunner had structured participant data that wasn't flowing to Airtable.

**Rationale:** Field ownership principle — every Airtable field is either synced or Airtable-only. These fields had participant data in Roadrunner that should be authoritative.

**Impact:** New `fetchEngagementParticipants()` function with batch-fetch support. Three-bucket split using same classification as meeting attendees. Both single-push and bulk-sync paths updated.

---

## ADR-004: Field Ownership Principle

**Date:** 2026-02-18
**Status:** Implemented

**Decision:** Every Airtable field must be either (1) synced from Roadrunner or (2) Airtable-only for a stated reason. No half-synced fields, no orphans.

**Context:** Audit revealed participant data in Roadrunner not flowing to stakeholder fields, meeting notes being pushed as raw ICS data, tags sent as wrong type.

**Rationale:** Clear ownership prevents stale data, conflicting sources of truth, and sync bugs. Makes it immediately obvious whether a field change should happen in Roadrunner or Airtable.

**Impact:** Governs all future field additions. Documented in FIELD-MAPPING.md.

---

## ADR-005: Engagement Summary Column Dropped

**Date:** 2026-02-18
**Status:** Implemented

**Decision:** Remove the summary column from engagements table. `current_state` is the sole source of truth.

**Context:** `summary` was created in migration 001, annotated as legacy in migration 010. Classifier was mirroring `current_state` into `summary` on every write. UI only used it as fallback.

**Rationale:** Dead column that's always a copy of `current_state`. Creates confusion about which field is authoritative. The fallback path in UI would never trigger.

**Impact:** Removed from `types.ts`, `supabase.ts`, `classifier.ts`, 3 UI files, 3 test files. Migration 035 drops the column.

---

## ADR-006: Forwarder Note = Substantive Text Only

**Date:** 2026-02-18
**Status:** Implemented

**Decision:** Filter signature blocks from forwarder note detection. Only substantive text (actual sentences, instructions, context) should be captured as `forwarder_note`.

**Context:** Outlook auto-inserts signature blocks when forwarding. The parser was capturing these as `forwarder_note`, sending corporate contact info to Claude as editorial context.

**Rationale:** Pattern-based detection using capitalization rules (title-case words = signature, lowercase words = substantive) is generic and doesn't require hardcoding specific signatures. 14 patterns cover corporate signature components.

**Impact:** `stripSignatureLines()` function in `email-parser.ts`. 12 new tests. Works for any user's signature, not just Steven's.

---

## ADR-007: Full-Width Detail Pages — No Sidebars

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** Detail pages use full-width stacked layout. Sidebars eliminated.

**Context:** Partner and Meeting detail pages had sidebars duplicating header metadata and burying important content (AWS Context on partners, attendee grouping on meetings).

**Rationale:** Sidebars create duplication and bury content below the fold on the less-visible right column. Full-width layout gives every section equal access to horizontal space and establishes a scannable top-to-bottom reading flow.

**Impact:** Partner detail, Meeting detail converted. Pattern applies to all future detail page work.

---

## ADR-008: Two-Column Context Cards

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** Dense identity content merges into single two-column cards (responsive: side-by-side desktop, stacked mobile).

**Context:** Partner detail had "What They Do" as a throwaway subtitle and AWS Context as a separate card — together consuming ~50% of viewport.

**Rationale:** Two related pieces of context (business description + AWS relationship context) belong together visually. Single card with two columns communicates "these are complementary" while halving vertical space.

**Impact:** Partner detail uses this for What They Do + AWS Context. Pattern reusable for any detail page with two complementary context blocks.

---

## ADR-009: Viewport Budget — Identity + Context ≤ 1/3 Viewport

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** On detail pages, header + context sections must not exceed approximately one-third of viewport height.

**Context:** Partner detail page was top-heavy — meetings, engagements, and relationships pushed entirely below the fold.

**Rationale:** Activity content (what you interact with) should be visible without scrolling. Identity content (what something is) is reference material that supports activity, not the primary focus.

**Impact:** All detail pages. Forces condensed context treatments and prevents creeping header bloat.

---

## ADR-010: Attendee Grouping by Email Domain

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** Meeting attendees grouped by organization (AWS/Partner/Other) using email domain matching. Relay inbox address filtered out.

**Context:** Meeting detail had flat ungrouped attendee list including the relay forwarding address.

**Rationale:** Domain-based grouping is deterministic and maintenance-free — no manual tagging needed. Filtering relay address removes infrastructure noise from user-facing display.

**Impact:** Meeting detail page. Pattern applies anywhere attendees are displayed.

---

## ADR-011: Meeting-in-Thread Distinct Card Pattern

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** Messages with associated meetings render as visually distinct clickable cards in engagement email threads.

**Context:** Meeting invites in Source Emails section looked identical to regular email replies — no way to distinguish a scheduled event from a conversation message.

**Rationale:** Meetings are temporal events with structured data (date, time, location) that regular emails don't have. Visual distinction communicates "this is a different kind of thing" without breaking chronological flow.

**Impact:** Engagement detail page. Pattern: temporal entities get distinct treatment in non-temporal contexts.

---

## ADR-012: Three-Tier Visual Weight by Entity Type

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** Temporal entities (meetings) get timeline/card treatment. Workstreams (engagements) get status-driven lists. Structural entities (AWS relationships) get compact minimal lists.

**Context:** Partner detail previously treated engagements, meetings, and relationships with identical flat sections despite fundamentally different characteristics.

**Rationale:** Visual weight should match how frequently an entity changes and how time-sensitive it is. Meetings change daily (upcoming→past), engagements change weekly (status progression), relationships change rarely.

**Impact:** Partner detail page sections. Pattern applies system-wide wherever mixed entity types appear together.

---

## ADR-013: URL-as-Location Detection

**Date:** 2026-02-22
**Status:** Implemented

**Decision:** Location fields containing URLs render as clickable action buttons. Physical addresses render as plain text.

**Context:** Meeting locations showing raw Zoom URLs as long unformatted strings.

**Rationale:** URLs are actionable (you click them to join), addresses are informational (you read them). Different data types deserve different rendering.

**Impact:** Meeting detail page and meeting-in-thread cards. Pattern applies anywhere location fields are displayed.
