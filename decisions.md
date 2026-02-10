# Architecture Decision Log

## 2025-02-06: Project scaffold

Next.js 14 App Router + TypeScript + Tailwind. Supabase Postgres for data. Single-user app with service key auth (no RLS). Three core entities: Initiatives, Events, Programs linked via generic entity_links table. Intelligence lives in prompt, not code.

## 2026-02-07: Inbound Webhook Form Data Extraction with Fallback

**Decision:** Rewrote /api/inbound to try request.formData() first, fall back to URL-encoded text parsing. Signature fields are optional — log and warn if missing, never 406.

**Context:** Every Mailgun webhook returned 406 because the code checked for missing timestamp/token/signature fields BEFORE the signature bypass logic. formData() was also silently failing on some Vercel runtimes.

**Rationale:** Defense in depth. Mailgun's payload format can vary. Making signature fields optional during development lets us debug the rest of the pipeline independently.

**Impact:** Inbound pipeline works. Signature verification must be re-enabled with correct approach before production use.

## 2026-02-07: Events Restricted to Shared Calendar Anchors

**Decision:** Events table is ONLY for conferences, program deadlines, and shared milestones that exist independently of any initiative. Meetings, calls, and initiative-specific activities belong in the initiative summary timeline only.

**Context:** Claude created "CloudAware Cadence Call" as an Event entity from casual email language about setting up a recurring call. This pollutes the Events table with initiative-level activities.

**Rationale:** Events should be things that would matter even if you deleted every initiative. A cadence call between two people is not that. The test: "Would this appear on a public/team calendar regardless of partner work?"

**Impact:** Classification prompt Rule 8 needs tightening. Events page should stay lean (10-20 entries max). Existing incorrect events should be cleaned up.

## 2026-02-07: Meeting Invitations Identified by ICS Attachment Only

**Decision:** Meetings are only recognized when a forwarded email contains an .ics calendar attachment. Casual language like "let's set up a call" does NOT create a meeting — it becomes an open item in the initiative summary.

**Context:** The system was treating email prose about potential calls as confirmed meetings, which is inaccurate.

**Rationale:** An .ics file has structured data (title, time, attendees, location). This is ground truth. Email prose is aspirational. The distinction keeps timelines honest.

**Impact:** Email parser needs .ics detection. Classifier needs content_type: meeting_invitation. Summary timeline distinguishes [Email] entries from [Meeting] entries.

## 2026-02-07: Initiative Names Are for Humans, Summaries Are for Claude

**Decision:** Users can freely rename initiatives. Claude matches incoming emails using the full initiative summary, participant list, and metadata — not just the name string.

**Context:** User asked whether renaming an initiative would break future email matching.

**Rationale:** The summary contains the rich context (partner names, topics, history) that Claude uses for matching. The name is a UI convenience.

**Impact:** Safe to add initiative name editing. No matching logic changes needed.

## 2026-02-07: Forwarding User as Implicit Participant

**Decision:** The user's own email (the PDM forwarding emails to the relay) should be treated as a known constant, not extracted as a new participant each time.

**Context:** Steven Romero appears in the participants table without an organization, and shows up redundantly since he's the forwarding user on every single email.

**Rationale:** The PDM is always a participant by definition — they forwarded the email. Extracting them adds noise. They should be a system-level config, not a per-message discovery.

**Impact:** Need a USER_EMAIL or PDM_EMAIL env var. Classifier should exclude this email from participant extraction. Existing participant record for the user can be linked to all initiatives automatically.

## 2026-02-07: Dashboard as Primary Review Interface

**Decision:** The inbox page in the dashboard is the primary way to resolve pending reviews, not a fallback for SMS. SMS is a notification channel that supplements the dashboard.

**Context:** Twilio A2P 10DLC registration takes days. Can't block the entire project on SMS approval.

**Rationale:** Even after SMS works, the dashboard provides a richer review experience — you can see the full email, the confidence bar, create custom initiative names. SMS is for quick approvals on the go.

**Impact:** Inbox page must be robust and reliable. SMS becomes a "hey, check your inbox" notification rather than the sole resolution mechanism.

## 2026-02-07: Message Deduplication by Content Hash

**Decision:** Before storing a new message, check for existing message with same sender_email + subject + first 100 chars of body_text. Skip if duplicate.

**Context:** Mailgun retries on timeout (our classification takes >30s), and during testing the same email created multiple pending reviews.

**Rationale:** Simple content-based dedup catches retries and accidental re-forwards without requiring message-id tracking.

**Impact:** Prevents duplicate reviews. Mailgun timeout "failures" are harmless — the message was already processed.

## 2026-02-07: Git Push Deploys to Vercel

**Decision:** Use git push to trigger Vercel auto-deploys instead of npx vercel --prod CLI deploys.

**Context:** CLI deploys created a separate deployment from the Git-linked one, causing confusion about which deployment was live.

**Rationale:** Standard workflow. One deployment source of truth.

**Impact:** All future deploys via git push. CLI deploy only as fallback.

## 2026-02-09: Events vs Meetings — Structural Distinction

**Decision:** Events are only real-world gatherings (conferences, summits, workshops, kickoffs, trade shows, training, deadlines, review cycles). Meetings (calls, demos, cadence calls, 1:1s) are NEVER events. Meetings only enter the system via .ics calendar attachments (future feature), not from prose mentions in email bodies.

**Context:** System was over-creating events from casual meeting mentions. "Let's set up a cadence call for March" was incorrectly becoming an Event entity.

**Rationale:** Events must pass the test "Would multiple initiatives care about this?" A cadence call is initiative-specific workflow. A conference is a shared calendar anchor.

**Impact:** Classification prompt event rules, event type enum (meeting_series removed), future .ics parsing feature design, event approval flow.

## 2026-02-09: New Events Always Require User Approval

**Decision:** Claude identifies new events (is_new: true in events_referenced) but the system never auto-creates them. They surface in the inbox as event approval cards. User explicitly approves or denies.

**Context:** Events were being silently created as side effects during initiative approval via persistClassificationEntities(). User approved one thing, got three things created.

**Rationale:** Event creation has broad impact — multiple initiatives reference the same event. Worth the friction of manual approval to prevent event pollution.

**Impact:** EventApprovalCard in inbox, approval_queue with type='event_creation', classifier skips new event creation.

## 2026-02-09: Initiative Auto-Assign Decoupled from Event Creation

**Decision:** New event suggestions in events_referenced do NOT block initiative auto-assignment. A 0.95 confidence initiative match auto-assigns even if Claude also suggests a new event.

**Context:** hasNewEntitySuggestions checked events_referenced, blocking auto-assign when Claude happened to notice a conference mentioned in the email.

**Rationale:** Initiative routing and event creation are independent decisions. Renamed to hasNewTrackSuggestions — only new initiatives and new tracks/programs block auto-assign.

**Impact:** classifier.ts orchestration logic, auto-assign throughput.

## 2026-02-09: Auto-Create New Initiatives at ≥0.85 Confidence

**Decision:** When Claude suggests a new initiative with confidence >= 0.85, create it automatically without inbox review. Below 0.85 routes to inbox.

**Context:** Every new initiative required manual approval even at 95% confidence. Unnecessary friction for obvious new partner discussions.

**Rationale:** At 0.85+ Claude is confident enough. User can edit/delete via CRUD. Falls back to review on creation failure.

**Impact:** classifier.ts hasHighConfidenceNew path, createInitiative called during classification.

## 2026-02-09: Unified Approval Queue

**Decision:** Single approval_queue table with type discriminator ('initiative_assignment' | 'event_creation') replaces separate pending_reviews and pending_event_approvals tables.

**Context:** Two tables doing the same lifecycle (create → review → resolve) caused FK cascade failures on initiative deletion, duplicated query logic, duplicated resolution handlers, inconsistent inbox UX.

**Rationale:** One table, one inbox query, one resolution endpoint, one count query. initiative_id FK uses ON DELETE SET NULL to prevent cascade failures.

**Impact:** Migration 006 (data migration + table drops), 17 files changed, all inbox/classification/SMS code updated.

## 2026-02-09: Application-Level Cascade Deletes

**Decision:** No DB-level ON DELETE CASCADE. Delete functions explicitly handle cleanup in order: orphan messages (set initiative_id = null), delete notes, delete entity_links (both directions), delete participant_links, delete approval_queue entries, then delete entity.

**Context:** DB cascades are invisible — one accidental delete silently wipes all related data with no logging.

**Rationale:** Application code is more verbose but explicit, loggable, and controllable. Messages are deliberately orphaned (preserved for potential reassignment) rather than destroyed.

**Impact:** deleteInitiative(), deleteEvent(), deleteTrack() in supabase.ts.

## 2026-02-09: Programs → Tracks Rename (UI Only)

**Decision:** "Programs" renamed to "Tracks" in all user-facing UI and prompt language. Database table stays "programs". JSON field stays "programs_referenced".

**Context:** "Programs" was too narrow. The system tracks formal AWS programs, GTM motions, technical milestones, certifications, and strategic relationships — "Tracks" is a broader container.

**Rationale:** UI rename is instant. DB rename would require migrating all existing data, updating all queries, for zero functional benefit.

**Impact:** Sidebar, page titles, URL (/tracks), prompt text, EntityLink labels. /programs redirects to /tracks.

## 2026-02-09: Participants Can Have Partial Data

**Decision:** Participants can be created with name only (email nullable). Missing fields displayed as placeholders in the UI.

**Context:** Claude extracts participants by name from email body text, but most don't have email addresses. The NOT NULL constraint on email was silently dropping 4 of 5 extracted participants.

**Rationale:** Partial data is better than no data. Users can fill in email/title later via CRUD (to be built) or as more emails arrive with additional context.

**Impact:** Migration 007 (email DROP NOT NULL), upsertParticipants name-only path, UI placeholders. NOTE: Participant insert had additional bug (.single() → .maybeSingle()) that may still not be fully working — needs verification next session.

## 2026-02-09: Structured Data Over Free-Text Parsing (IN PROGRESS)

**Decision:** Initiative detail page should render from structured JSON fields (current_state, timeline_entries, open_items) stored as JSONB columns on initiatives table, not from parsing Claude's free-text summary string.

**Context:** Claude inconsistently formats free-text summaries. ISO dates leak into prose, specific dates fabricated from vague timeframes, regex section parsing is brittle. Multiple attempts to fix via prompt refinement failed.

**Rationale:** Structured JSON arrays are deterministic to render. Each section becomes its own purpose-built UI component. The classification prompt outputs structured fields alongside the text summary.

**Impact:** Migration 008 (adds current_state text, timeline_entries jsonb, open_items jsonb to initiatives). SummaryCard deleted, replaced with CurrentStateCard, TimelineCard, OpenItemsCard. INCOMPLETE — Claude is outputting old-format text (with **Participants:**, **Timeline:** headers) into current_state field instead of clean narrative. The prompt, classifier extraction, and/or initiative update logic need debugging. This is the #1 priority for next session.

## 2026-02-09: No Hardcoded Entity Links

**Decision:** Claude's entity_links array is the sole source of semantic relationships between entities. Code no longer auto-generates "relevant_to" links in persistClassificationEntities().

**Context:** Code was creating a hardcoded "relevant_to" link for every event and program mentioned, then ALSO processing Claude's semantic entity_links. This caused duplicate links (relevant_to + preparation_for for the same pair).

**Rationale:** Claude provides more specific relationship types (preparation_for, qualifies_for, deadline, etc.). Generic relevant_to adds noise and duplicates.

**Impact:** persistClassificationEntities in reviews/resolve/route.ts, classifier.ts.

## 2026-02-09: EntityLinkChip Must Use Caller-Resolved Entity Type

**Decision:** EntityLinkChip accepts an explicit `entityType` prop for the "other" entity's type. Detail pages compute `otherType = isSource ? link.target_type : link.source_type` and pass it. The chip uses this for label, color, and href — never blindly reading `link.target_type`.

**Context:** Entity links are bidirectional — `getEntityLinksForEntity()` fetches links where the entity is either source or target. `EntityLinkChip` was hardcoded to `link.target_type` for the type label, color, and href. This only worked when the current page's entity was the source of the link. When viewing from the target side, the chip displayed the wrong type label (e.g., "Track" instead of "Initiative"), used the wrong color, and linked to a 404 URL (e.g., `/tracks/[initiative-id]` instead of `/initiatives/[initiative-id]`).

**Rationale:** Claude generates entity links in arbitrary direction — `initiative → program` or `program → initiative` are both valid. The rendering layer can't assume which side is source vs target. The detail page already knows (`isSource = link.source_id === id`), so it should resolve and pass the other entity's type explicitly.

**Impact:** EntityLinkChip component (new `entityType` prop), all 3 detail pages (initiatives, events, tracks). Fixes wrong labels, wrong colors, and 404 links for all 6 possible link direction × view-side combinations.

## 2026-02-09: Single "Linked Entities" Chip Section (No Duplicate Lists)

**Decision:** Entity relationships on detail pages are displayed ONLY as EntityLinkChip pills in a single "Linked Entities" section. Removed the separate "Linked Initiatives" list sections from track and event detail pages.

**Context:** Track and event detail pages had two sections showing the same data: a "Linked Entities" chip section (from `getEntityLinksForEntity`) and a "Linked Initiatives" list section (from `getLinkedInitiativesForEntity`). Both queried `entity_links`. An initiative linked to a track appeared twice — once as a chip with relationship label, once as a list item with status badge.

**Rationale:** One data source, one display. The chips already show type label, entity name, relationship, color, and link to the detail page — strictly more information than the list. The initiative detail page was already chips-only. Removes a redundant Supabase query per page load.

**Impact:** Removed `getLinkedInitiativesForEntity` from track and event page components. Function kept in supabase.ts (still used by API routes). All 3 detail pages now use the same pattern: chips only.

## 2026-02-09: Kill timeline_entries Entirely

**Decision:** Removed timeline_entries from the data model, types, prompt, classifier, and database. Initiative timelines are now simply the chronological list of received emails. Real meeting dates will come from .ics parsing in a future phase.

**Context:** Claude-generated timelines fabricated specific dates from vague email language ("let's meet next week" → "[Feb 14] Meeting scheduled"). The timeline_entries JSONB column was added in migration 008 but never reliably populated.

**Rationale:** Fabricated dates are worse than no dates. Email receipt timestamps are ground truth. The .ics parsing feature (v0.2) will add real meeting dates when implemented.

**Impact:** Migration 009 drops timeline_entries column. TimelineCard.tsx deleted. Timeline type removed from types.ts. Prompt no longer requests timeline extraction. NOTE: master-spec.md still references timeline in the initiative summary format — needs future update.

## 2026-02-09: current_state Is Source of Truth for Initiative Narrative

**Decision:** The `current_state` text column is the primary field for the initiative's narrative. It contains a 3-5 sentence executive briefing. The legacy `summary` field is kept for backward compatibility — edit form saves to both, display uses `current_state ?? summary` fallback.

**Context:** The original `summary` field contained a structured multi-section text blob (Participants, Timeline, Current State, Open Items). With participants, timeline, and open items now in their own structured fields/tables, the remaining narrative needed a clean home.

**Rationale:** Renaming `summary` → `current_state` in the DB would require a migration and risk breaking existing data. Dual-write is cheap and maintains backward compat with any code still reading `summary`.

**Impact:** initiatives.current_state column (migration 008), CurrentStateCard component, InitiativeActions edit form writes both fields, classifier outputs current_state.

## 2026-02-09: Simplified ClassificationResult — Removed Dead Fields

**Decision:** Removed `temporal_references`, `action_items`, `summary_update`, and `timeline_entries` from the ClassificationResult type and Claude prompt. These fields were defined in the type but never extracted or used by the classifier.

**Context:** The prompt included instructions to extract these fields, consuming ~30 lines of prompt tokens, but the classifier code never read them from Claude's response.

**Rationale:** Dead code in the prompt wastes tokens and increases response latency. Removing unused fields makes the contract between prompt and code honest.

**Impact:** ClassificationResult type in types.ts, Claude prompt in claude.ts. Saves tokens per classification call.

## 2026-02-09: Consolidated upsertParticipants into supabase.ts

**Decision:** Single `upsertParticipants()` function in supabase.ts replaces duplicate implementations in classifier.ts (~116 lines) and reviews/resolve/route.ts (~120 lines). Both call paths now use the same function.

**Context:** The two copies had drifted — different error handling, different dedup logic, different edge case behavior. Bug fixes applied to one weren't applied to the other.

**Rationale:** Single source of truth. Fix once, works everywhere. Also consolidated `ensureParticipantLink()` and added `appendOpenItems()` in the same refactor.

**Impact:** classifier.ts and resolve/route.ts import from supabase.ts. ~230 lines of duplicate code removed.

## 2026-02-09: Resolve Route Must Update Structured Fields for Existing Initiatives

**Decision:** When an email is assigned to an existing initiative via the resolve route, the route now updates `current_state` and appends `open_items` (deduplicated) — matching the auto-assign behavior in the classifier.

**Context:** Bug — the resolve route only updated the `summary` column when assigning to an existing initiative. The new structured fields (`current_state`, `open_items`) were silently dropped, so manually resolved emails didn't update the initiative's state.

**Rationale:** Both paths (auto-assign and manual resolve) should produce the same result. A user resolving a review should see the same data updates as an auto-classified email.

**Impact:** reviews/resolve/route.ts — added `updateInitiative()` call with current_state and `appendOpenItems()` call in the "select existing" path.

## 2026-02-09: force-dynamic on All Supabase-Fetching Pages

**Decision:** All 7 database-backed pages export `const dynamic = "force-dynamic"` to prevent Next.js App Router from statically caching them at build time.

**Context:** Only the inbox page had `force-dynamic`. All other pages (initiatives list/detail, events list/detail, tracks list/detail, home) were statically rendered at deploy time by Vercel. Users saw stale data even after deleting records in Supabase.

**Rationale:** This is a live dashboard backed by a database. Every page load must hit Supabase for current data. Static caching is fundamentally incompatible.

**Impact:** Added to: page.tsx (home), initiatives/page.tsx, initiatives/[id]/page.tsx, events/page.tsx, events/[id]/page.tsx, tracks/page.tsx, tracks/[id]/page.tsx.

## 2026-02-09: Defensive Entity Link Rendering (Orphan Skip)

**Decision:** Detail pages skip rendering `EntityLinkChip` when `resolveEntityLinkNames()` returns no name for the linked entity. This prevents broken/empty chips when one side of an entity link has been deleted.

**Context:** `resolveEntityLinkNames()` queries initiatives/events/programs tables by ID. If an entity was deleted, the ID returns no row, so the nameMap has no entry. The chip would render with an undefined name and link to a valid-looking URL for a nonexistent entity.

**Rationale:** Defensive rendering is simpler and more robust than cascading entity_link cleanup on every delete. Orphaned links are harmless in the DB and get skipped in the UI.

**Impact:** All 3 detail pages: `if (!otherName) return null;` guard before EntityLinkChip render.

## 2026-02-09: Participant CRUD — Edit Is Global, Delete Is Unlink

**Decision:** Editing a participant (name, email, title, organization) updates the `participants` record globally — changes appear everywhere that participant is linked. Removing a participant from an initiative deletes only the `participant_links` row; the participant record is preserved for other initiatives.

**Context:** Participants are shared across initiatives (e.g., an SA appears on multiple partner engagements). Editing contact info should propagate. But removing someone from one initiative shouldn't delete them from others.

**Rationale:** Participants are people, not initiative-scoped data. The link is the scoped relationship. This matches how real organizations think about contacts.

**Impact:** ParticipantList.tsx (client component), API routes: PUT /api/participants/[id] (global edit), DELETE /api/participant-links/[id] (unlink), POST /api/initiatives/[id]/participants (create + link).

## 2026-02-09: participant_links Unique Constraint

**Decision:** Added UNIQUE INDEX on `(participant_id, entity_type, entity_id)` to the participant_links table. Prevents duplicate links at the database level.

**Context:** `upsertParticipants()` does a select-before-insert to avoid duplicates, but concurrent classification of the same email (e.g., Mailgun retry) could race past the check and create duplicate links.

**Rationale:** Application-level dedup handles the common case. The DB constraint catches race conditions. Belt and suspenders.

**Impact:** The unique index means insert failures on duplicate are expected — code uses `.maybeSingle()` and handles conflicts gracefully.

## 2026-02-10: Rename Initiatives → Engagements

**Decision:** Rename "initiatives" to "engagements" across the entire system — database, API, UI, prompt, types.

**Context:** "Initiative" is vague and overloaded. The system tracks partner engagements — a specific partner working toward a specific goal. "Engagement" is what PDMs actually call these workstreams.

**Rationale:** The name should reflect the domain language. Every forwarded email is about engaging with a partner on something concrete.

**Impact:** Database table rename (or alias), API route rename (/api/engagements/), UI labels, classification prompt, TypeScript types. Redirect from old /initiatives/ URLs.

## 2026-02-10: Events and Programs Are Seed-Only

**Decision:** Events and programs are pre-seeded reference data managed through an admin interface. Claude matches against them by ID but never creates them. No AI creation. No user creation UI on the main dashboard.

**Context:** v0.1 allowed Claude to create events (via approval queue) and programs (via findOrCreateProgram). This caused fabricated events from vague email language, duplicate programs from fuzzy matching failures, and a complex event approval flow.

**Rationale:** Programs (~15-20) and events (~10-15/year) are small, stable datasets. Admin seeding is more reliable than AI creation. Eliminates fabrication risk, duplication bugs, and approval queue complexity.

**Impact:** Remove event creation pathway from classifier and resolve route. Remove program creation from classifier. Remove event_creation approval type. Add admin page and bulk seed endpoints.

## 2026-02-10: Add Tags System

**Decision:** Tags are a JSONB string array on the engagements table. Freeform labels. Claude suggests tags during classification, users can add/edit/remove freely. Tags are filterable in the engagements list.

**Context:** Not everything fits into programs, events, or entity links. Campaigns ("FinServ Q2"), partner events ("Wiz Innovation Summit"), strategic labels ("exec-sponsored"), workflow states ("waiting-on-legal"), segments ("public-sector") need a home.

**Rationale:** Tags are the escape valve for arbitrary categorization without schema changes. Cheap to add, easy to filter, no foreign keys or relationship management needed.

**Impact:** Add `tags jsonb DEFAULT '[]'` to engagements table. Add `suggested_tags` to ClassificationResult. Add tag pills to engagement cards and detail page. Add tag filter to engagements list.

## 2026-02-10: Remove Event Creation Pathway

**Decision:** Claude can no longer create events. The `is_new` field for events_referenced is removed from the prompt and type. Events are matched by ID only. The event_creation approval type is removed.

**Context:** Claude fabricated events from vague email mentions ("New York Summit 2026" from a passing reference). The event approval flow added complexity (EventApprovalCard, handleEventApproval, entity_data JSONB) for low-value entity creation. Real events are a small, known set.

**Rationale:** Eliminating event creation removes fabrication risk, the approval queue branch, and the findOrCreateEvent codepath from classification. Events are seeded by an admin who knows the actual conference calendar.

**Impact:** Simplify ClassificationResult type. Remove event_creation from approval_queue. Remove handleEventApproval from resolve route. Remove EventApprovalCard component. Simplify inbox to single approval type.

## 2026-02-10: Remove Program Creation from Classifier

**Decision:** Claude can no longer create programs. Programs are matched by ID only. `findOrCreateProgram()` is no longer called during classification or review resolution.

**Context:** v0.1 auto-created programs via case-insensitive name matching. "ISV Accelerate" vs "AWS ISV Accelerate Program" caused duplicates. Programs are curated reference data (~15-20 total) that shouldn't be AI-generated.

**Rationale:** Admin seeding with exact names eliminates duplication. Claude receives program IDs in context and returns matched IDs — no fuzzy resolution needed.

**Impact:** Remove findOrCreateProgram calls from classifier.ts and resolve/route.ts persistClassificationEntities. Programs only created via admin interface.

## 2026-02-10: Consolidate to Single Persistence Function

**Decision:** A single shared function handles all DB writes after classification — used by both the auto-assign path (classifier.ts) and the manual resolve path (resolve/route.ts).

**Context:** v0.1 had two parallel persistence codepaths: `applyClassificationResult()` in classifier.ts and `persistClassificationEntities()` in resolve/route.ts. They diverged in entity link resolution strategy (context-based vs local entityIdMap), program handling, and open_items merging. Bugs fixed in one path weren't fixed in the other.

**Rationale:** One function, one behavior. Fixes the entity link gap where auto-created engagements couldn't link to programs because the engagement wasn't in the pre-fetched context map.

**Impact:** Extract shared persistence function to supabase.ts or a new persist.ts module. Both classifier and resolve route call it. ~200 lines of duplicate code removed.

## 2026-02-10: Claude Matches Programs and Events by ID Only

**Decision:** Claude receives program and event UUIDs in the classification context and returns matched IDs directly. No name-based fuzzy resolution in application code. No `normalizeEntityName()`, no entity name→ID map building.

**Context:** v0.1 had `createEntityLinks()` in classifier.ts that built a name→ID map and matched Claude's `source_name`/`target_name` strings against it. Normalization was fragile — "AWS re:Invent" vs "re:Invent 2025" could fail to match. The resolve route had a separate resolution strategy.

**Rationale:** IDs are unambiguous. Claude already receives IDs in the context. Returning IDs eliminates the entire name resolution layer and its edge cases.

**Impact:** Prompt changes (entity_links use IDs not names). Remove normalizeEntityName() and createEntityLinks() from classifier.ts. Simplify entity link creation to direct ID-based insert.
