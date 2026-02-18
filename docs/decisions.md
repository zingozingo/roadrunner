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
