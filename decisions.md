# Architectural Decisions

> Append-only log of significant design and implementation decisions.

---

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

## 2026-02-12: current_state Evolves Rather Than Overwrites

**Decision:** Claude reads the existing current_state from context and evolves it — updating only material changes while preserving accumulated context. Routine emails (scheduling, acks) return the existing state with minimal changes.

**Context:** v0.1 prompt generated a fresh current_state on every email, causing important context to be lost when a routine follow-up arrived. The 3-5 sentence limit forced Claude to pick the most recent information, dropping earlier context about engagement scope, participants, and decisions.

**Rationale:** Engagement state should accumulate knowledge over time. The PDM needs a briefing that reflects the full picture, not just the last email. Evolving state preserves momentum while incorporating new developments.

**Impact:** Updated SYSTEM_PROMPT current_state instructions. No code changes needed — buildUserMessage() already sends existing current_state in context.

## 2026-02-12: open_items Strictly Limited to Explicit Action Items

**Decision:** open_items extraction requires concrete, actionable tasks explicitly stated or clearly implied in the email. Vague intentions, pleasantries, and status commentary are excluded. Assignee model supports person names, multiple people, team names, or null.

**Context:** v0.1 prompt was loose about what constituted an "action item." Claude would extract vague intentions ("let's circle back") and status commentary ("great progress") as open items. Assignees were often wrong or over-attributed.

**Rationale:** Noisy open_items erode trust. Users ignore the list when half the items are fabricated. Strict extraction with realistic assignee patterns (person, "Steven and CJ", "Contrast Security team", null) produces actionable output worth reading.

**Impact:** Updated SYSTEM_PROMPT open_items instructions with positive/negative examples, assignee rules, and due date rules. Empty array explicitly preferred over fabricated items.

## 2026-02-12: Events Schema Simplified — date_precision Removed, host Added

**Decision:** Drop date_precision column from events (either the date exists or it's null). Add host column (text, nullable) for the organization hosting the event.

**Context:** date_precision ("exact", "week", "month", "quarter") added complexity without value — in practice, events either have confirmed dates or they don't. The host field captures a genuinely useful dimension: who's running the event (AWS, RSA Conference, a partner).

**Rationale:** Simpler schema, more useful data. The UI date formatting code that handled quarter/month/week display was removed in favor of straightforward date rendering.

**Impact:** Migration 012 adds host, drops date_precision. Updated Event type, UI components, API routes, and test fixtures.

## 2026-02-12: Programs Lifecycle Model — lifecycle_type + lifecycle_duration

**Decision:** Replace renewal_cycle with lifecycle_type (indefinite/recurring/expiring) + lifecycle_duration (human-readable string, nullable). Default is 'indefinite'.

**Context:** renewal_cycle was a single text field that conflated two concepts: whether a program renews at all and how long its cycle is. "Annual" could mean the program expires yearly or that partners must re-certify yearly.

**Rationale:** lifecycle_type captures the core distinction (does this program end?), while lifecycle_duration captures the timeframe when relevant. Indefinite programs have null duration. This models reality: Security Competency is recurring (annual revalidation), ISV Accelerate is indefinite, a specific funding program might be expiring.

**Impact:** Migration 012 adds both columns with CHECK constraint, drops renewal_cycle. Updated Program type and test fixtures.

## 2026-02-14: Initiatives Renamed to Engagements

**Decision:** Rename "initiatives" to "engagements" across the entire codebase — 38 files including database migration, API routes, UI components, types, prompts, and tests.

**Context:** "Initiative" implied project management. The system tracks ongoing partner relationships through email threads — that's an engagement. "Engagement" is the term PDMs actually use.

**Rationale:** Domain language should drive naming. Every forwarded email is about engaging with a partner on something concrete, not managing a project.

**Impact:** Migration 010 renames database table and all FK references. URL paths changed to /engagements/. TypeScript types renamed. Classification prompt updated. Redirect from old /initiatives/ paths.

## 2026-02-14: Events and Programs Seed-Only, Matched by ID

**Decision:** Claude never creates events or programs. It matches to pre-seeded reference data by UUID only. No fuzzy name resolution in application code.

**Context:** Claude was fabricating events from vague email mentions, duplicating programs from fuzzy name matching, and generating IDs that didn't exist. The event approval flow added complexity for low-value entity creation.

**Rationale:** "Constrain intelligence" — give Claude structured reference data with stable IDs and let it match, not create. Programs (~15-20) and events (~10-50/year) are small enough to seed manually.

**Impact:** Eliminated findOrCreateEvent(), findOrCreateProgram(), EventApprovalCard, event_creation approval type, normalizeEntityName(), and the entire name→ID resolution layer.

## 2026-02-14: Single Shared Persistence Function

**Decision:** Consolidated two parallel persistence codepaths into a single `persistClassificationResult()` function used by both auto-assign (classifier.ts) and manual resolve (resolve/route.ts).

**Context:** Auto-assign path used a stale context map for entity links — engagements created during classification weren't in the map, so their links silently failed. Manual resolve path built a fresh map and worked. Two copies had diverged in error handling, dedup logic, and open_items merging.

**Rationale:** Same job should have same behavior. Fix once, works everywhere.

**Impact:** ~200 lines of duplicate code removed. Entity links no longer fail silently on auto-created engagements. Both paths call the same function with the same signature.

## 2026-02-14: Entity Links via Matched Arrays with Relationship

**Decision:** Removed `entity_links` array from ClassificationResult. The `matched_events` and `matched_programs` arrays with `{ id, name, relationship }` ARE the links.

**Context:** Old `entity_links` array used name-based resolution — `source_name`/`target_name` strings matched against a name→ID map. Normalization was fragile ("AWS re:Invent" vs "re:Invent 2025" failed to match).

**Rationale:** ID-based by construction. If it's in `matched_events`, it has a valid UUID from the context Claude received. No post-hoc resolution needed.

**Impact:** Eliminated name-based entity link resolution entirely. `createEntityLink()` now takes IDs directly from Claude's response.

## 2026-02-14: Content Types Simplified

**Decision:** Reduced content types from 6 to 4: `engagement_email`, `meeting_invite`, `mixed`, `noise`. Removed `event_info` and `program_info`.

**Context:** `event_info` and `program_info` existed to route emails into the event/program creation pathways. Without creation, an email mentioning an event is just an `engagement_email` that matches an event by ID.

**Rationale:** Fewer content types means simpler routing logic and cleaner prompt instructions.

**Impact:** Migration 011 updates existing data. ClassificationResult type simplified. Prompt content_type enum reduced.

## 2026-02-14: Tags System

**Decision:** JSONB string array on engagements table. Claude suggests tags via `suggested_tags` in classification response. Users can edit freely. Lowercase, freeform labels like "co-sell", "poc", "finserv", "marketplace".

**Context:** Needed a categorization mechanism that doesn't require rigid taxonomy. Not everything fits into programs, events, or entity links. Campaigns, strategic labels, workflow states, and segments need a home.

**Rationale:** Tags are cheap, flexible, and can evolve into formal programs if a pattern emerges. No schema changes needed to add new categories.

**Impact:** Migration 011 adds `tags jsonb DEFAULT '[]'` to engagements. Classifier merges new tags (deduplicated) on each classification. Tag pills on engagement cards and detail page.

## 2026-02-14: Program Lifecycle Model

**Decision:** Replace `renewal_cycle` with `lifecycle_type` (indefinite/recurring/expiring) + `lifecycle_duration` (human-readable string, nullable).

**Context:** AWS programs have three distinct patterns: Security Competency is recurring (annual revalidation), ISV Accelerate is indefinite (no expiry), a specific funding program might be expiring. A single text field couldn't express this.

**Rationale:** `lifecycle_type` captures the core distinction (does this end?), while `lifecycle_duration` captures the timeframe when relevant. Indefinite programs have null duration.

**Impact:** Migration 012 adds both columns with CHECK constraint, drops renewal_cycle. Updated Program type and seed data format.

## 2026-02-14: Events — Host Added, date_precision Removed

**Decision:** Added `host` text column (who runs the event). Removed `date_precision` enum (exact/week/month/quarter).

**Context:** `date_precision` was overthinking it — in practice, events either have confirmed dates or they don't, `null` suffices. `host` matters for distinguishing AWS events from partner events from industry events.

**Rationale:** Simpler schema, more useful data. The date formatting code that handled quarter/month/week display was removed in favor of straightforward date rendering.

**Impact:** Migration 012 adds host, drops date_precision. Updated Event type, UI, and seed data format.

## 2026-02-14: current_state Evolves Not Overwrites

**Decision:** Prompt instructs Claude to read the existing `current_state` from context and evolve it — updating only material changes while preserving accumulated context. Routine follow-ups (scheduling, acknowledgments) return existing state with minimal changes.

**Context:** Every email was generating a fresh current_state, causing recency bias and losing accumulated context. A routine "sounds good!" reply would replace a detailed briefing about engagement scope.

**Rationale:** Like a Wikipedia article — update the section that changed, don't rewrite the whole thing. Engagement state should accumulate knowledge over time.

**Impact:** Updated SYSTEM_PROMPT with explicit current_state instructions for existing vs new engagements and style rules. No code changes — `buildUserMessage()` already sends existing current_state in context.

## 2026-02-14: open_items Strictly Limited

**Decision:** Prompt includes positive and negative examples for open_items. Assignee model supports: one person ("Steven"), multiple people ("Steven and CJ"), team/company ("Contrast Security team"), or null. Due dates only from explicit statements.

**Context:** Claude was extracting vague intentions ("let's circle back"), pleasantries ("looking forward to working together"), and status commentary ("great progress") as action items. Deadlines were fabricated from vague language like "soon."

**Rationale:** Noisy open_items erode trust. Users ignore the list when half the items are fabricated. Empty array is better than fabricated items.

**Impact:** Updated SYSTEM_PROMPT with detailed positive/negative examples, assignee rules, and due date rules. Cleaner open_items output.

## 2026-02-14: Forwarder as First-Class System Concept

**Decision:** `ForwarderContext { name, email }` passed explicitly to Claude via a dedicated "Forwarding Context" prompt section. Stored as `forwarder_email`/`forwarder_name` columns on messages table for batch recovery.

**Context:** Claude was guessing the forwarder from body text greetings ("Hi Steven") or From headers. The Mailgun envelope sender IS the forwarder — it was available all along but never parsed or passed through. Batch reclassification (`processUnclassifiedMessages`) had no way to recover the forwarder identity.

**Rationale:** System-level truth over AI inference. The forwarder is a known constant for each email — pass it explicitly rather than asking Claude to guess.

**Impact:** Migration 013 adds 4 columns to messages. Updated classifier, inbound route, test routes. Prompt rules 5 & 6 rewritten for explicit forwarder handling.

## 2026-02-14: To/CC Extracted from Inner Outlook Headers

**Decision:** Email parser now captures To (was being discarded from regex `match[3]`) and handles optional CC line between To and Subject. Stored as `to_header`/`cc_header` on ParsedMessage. Mailgun's outer envelope is fallback only.

**Context:** Mailgun's `To` field contains `relay@mg.roadrunner.dev` for forwarded emails — useless. The real recipients are in the Outlook-style headers embedded in the body text. Also fixed: emails with a CC line between To and Subject completely failed to parse as multi-message threads because the regex didn't allow for CC.

**Rationale:** Fix at the parser level where the data lives. The regex already captured To but `findHeaderBlocks()` threw it away. Making CC optional in the regex is a one-line fix that unblocks an entire class of emails.

**Impact:** Updated regex patterns (both Sent and Date variants), HeaderMatch interface, `findHeaderBlocks()`, `parseForwardedEmail()`. Inbound route prefers parser values over Mailgun envelope. 6 new parser tests (49 total).

## 2026-02-14: Reusable Seed Data Loader

**Decision:** `scripts/seed-data.ts` reads JSON files with `{ events: [...], programs: [...] }` format. Idempotent — checks by name before insert, logs every action. Usage: `npm run seed -- data/file.json`.

**Context:** Needed a repeatable way to load reference data without SQL migrations. Events and programs are content, not schema — they change with the calendar year and program portfolio.

**Rationale:** A script is rerunnable, version-controllable, and doesn't pollute the migration chain. JSON files can be committed to `data/` or passed ad-hoc.

**Impact:** 42 events seeded (re:Invent, re:Inforce, summits, deadlines, review cycles). Programs pending seed.

## 2026-02-14: Browser-Based Classification Test Page

**Decision:** `/test` page with separate "PDM / Forwarder" section and "Original Email" section (From, To, CC, Subject, Date, Body). Two modes: "Classify Only" (dry run, no side effects) and "Classify & Save" (full pipeline with DB writes).

**Context:** Testing classification quality required curl commands with long JSON payloads that didn't mirror real email structure. No way to quickly iterate on prompt changes.

**Rationale:** Fast iteration on prompt quality requires fast testing. The test page mirrors the exact data flow of the production pipeline — forwarder context, email headers, body — with visual results.

**Impact:** New pages: `/test`, `/api/classify/test` (dry run), `/api/classify/live-test` (full pipeline). Added to sidebar. Replaces curl-based testing entirely.

## 2026-02-14: Two-Tier Catalog/Enrollment Pattern

**Decision:** Programs catalog (Tier 1) contains 33 canonical program records. Partner Programs (Tier 2) contains 70 per-partner enrollment records linked to the catalog via "Program" field. Catalog is the single source that seeds Roadrunner.

**Context:** Needed a way for Roadrunner to match against canonical program names while Airtable tracks per-partner enrollment status.

**Rationale:** Separating "what exists" from "who's enrolled in what" prevents Claude from needing to understand the full portfolio structure. It just matches against the vocabulary.

**Impact:** All entity types should follow this pattern (Events catalog already exists, Partner Event Status is Tier 2).

## 2026-02-14: Partner Engagements Replaces Partner Initiatives

**Decision:** New Partner Engagements table with fields: Pillar (Co-Sell/Co-Market/Co-Build), Priority (Mandated/High/Normal/Opportunistic), Status (Planned/Active/Blocked/Completed/Archived), Related Program link, Roadrunner ID, plus all original fields. 37 records migrated from Partner Initiatives which is now archived.

**Context:** Partner Initiatives had a flat schema that didn't capture strategic context or link to programs/Roadrunner.

**Rationale:** Richer schema enables triage of Roadrunner suggestions (Priority), connects work to credentials (Related Program), and establishes sync key (Roadrunner ID).

**Impact:** Roadrunner engagements table should eventually mirror these fields. Classification output already returns pillar-compatible data.

## 2026-02-14: Program Type Taxonomy

**Decision:** Five program types — Competency, Service Ready, SCA, Program, Credit Program — stored in both Airtable (single select on Programs catalog) and Roadrunner (text column with CHECK constraint on programs table).

**Context:** Claude needs to distinguish program categories during email classification. An email about a competency pursuit looks different from MPOPP enrollment.

**Rationale:** Type is a fundamental classification axis. Having it in both systems means Claude sees it in the prompt context and the UI can group/filter by it.

**Impact:** Classification prompt now includes type. Tracks UI groups by type. Seed files include type field.

## 2026-02-14: MPOPP Split — Activate vs Grow as Separate Catalog Entries

**Decision:** MPOPP Activate and MPOPP Grow are two separate records in Programs catalog, not one record with a track sub-field.

**Context:** Debated whether MPOPP is one program with tracks or two distinct programs.

**Rationale:** They have different eligibility requirements, different purposes (new-to-marketplace vs scaling), and Claude needs distinct matching targets. Wallet/funding tracking stays in MPOPP Funding table.

**Impact:** Partner Programs enrollment records link to the specific track. 11 partners on Grow, 1 on Activate.

## 2026-02-14: Lifecycle Vocabulary — Roadrunner Terms as Standard

**Decision:** Use indefinite/recurring/expiring everywhere (both Airtable and Roadrunner) instead of Ongoing/One-Time/Periodic from the original architecture plan.

**Context:** Architecture plan and Roadrunner DB had different lifecycle vocabularies that mapped conceptually but used different words.

**Rationale:** Roadrunner already had these in a CHECK constraint. Using the same terms eliminates translation during seeding.

**Impact:** Airtable Programs catalog single select uses indefinite/recurring/expiring. Seed files pass through directly.

## 2026-02-14: Engagement Status — Intentionally Different Between Systems

**Decision:** Roadrunner uses active/paused/closed. Airtable uses Planned/Active/Blocked/Completed/Archived. These are not aligned and that's intentional.

**Context:** Considered aligning status vocabularies between systems.

**Rationale:** They serve different purposes. Roadrunner status reflects email activity flow (observable from emails). Airtable status reflects strategic assessment (human judgment). Mapping happens at sync time: Roadrunner active → Airtable Active, Roadrunner closed → Airtable Completed or Archived (human decides).

**Impact:** Future sync logic needs a status mapping layer, not vocabulary unification.

## 2026-02-14: Seed Flow — Airtable → JSON → Roadrunner

**Decision:** Airtable Programs catalog is the authoritative source. Seed files are generated from it in the documented JSON schema, then loaded via npm run seed. Seed loader updated to accept type and eligibility fields.

**Context:** Needed to establish which system is authoritative and how data flows between them.

**Rationale:** Airtable is where human curation happens (visual, easy to edit). Roadrunner is where classification happens. Seeds flow from curation layer to execution layer.

**Impact:** Any program changes start in Airtable, get exported to seed JSON, then loaded. Same pattern should apply to events.

## 2026-02-14: Partner Initiatives Archived

**Decision:** Partner Initiatives table archived (renamed with prefix, hidden from tab bar). Zero dependencies confirmed — no Partner Plans or AWS Relationships records linked to it.

**Context:** All 37 records migrated to Partner Engagements with richer schema.

**Rationale:** Dead table with no links. Keeping it visible would cause confusion about which table is active.

**Impact:** Partner Engagements is now the sole active work-tracking table.

## 2026-02-14: AWS Relationships as Synced Catalog

**Decision:** AWS Relationships syncs Airtable → Roadrunner like Programs and Events. Claude receives relationship data in context and matches @amazon.com addresses in email threads to internal AWS teams.

**Context:** Claude needs to link engagements to relevant AWS teams (Product Team, GTM contact, exec sponsor). Without structured relationship data, it has no way to know who "jsmith@amazon.com" is or which team they represent.

**Rationale:** Same "constrained intelligence" pattern — Claude picks from a closed list of relationships, never fabricates. Enables automatic linking of engagements to relevant AWS teams based on email participants.

**Impact:** New aws_relationships table in Roadrunner (migration 017). Requires email fields populated in Airtable. Claude classifier prompt needs update to include relationships context (future phase).

## 2026-02-14: Contact Emails Stored Inline

**Decision:** Store Primary Contact Email and AWS Contact Emails directly in the aws_relationships table, not in a separate AWS Contacts table.

**Context:** Need email addresses for Claude to match participants in email threads to known AWS relationships. Debated (A) inline on relationships vs (B) separate contacts table with junction.

**Rationale:** Simpler architecture, no junction table overhead. The relationship is the unit of work — knowing "the Security SA team contact is jsmith@amazon.com" is sufficient. Can split into separate Contacts table later if relationship-to-contact mapping gets complex.

**Impact:** Airtable AWS Relationships has 2 email fields (Primary Contact Email, AWS Contact Emails). Roadrunner has primary_contact_email (text) and aws_contact_emails (text[]) columns.

## 2026-02-14: Meetings Table Generalization

**Decision:** Single unified "Meetings" table handles all meeting types — event-related meetings, engagement calls, and standalone meetings. Renamed from "Event Meetings" to remove the event-only implication.

**Context:** Originally only tracked meetings associated with big events (re:Invent 1:1s, Summit follow-ups). Need to also track engagement-related calls parsed from ICS attachments and ad-hoc meetings.

**Rationale:** One table with a Source field (manual/ics_parsed) is cleaner than separate tables. Event link becomes optional via entity_links — meetings can exist without event context. engagement_id FK provides direct link to the engagement a meeting belongs to.

**Impact:** Airtable table renamed "Event Meetings" → "Meetings" with 8 new fields added. Roadrunner meetings table created (migration 018) with engagement FK, ICS UID for dedup, attendees as JSONB, and airtable_record_id for sync.

## 2026-02-14: Many-to-Many Junction Tables for AWS Relationships

**Decision:** Create engagement_aws_relationships and meeting_aws_relationships junction tables instead of using the polymorphic entity_links pattern.

**Context:** An engagement can involve multiple AWS teams (Product Team + GTM contact). A meeting can have multiple internal relationships present. Need to model this cleanly.

**Rationale:** Dedicated junction tables are simpler and more explicit than polymorphic entity_links for this relationship. They mirror Airtable's multipleRecordLinks field behavior with no artificial limits. CASCADE deletes keep them clean automatically.

**Impact:** Migrations 019 and 020 create junction tables with composite PKs. entity_links pattern NOT used for AWS relationships — that pattern stays for engagement↔event↔program links.

## 2026-02-14: Sync Direction Formalized

**Decision:** Airtable → Roadrunner for catalogs (Programs, Events, AWS Relationships). Roadrunner → Airtable for activity (Engagements, Meetings). Each entity type has ONE authoritative source.

**Context:** Both systems can technically edit any entity. Without a clear source of truth per entity type, edits conflict and data drifts.

**Rationale:** Airtable is the strategic hub where Steven manages portfolio, curates catalogs, and does strategic planning. Roadrunner is the action hub where Claude creates activity from emails. Sync pipelines must respect direction — never overwrite the authoritative source.

**Impact:** Edit Programs/Events/AWS Relationships in Airtable only. Engagements/Meetings created in Roadrunner, synced back to Airtable. Future sync pipelines enforce this with read-only queries on the non-authoritative side.

## 2026-02-14: Table Naming Alignment

**Decision:** Renamed Airtable tables: "Event Meetings" → "Meetings" and "Partner Event Status" → "Partner Events". Roadrunner table names follow: meetings, aws_relationships.

**Context:** Original names were too narrow. "Event Meetings" implied only event context. "Partner Event Status" didn't parallel "Partner Programs" naming convention.

**Rationale:** "Meetings" is general enough for all meeting types. "Partner Events" follows the Tier 2 enrollment naming convention (Partner Programs, Partner Events). Consistency reduces cognitive load.

**Impact:** Tables renamed in Airtable. Note: some link field labels in the Partners table may still show old names (cosmetic only, links work correctly).

---

## 2026-02-16: Bidirectional Sync Architecture — Catalog Pull + Activity Push

**Decision:** Airtable → Roadrunner for Tier 1 catalogs (Programs, Events, AWS Relationships) via button-triggered pull. Roadrunner → Airtable for Tier 3 activity (Engagements, and soon Meetings) via auto-push on create/update.

**Context:** Two systems need to stay in sync — Airtable as strategic portfolio hub, Roadrunner as real-time email activity layer.

**Rationale:** Each system is authoritative for its domain. Pull for catalogs gives user control over when reference data refreshes. Auto-push for activity ensures Airtable always reflects the latest email-driven work without manual steps.

**Impact:** Defines permanent data flow contract. Catalog sync via POST /api/sync (button-triggered). Activity sync via fire-and-forget after classification and manual edits.

---

## 2026-02-16: Name-Based Initial Match → ID-Based Ongoing Match

**Decision:** First sync matches records by name (programs/events) or name + partner_name combo (engagements). After matching, both sides store each other's record IDs (airtable_record_id in Supabase, Roadrunner ID field in Airtable). All subsequent syncs match by ID first.

**Context:** Initial state had 33 programs, 32 events, and 37 engagements in Airtable with no Roadrunner IDs, and Roadrunner records with no Airtable IDs.

**Rationale:** Name matching bootstraps the relationship. ID matching makes it permanent and rename-safe. If someone renames "Security Competency" to "AWS Security Competency" in Airtable, the sync finds it by ID and updates the name — no duplicate created.

**Impact:** airtable_record_id columns on programs, events, engagements, aws_relationships tables. Roadrunner ID field on Airtable Partner Engagements. Reconciliation is automatic on first sync.

---

## 2026-02-16: Fire-and-Forget Auto-Push Pattern

**Decision:** Engagement pushes to Airtable use non-blocking Promise.catch(err => console.error()) pattern. Never awaited in the critical path of email classification or API responses.

**Context:** Airtable API could be slow or down. Email classification must never fail because Airtable is unavailable.

**Rationale:** Roadrunner must function independently. Airtable sync is a nice-to-have enrichment, not a hard dependency. Errors are logged but don't propagate.

**Impact:** classifier.ts and PUT /api/engagements/[id] both call pushEngagementToAirtable() without await. Same pattern will apply to meetings sync.

---

## 2026-02-16: Notes Field Merge Strategy with Marker Sections

**Decision:** Roadrunner writes activity summaries to Airtable Notes field using === Roadrunner Activity Summary === markers. Manual content above the marker is preserved. Future syncs replace only the marker section. If no marker exists and Notes has content, Roadrunner appends below.

**Context:** Both systems write to Notes — Steven manually in Airtable, Roadrunner automatically from current_state and open_items.

**Rationale:** Prevents data loss. Clear visual separation. The marker pattern is a well-established convention for multi-source content in a shared field.

**Impact:** Notes field in Airtable Partner Engagements safely contains both manual strategic notes and auto-synced activity summaries.

---

## 2026-02-16: Meetings Don't Link Directly to Programs

**Decision:** No program_id or program link on meetings table. Program context is always inherited via Meeting → Engagement → Program (through entity_links).

**Context:** Question raised about whether meetings should link to programs like engagements do.

**Rationale:** A meeting is a moment in time within an engagement's lifecycle. The engagement carries the program context. Adding a direct program link would create redundancy and risk inconsistency. Events ARE directly linked because meetings physically occur at events — that's a property of the meeting itself, not inherited.

**Impact:** Keeps data model clean. Airtable Meetings table also has no Programs link — both systems are consistent.

---

## 2026-02-16: Meetings Schema Completeness — event_id, status, partner_name

**Decision:** Added event_id FK (to events), status TEXT with CHECK constraint (Scheduling/Invites Sent/Confirmed/Completed/Did Not Occur), and partner_name TEXT to the meetings table via migration 022.

**Context:** Gap analysis between Supabase meetings table and Airtable Meetings table revealed three missing fields that would block clean sync.

**Rationale:** Closing gaps before building sync ensures 1:1 field mapping with zero translation issues. Status values match Airtable exactly. event_id enables "this meeting happens at this event" linking. partner_name handles standalone meetings without engagements.

**Impact:** Migration 022. Updated types, API routes, list/detail pages, create/edit forms. Meeting status badges in UI.

---

## 2026-02-16: Events Consolidated to 32 (2026 Only)

**Decision:** Removed 6 legacy 2025 events from Airtable (deprecated Event Type field, missing new schema fields). Added 4 AWS PartnerEquip training events. Final count: 32 events in both systems.

**Context:** Event count discrepancy between systems — needed to reconcile before building sync.

**Rationale:** Clean baseline is essential. Legacy events with old schemas would cause sync mapping issues. PartnerEquip events were in Supabase but missing from Airtable.

**Impact:** Both systems at 32 events. All counts verified: 33 programs, 32 events, 7 AWS relationships.

---

## 2026-02-16: Catalog Sync is Idempotent with Change Detection

**Decision:** Sync compares all mapped fields before writing. Only changed records trigger updates. Unchanged records are skipped. Results report inserted/updated/unchanged/errors counts with duration.

**Context:** Sync button can be pressed repeatedly. Need to avoid unnecessary writes and provide clear feedback.

**Rationale:** Idempotency is a fundamental property of reliable sync. Change detection reduces API calls and database writes. Clear reporting helps diagnose issues.

**Impact:** First sync: ~12s (65 updates to add airtable_record_ids). Subsequent syncs: ~0.5s (all unchanged). Safe to run anytime.

---

## 2026-02-16: Airtable-Only Fields Never Overwritten by Sync

**Decision:** Strategic fields on Airtable Partner Engagements (Start Date, Target Completion, AWS Stakeholders, Partner Stakeholders, Third Parties, Related Program, AWS Relationships, 2026 Partner Plans, Event Meetings) are never touched by Roadrunner → Airtable push.

**Context:** Airtable is the strategic layer. Steven manually manages dates, stakeholders, program links, and plan associations there. Roadrunner only pushes activity data.

**Rationale:** Clear ownership boundaries. Automated sync should enrich, not overwrite. Each system owns specific fields.

**Impact:** pushEngagementToAirtable() only sends: name, pillar, priority, status, tags, partner link, notes, and Roadrunner ID. All other fields are untouched.

---

## 2026-02-16: approval_queue Schema Cleanup

**Decision:** Added CHECK constraint on approval_queue.type limiting to 'engagement_assignment'. Dropped dead entity_data JSONB column (from removed event_creation flow). Migration 021.

**Context:** Diagnostic revealed no CHECK constraint (any string accepted) and a dead column always containing null.

**Rationale:** Schema hygiene. The event_creation approval type was fully removed in a prior session. The column and loose type constraint were remnants.

**Impact:** Tighter schema validation. No functional change (all code already used correct values).

---

## 2026-02-16: Manual Engagement Creation via UI

**Decision:** Added a "New Engagement" form to the Roadrunner dashboard. Engagements can now be created manually without requiring a forwarded email. The form mirrors the existing edit form (name, partner, status, pillar, priority, current state) and feeds into the same createEngagement() → auto-push pipeline as classifier-created engagements.

**Context:** Engagements previously could only originate from two paths: classifier auto-create (≥0.85 confidence) or approval queue resolution. There was no way to track work that originated from Slack, verbal conversations, or proactive planning without forwarding a dummy email.

**Rationale:** Reuses existing infrastructure — createEngagement() in supabase.ts and pushEngagementToAirtable() in sync.ts were unchanged. The POST /api/engagements route follows the same validation and fire-and-forget push pattern as the PUT route. Default status is "active" since manual creates represent work the user is actively choosing to track.

**Impact:** Three creation paths now exist (classifier, approval resolution, manual form), all converging on the same persistence and sync pipeline. CreateEngagementForm.tsx is a self-contained client component. No changes to existing functions or patterns.

---

## 2026-02-16: Sync Delete Propagation

**Decision:** Catalog sync (AT→RR) now detects and hard-deletes orphaned Supabase records when the corresponding Airtable record no longer exists. Engagement delete in Roadrunner now fire-and-forgets a delete to Airtable. SyncResult interface includes a "deleted" counter displayed in the UI.

**Context:** Deleting an AWS Relationship in Airtable and running sync left the record orphaned in Supabase — visible in UI, present in database, and potentially sent to Claude as valid context. The sync only iterated Airtable records for insert/update but never checked for Supabase records missing from Airtable.

**Rationale:** Hard delete over soft delete because these are catalog records — if removed from the authoritative source (Airtable), they should not persist as ghost data. CASCADE foreign keys on junction tables (engagement_aws_relationships, meeting_aws_relationships, entity_links) automatically clean up references. Safety guard: only targets records with a non-null airtable_record_id, so any hypothetical Supabase-only records are never touched.

**Impact:** All three catalog sync functions (programs, events, relationships) now have orphan detection. deleteEngagement() in supabase.ts calls deleteEngagementFromAirtable() via fire-and-forget. New deleteRecord() utility in airtable.ts. SyncButton displays deleted count. Closes a gap where stale data could pollute classifier context.

---

## 2026-02-16: Smart Body Selection for Forwarded Emails

**Decision:** Replaced the naive `strippedText || bodyPlain` body selection with a `selectEmailBody()` function that detects forwarded email content and prefers `body-plain` when Mailgun's `stripped-text` has lost the forwarded thread.

**Context:** Mailgun's `stripped-text` removes "quoted" content — which includes forwarded email threads (the From:/Sent:/To:/Subject: header blocks the parser depends on). For a forwarding-centric app, stripped-text would consistently return only the forwarder's signature line (~30 chars), discarding the actual partner communication (~600-1300 chars).

**Rationale:** Two detection heuristics: (1) body-plain has Outlook forward markers (`From:` + `Sent:` on line starts) that stripped-text lost, or (2) body-plain is 3x+ longer than stripped-text. Falls back to stripped-text for direct (non-forwarded) emails where it's cleaner. Permanent `[BODY]` logging tracks which path is chosen.

**Impact:** Email parser now receives the full forwarded thread instead of just the forwarder's signature. No changes to the parser itself — the fix is upstream in the inbound route's body selection.

---

## 2026-02-16: body-calendar as Primary ICS Source

**Decision:** Added `body-calendar` Mailgun field as the primary ICS source, ahead of inline body-plain extraction and file attachments. Three-path priority: body-calendar → inline VCALENDAR in body-plain → File attachment from FormData.

**Context:** Production diagnostic logging revealed Mailgun sends calendar invites as a dedicated `body-calendar` string field (3775 chars of raw VCALENDAR content), not as File attachments in the FormData payload. The original implementation only checked for File attachments, which only works with multipart/form-data encoding — not URL-encoded fallback.

**Rationale:** body-calendar is the most reliable path because it's always a string field (works with both multipart and URL-encoded payloads). Inline body-plain is a fallback for edge cases where body-calendar isn't set. File attachment is last resort for actual .ics file attachments. All three paths feed into the same `parseICSContent()` function.

**Impact:** ICS meeting creation now works in production. `[ICS]` logging tracks which source path was used for each meeting. Non-blocking: ICS failures never prevent email processing.

---

## 2026-02-16: Eliminate Preface Messages from Email Parser

**Decision:** The email parser no longer creates standalone messages for text that appears before the first forwarded header block (the "preface"). Instead, meaningful preface text is attached to the first real message as `forwarder_note`. Signature-only prefaces are silently discarded.

**Context:** When Steven forwards an email, Outlook places his signature ("Steven Romero | Growth PDM") above the forwarded thread separator. The parser was treating this as a separate message, creating a noise record that wasted a Claude API call and diluted classification context. Every forwarded email produced an extra garbage message.

**Rationale:** The preface is forwarding metadata, not partner communication. Signature patterns (Name | Title, bare names, "Sent from..." lines, separator lines) are stripped. If the remaining text exceeds 20 characters, it's treated as a meaningful forwarder note (e.g., "Please review — high priority partner") and attached to the first real message via `forwarder_note`. Added `forwarder_note?: string | null` to the ParsedMessage type.

**Impact:** Forwarded emails now produce exactly the right number of messages (one per From:/Sent: header block). Test count increased from 67 to 73 with three new test suites covering signature-only, meaningful, and blank preface scenarios.

---

## 2026-02-16: message_id FK on Meetings Table

**Decision:** Added `message_id uuid REFERENCES messages(id) ON DELETE SET NULL` to the meetings table (migration 026) to track which inbound email contained the ICS attachment that created a meeting.

**Context:** Meetings created from ICS parsing had no link back to the source email. Without provenance tracking, there's no way to audit which email produced which meeting or to handle re-processing.

**Rationale:** Nullable FK because manually created meetings have no source message. ON DELETE SET NULL preserves the meeting record if the source message is deleted. Index added for efficient lookups. `createMeetingFromICS()` in supabase.ts accepts an optional `messageId` parameter.

**Impact:** Full audit trail from email → message → meeting. Meeting-to-engagement linking (Phase 2, via `linkMeetingToEngagement()`) can use the message's engagement_id to automatically associate meetings with the right engagement after classification.

---

## 2026-02-16: ICS Parser — Pure TypeScript, No Dependencies

**Decision:** Built the ICS (RFC 5545) parser as pure TypeScript with no npm dependencies. Handles line folding, UTC/TZID timestamps, ORGANIZER/ATTENDEE extraction, and text unescaping.

**Context:** Meeting invite processing requires parsing VCALENDAR/VEVENT content from email attachments or body fields. npm ICS libraries (node-ical, ical.js) are heavyweight and bring transitive dependencies.

**Rationale:** The parser only needs to handle a single VEVENT per calendar (meeting invites, not full calendar feeds). RFC 5545 line folding and property extraction are straightforward to implement. Defensive: returns null for any parse failure rather than throwing. Validation: requires UID, SUMMARY, and DTSTART — returns null if any are missing.

**Impact:** `parseICSContent()` in ics-parser.ts, `extractICSFromAttachments()` for FormData File scanning. Zero new dependencies. Used by inbound route for all three ICS extraction paths.

---

## 2026-02-16: Tracks → Programs Rename

**Decision:** Renamed the "Tracks" entity to "Programs" throughout the codebase — database tables, TypeScript types, API routes, UI components, sidebar navigation, and seed data.

**Context:** "Tracks" was the original internal name, but the entity represents AWS partner programs (ISV Accelerate, Security Competency, Marketplace Co-Sell, etc.). "Programs" is the term AWS uses externally and what partners recognize.

**Rationale:** Align terminology with the domain. Steven uses "programs" in conversation and emails. The Airtable schema already uses "Programs." Having a different internal name creates unnecessary cognitive overhead.

**Impact:** Breaking rename across ~15 files. Database migration renamed the table and updated all CHECK constraints, indexes, and foreign keys. No functional changes — pure terminology alignment.

---

## 2026-02-17: Partners as First-Class Entity

**Decision:** Added partners table to Supabase (migration 027) with catalog sync from Airtable, API routes, list + detail UI pages, and sidebar navigation. Partners are the 4th catalog pull entity.

**Context:** partner_name was a text string guessed by Claude during classification. No structured partner data existed in Roadrunner — engagements and meetings referenced partners by name only.

**Rationale:** Deterministic email-to-partner matching requires structured contact data (emails, names). A real partners table enables FK relationships, contact-based routing, and a partner hub view showing all activity for one partner. Follows the established catalog sync pattern (like programs, events, relationships).

**Impact:** 20 partners synced from Airtable. Partner list + detail pages in UI. Foundation for deterministic classifier matching once contact emails are populated. Partners sync first in catalog pull order since other entities reference them.

---

## 2026-02-17: partner_id FK with Dual-Column Transition Strategy

**Decision:** Added nullable partner_id FK on engagements and meetings (migration 027) alongside existing partner_name text columns. Migration 028 backfills partner_id by matching partner_name to partners.name. Runtime auto-resolves partner_id on create/update. Queries use FK first with text fallback.

**Context:** Removing partner_name immediately would break existing records and the classification pipeline (which outputs partner names, not IDs). Needed a non-breaking migration path.

**Rationale:** Dual-column approach allows gradual transition. partner_id is the real relationship for queries and joins. partner_name stays as denormalized display text and backward compatibility. Belt-and-suspenders queries (FK first, text fallback for unbackfilled rows) ensure zero data loss during transition.

**Impact:** All existing engagements/meetings backfilled where names match. All new records auto-resolve. Partner detail pages show linked activity via FK. Can eventually drop text fallback once all records have partner_id.

---

## 2026-02-17: Partner Contact Emails for Deterministic Matching

**Decision:** Created two new fields in Airtable Partners table: Alliance Lead Email (email type) and Partner Contact Emails (multiline text, semicolon-separated). Synced to Supabase as alliance_lead_email (text) and partner_contact_emails (text[]).

**Context:** The classifier currently guesses partner names from email content. With structured contact emails, it can match sender/recipient addresses to specific partners deterministically.

**Rationale:** Same pattern as AWS Contact Emails on the relationships table. Semicolon-separated text parsed to text[] array provides flexibility without requiring a separate contacts table. Alliance lead gets a dedicated email field since every partner has exactly one.

**Impact:** Once Steven populates these fields in Airtable and syncs, the classifier can match emails like jane@saltsecurity.com → Salt Security without AI guessing. Unblocks the next phase of classifier prompt refinement.

---

## 2026-02-17: Meetings Push to Airtable with Linked Record Resolution

**Decision:** Built complete meetings push following the engagement push pattern: single fire-and-forget (pushMeetingToAirtable) + bulk sync (syncMeetingsToAirtable) + delete propagation. Resolves 4 linked records (partner, event, engagement, AWS relationships). Splits attendees JSONB into AWS Contact(s) and Partner Contact(s) text fields, filtering relay and Salesforce addresses.

**Context:** Meetings existed in Roadrunner (from ICS parsing and manual creation) but didn't sync to Airtable. Engagements already had a working push pattern to replicate.

**Rationale:** Exact pattern replication — same 3-tier match strategy, same change detection, same rate limiting, same error handling. The only new complexity is more linked records (4 vs 1) and the attendees split transform.

**Impact:** Bidirectional sync now complete for all 6 entities. Meetings auto-push on create/ICS-parse/engagement-link/delete. Manual "Push to Airtable" button on meetings page for bulk reconciliation.

---

## 2026-02-17: Two-Tier Sync Model: Auto-Push + Manual Safety Net

**Decision:** Documented and standardized the sync architecture. Activity entities (engagements, meetings) use auto-push fire-and-forget hooks on create/update/delete, with manual bulk push buttons as reconciliation fallback. Catalog entities (partners, programs, events, relationships) use manual pull buttons only. Created docs/sync-architecture.md.

**Context:** The sync model had grown organically across sessions without a clear architectural document. Auto-push hooks existed for engagements but weren't explicitly documented as a pattern. Adding meetings push required deciding whether to replicate the same dual approach.

**Rationale:** Frequently-changing activity data (emails create engagements constantly) benefits from auto-push — users shouldn't need to manually sync after every classification. Rarely-changing catalog data (programs change quarterly) only needs manual pull. The manual button on activity entities serves as a safety net for edge cases where auto-push silently failed.

**Impact:** Clear mental model for sync behavior. Known gaps documented (4 code paths without auto-push hooks). Future entities follow the same pattern based on change frequency.

---

## 2026-02-17: Meeting Notes: Direct Overwrite (No Merge Pattern)

**Decision:** Meeting notes push to Airtable as plain text overwrite, unlike engagements which use a === Roadrunner Activity Summary === marker pattern to protect manually-written Airtable notes.

**Context:** Engagements needed merge logic because users actively write strategic notes in Airtable that shouldn't be overwritten by Roadrunner sync. Meetings are less likely to have manually-written Airtable notes.

**Rationale:** Simpler implementation, lower risk of data loss for meetings. Notes merge is a post-MVP refinement if meeting notes in Airtable become a real workflow.

**Impact:** Simpler meeting sync code. If users start manually annotating meetings in Airtable, will need to add merge logic later.

---

## 2025-02-17: Modular Prompt-Builder Architecture

**Decision:** Context sections for the Claude classifier prompt are built by independent functions in `src/lib/prompt-builder.ts`. Seven builder functions: `buildForwarderSection`, `buildEngagementsSection`, `buildPartnerCatalog`, `buildRelationshipCatalog`, `buildProgramCatalog`, `buildEventCatalog`, `buildEmailContent`. Each returns a markdown section string that is composed into the final user message.

**Context:** Previous prompt construction was monolithic in `claude.ts` — the `buildUserMessage()` function inlined all context assembly. Not reusable, hard to test, couldn't be composed for different consumers.

**Rationale:** Each function is independently importable and testable. Future agents or different prompts (batch re-classification, summary generation, agent workflows) can reuse the same context builders without duplicating logic.

**Impact:** Any new AI consumer calls the same builders. Classification prompt is one consumer, not the owner. `claude.ts` now delegates context assembly to prompt-builder functions.

---

## 2025-02-17: Canonical User Identity via USER_CONFIG

**Decision:** User profile defined in `src/lib/user-config.ts` as a constant (`USER_CONFIG` with name, email, aliases, role, segment). Replaces per-email Mailgun sender inference for forwarder identity. Includes `stripPRVS()` for Proofpoint-wrapped emails, `isCorpmailAddress()` for Amazon SES tracking IDs, and `isUserEmail()` master check combining all variants.

**Context:** Forwarder identity was inferred from Mailgun envelope sender, producing "Steven Terme" (from sterme alias). Amazon SES rewrites From: headers with per-message corpmail tracking IDs (e.g., `{message-id}@corpmail.amazon.com`). Proofpoint wraps addresses in PRVS format (e.g., `prvs=XXXXXX=sterme@amazon.com`).

**Rationale:** Canonical identity eliminates all three failure modes. Single source of truth rather than per-email guessing. `isUserEmail()` centralizes detection for all code paths.

**Impact:** One participant record for the user regardless of email variant. Prevents phantom participants. Future: can move to env vars or settings table.

---

## 2025-02-17: Email-Domain Matching for Partners

**Decision:** Partners matched primarily by sender/recipient email domain (e.g., `@cloudaware.com` → Cloudaware). Contact emails enable specific-person matching. Partner name inference from email content as fallback. Engagement context as final fallback.

**Context:** Claude was guessing partner names from email content with no reference data. 20 structured partner records existed but weren't sent to the classifier.

**Rationale:** Domain matching is deterministic — no LLM inference needed. Contact emails handle edge cases (personal email, consultant). Name inference as fallback when no email matches.

**Impact:** Partner resolution accuracy dramatically improved. As contact emails are populated in Airtable, matching gets progressively more precise.

---

## 2025-02-17: Two-Tier Entity Matching Pattern

**Decision:** Email-matchable entities (Partners, AWS Relationships) use email-first deterministic matching with LLM fallback. Context-matchable entities (Programs, Events) use pure content matching. Different data sent for each: partners get domains + contact emails, relationships get contact emails + org/service, programs get name + type only, events get name + dates + host only.

**Context:** All entities were being sent with full descriptions, wasting tokens on data that doesn't help matching.

**Rationale:** Match the data format to the matching mechanism. Email entities need emails. Content entities need names and types. Descriptions don't help either category match better.

**Impact:** Token budget stays sustainable (~4,200 at current scale, ~6,800 at 3x). Each entity type gets exactly the data Claude needs for matching, nothing more.

---

## 2025-02-17: Token Optimization via Compact Reference Catalogs

**Decision:** Program descriptions and event descriptions/locations dropped from classifier prompt. Programs sent as `ID|Name|Type`. Events sent as `ID|Name|Dates|Host`.

**Context:** Full descriptions added ~2,000 tokens at current scale (34 programs, 32 events) without improving match accuracy.

**Rationale:** Claude can match "Security Competency" and "RSA Conference 2026" by name alone. Descriptions are for human comprehension, not entity matching.

**Impact:** ~2,000 tokens saved at current scale. At 3x portfolio growth, still well within context window. Can re-add descriptions selectively if matching accuracy suffers.

---

## 2025-02-17: Active/Planned Engagement Filtering for Classifier Context

**Decision:** Only engagements with status `active` or `planned` sent to Claude. Completed and archived engagements excluded from classification context.

**Context:** Every engagement in the database was being sent to Claude, regardless of status. As portfolio grows, this would blow out the token budget.

**Rationale:** Completed engagements shouldn't receive new emails. If an old thread resurfaces, Claude creates a new engagement rather than appending to a closed one — which is the correct behavior.

**Impact:** Primary scaling lever for the classifier. 50 active engagements ≈ 2,000 tokens. 200 total engagements with 50 active = same 2,000 tokens.

---

## 2025-02-17: forwarder_note Pipeline Completion

**Decision:** Forwarder's added text (parsed from email body, >20 chars after stripping signatures) is now stored in `messages.forwarder_note` column and included in Claude's prompt as a labeled section before the email chain. Migration 029 adds the column.

**Context:** Email parser correctly extracted forwarder notes but the data was never stored in Supabase and never sent to Claude — a dead-end pipeline.

**Rationale:** Forwarder notes contain intent signals ("FYI — urgent partner request") that Claude needs for accurate classification and priority inference.

**Impact:** Forwarder context reaches Claude for the first time. Enables future features like automatic priority escalation based on forwarder notes.

---

## 2025-02-17: matched_relationships in Classification Output

**Decision:** Claude's JSON response includes `matched_relationships` array with `{ id, name, relationship_type }` (involved_in, consulted, introduced, escalated_to). Persisted via `engagement_aws_relationships` junction table. Progressive linking: relationships added to Airtable and synced down are automatically linked when future emails match.

**Context:** AWS relationships existed in the database but Claude couldn't link emails to them. No mechanism to associate engagements with AWS team relationships.

**Rationale:** Organic, additive linking — the system gets smarter as you add data. No manual linking required. Junction table supports many-to-many (engagement ↔ relationship).

**Impact:** AWS team involvement tracked automatically. Enables future reporting on which AWS teams are most active across partner engagements.

---

## 2025-02-17: Participant Identity Canonicalization

**Decision:** `upsertParticipants` uses `isUserEmail()` to detect all user email variants (exact match, aliases, PRVS-wrapped, SES corpmail). When matched, always normalizes to `USER_CONFIG.email` and `USER_CONFIG.name`. Non-user participants retain fill-only behavior (don't overwrite existing names). Migration 030 consolidated 9 stale Steven records into 1 canonical record.

**Context:** 9 duplicate participant records for Steven existed — "Steven Terme", "PDM Forwarder", PRVS addresses, SES corpmail IDs. The upsert only filled empty names, never corrected wrong ones.

**Rationale:** User email appears in many forms due to Amazon infrastructure. Centralizing detection in `isUserEmail()` handles all variants. Non-user participants keep conservative fill-only to avoid overwriting correct names with typos.

**Impact:** One canonical participant record per user. Prevents future fragmentation. Pattern extensible to multi-user support later.

---

## 2025-02-17: AWS Relationship Architecture Needs Partner Decoupling (PLANNED)

**Decision:** Current Airtable schema ties AWS Relationships to a single partner. This should change — relationships should be partner-agnostic at the catalog level, with the per-partner connection happening through engagement linking (junction table).

**Context:** The Multicloud Team works with multiple partners, not just Cloudaware. Tying the relationship to one partner limits scale and accuracy.

**Rationale:** The `engagement_aws_relationships` junction table already supports many-to-many. The catalog record shouldn't constrain what the junction table enables.

**Impact:** Deferred to next session. Requires Airtable schema discussion and migration planning. No code change yet.

---

## 2026-02-17: AWS Relationships Partner Decoupling

**Decision:** Removed `partner_name` column from `aws_relationships`. Relationships are partner-agnostic catalog records. Partner context flows through `engagement_aws_relationships` and `meeting_aws_relationships` junction tables per-activity.

**Context:** AWS Relationships had a Partners linked-record field in Airtable creating false 1:1 ownership. "Multicloud Team" linked to Cloudaware but could be relevant to any partner.

**Rationale:** Relationships describe AWS team structures, not partner ownership. The real partner↔relationship connection is per-engagement via junction tables, not a static property of the relationship itself.

**Impact:** Migration 031 drops column + index. Removed from types.ts, sync.ts (no longer resolves Partners link), UI list/detail pages. Airtable Partners field manually deleted. 9 files changed.

---

## 2026-02-17: Open Items Prompt Visibility + Auto-Resolution

**Decision:** Claude now sees existing `open_items` (resolved + unresolved) in the engagement context. New `resolved_open_items` output field enables auto-completion. Matching uses bidirectional >50% keyword overlap.

**Context:** Claude previously had no visibility into existing open items, causing semantic duplicates ("send the doc" vs "deliver the document") and inability to auto-resolve completed tasks.

**Rationale:** Showing Claude existing items prevents duplicates at the source. Auto-resolution via keyword matching is conservative (fails open) with manual checkboxes as fallback.

**Impact:** prompt-builder.ts shows open items per engagement. claude.ts system prompt updated with visibility + resolution instructions. types.ts adds `resolved_open_items`. classifier.ts calls `resolveOpenItems()`. supabase.ts adds `matchResolvedItems()` with keyword extraction. 20 new tests.

---

## 2026-02-17: No previous_current_state Safety Net

**Decision:** No backup column for `current_state` before overwrite. Recovery exists via `classification_result` JSONB on each message record.

**Context:** Considered adding `previous_current_state` to protect against Claude writing bad state that drops context.

**Rationale:** The correct approach is making classification reliable, not building safety nets for unreliable classification. Message-level `classification_result` JSONB provides implicit history.

**Impact:** Simpler schema. Focus shifts to prompt quality and testing.

---

## 2026-02-17: Two-Pass Recursive Email Parser

**Decision:** Parser runs Outlook header split (Pass 1), then recursively splits Gmail/generic quotes within each extracted message (Pass 2). New `splitQuotedReplies()` function handles recursion with depth limit of 5. Messages sorted chronologically after splitting.

**Context:** Real-world emails mix formats — Outlook wraps the forward, Gmail "On... wrote:" quotes exist within message bodies. Original parser treated these as mutually exclusive paths.

**Rationale:** Every message body is potentially a container for more quoted messages regardless of outer format. Recursive splitting naturally handles threads-within-threads. Chronological sorting makes timeline display straightforward.

**Impact:** Handles Outlook, Gmail, Apple Mail, generic separators (`---- Original Message ----`), and mixed-format threads. 72 email-parser tests (up from 26). Foundation for clean UI timeline display.

---

## 2026-02-17: CRLF Normalization at Parser Entry

**Decision:** Normalize `\r\n` → `\n` and bare `\r` → `\n` at the very top of `parseForwardedEmail()` before any regex matching.

**Context:** Mailgun delivers body-plain with `\r\n` (CRLF) line endings. Node.js `.` does not match `\r`, causing ALL Outlook header regexes to fail silently. Every real email was falling through to single-message fallback.

**Rationale:** Normalizing input is simpler and more robust than modifying every regex pattern. Single line fix catches all edge cases including mixed and bare CR line endings.

**Impact:** Fixed the root cause preventing all real email thread splitting in production. 8 new CRLF-specific tests.

---

## 2026-02-17: Per-Message Dedup via Fingerprinting

**Decision:** Messages deduplicated by fingerprint (`lowercase(sender_email) + "|" + body_text.trim().slice(0,100)`) before insertion. Checks against last 30 days of messages.

**Context:** Re-forwarding a thread with one new reply would create duplicate records for all old messages in the thread.

**Rationale:** Fingerprinting is fast (single query), deterministic, and handles the common case of thread re-forwarding. 30-day window prevents unbounded lookups while covering all realistic re-forward scenarios.

**Impact:** `storeMessages()` filters duplicates before insert. Logs `[DEDUP]` when skipping. 6 new dedup tests.

---

## 2026-02-17: Forwarder Identity from USER_CONFIG for Corpmail/PRVS

**Decision:** When Mailgun sender matches any known user email variant (corpmail, PRVS, aliases via `isUserEmail()`), `forwarder_name` and email fall back to `USER_CONFIG` canonical values.

**Context:** Amazon SES rewrites the From header to corpmail tracking IDs (`0101019c...@corpmail.amazon.com`). `parseSenderField()` couldn't extract a name from these.

**Rationale:** The PDM is always the forwarder in the current architecture. Canonical identity should be consistent regardless of email routing artifacts.

**Impact:** Forwarder always displays as "Steven Romero" / "sterme@amazon.com" in the UI.

---

## 2026-02-17: Direct-to-Relay Not MVP

**Decision:** Non-forwarded emails (partner sends directly to relay address) are not supported for MVP. All emails will be forwarded by the PDM.

**Context:** Direct emails would set the partner as the "forwarder" since Mailgun's sender field would be the partner contact, not the PDM.

**Rationale:** Supporting direct emails requires distinguishing "PDM forwarded this" from "someone emailed relay directly" — added complexity with no immediate use case.

**Impact:** Forwarder identity logic stays simple. Revisit if direct-to-relay becomes needed.

---

## 2026-02-17: Meetings from Text Stay Prose-Only

**Decision:** Meeting mentions in email text (no ICS attachment) stay in `current_state` narrative only. Only ICS attachments create structured meeting records.

**Context:** Emails often mention "let's meet Thursday at 2pm" without a calendar invite. Could extract lightweight meeting signals.

**Rationale:** Clean separation between structured calendar data (ICS) and conversational references. Parsing "let's meet" from email text is unreliable and creates low-confidence records.

**Impact:** Meetings table stays high-confidence (ICS-sourced only). Meeting mentions are captured in `current_state` prose.

---

## 2026-02-18: Partner Classification Taxonomy: Segment + Focus Area

**Decision:** Replace Category (Infrastructure/HBA/Industry Vert) and Sub-Category (freeform text) with Segment (singleSelect: Security, SecOps, DevOps, CloudOps, Observability, OT/IoT) and Focus Area (multipleSelects: 18 domain-specific options).

**Context:** The old taxonomy was stale — nearly every partner was "Infrastructure" which told you nothing. Sub-Category was freeform text with inconsistent concatenated paths like "Infrastructure - Security - Network Security."

**Rationale:** Two-field model separates "who buys this" (Segment = customer team) from "what they do" (Focus Area = specific niche). Segment is stable and grows slowly. Focus Area is granular and extensible. Multiple select on Focus Area allows partners like Cloudaware to span Asset Management + Compliance.

**Impact:** sync.ts field mappings updated (PTRF.segment, PTRF.focusArea), partner detail page shows Segment badge + Focus Area chips in header, sidebar shows contact fields only. Partners list page filters by Segment. Prompt builder sends Segment/Focus Area context to Claude. All 20 partners backfilled.

---

## 2026-02-18: AWS Context Fields Synced to Roadrunner

**Decision:** Sync AWS Stickiness (text) and Key AWS Services (multipleSelects) from Airtable to Roadrunner. Display as a separate "AWS Context" sidebar section on partner detail pages.

**Context:** These fields existed in Airtable but were never pulled into Roadrunner. AWS Stickiness is a narrative about customer AWS adoption likelihood. Key AWS Services lists which AWS services the partner integrates with.

**Rationale:** Both fields are valuable for understanding partner-AWS fit at a glance. Displaying them separately from contact info creates a clean "who are they" vs "how do they relate to AWS" grouping.

**Impact:** Two new DB columns (aws_stickiness text, key_aws_services text[]), new PTRF sync constants, partner detail page has new AWS Context section. Migration 033.

---

## 2026-02-18: Component Directory Organization

**Decision:** Reorganize src/components/ from 25 flat files into 5 subdirectories: actions/ (5), engagement/ (4), inbox/ (4), layout/ (4), shared/ (8).

**Context:** Flat directory was navigable but didn't communicate component purpose. As the component count grows, grouping by function prevents the "wall of files" problem.

**Rationale:** Groups map to functional areas: actions/ = entity CRUD buttons, engagement/ = engagement-specific cards, inbox/ = review queue UI, layout/ = app structure, shared/ = reusable primitives. No barrel exports — direct imports are more explicit.

**Impact:** 18 files updated with new import paths. Pattern established for future component additions.

---

## 2026-02-18: Twilio/SMS Removal

**Decision:** Remove all Twilio/SMS integration. Approval queue notifications happen exclusively via the Inbox web UI.

**Context:** SMS was a convenience layer — when classifier confidence was below 0.85, it would text the user. The Inbox UI already handles review, making SMS redundant.

**Rationale:** Removes a third-party dependency (31 npm packages), simplifies the classifier (no SMS branching), eliminates 4 env vars. The Inbox UI is a better review experience than SMS anyway — you can see context, modify classifications, batch resolve.

**Impact:** 4 files deleted, 6 files modified, twilio package removed. Classifier creates approval_queue items but no longer sends SMS. 176 tests (down from 185 — 9 SMS tests removed). Legacy sms_sent/options_sent DB columns remain as nullable.

---

## 2026-02-18: Documentation Restructure: Purpose-Driven Docs

**Decision:** Replace 4 outdated docs (master-spec, goal-state, sync-architecture, field-mapping-guide) with 6 purpose-driven docs: PROJECT.md, ARCHITECTURE.md, DATA-MODEL.md, CLASSIFICATION.md, DEVELOPMENT.md, FIELD-MAPPING.md.

**Context:** Existing docs described what was planned, not what was built. master-spec had 70+ references to "initiatives" (now engagements) and 30+ Twilio references. No single doc could orient a fresh Claude Code session.

**Rationale:** Each doc answers one question: "what is this?" (PROJECT), "how is it built?" (ARCHITECTURE), "what data exists?" (DATA-MODEL), "how does the AI work?" (CLASSIFICATION), "how do I work on it?" (DEVELOPMENT), "what are the field IDs?" (FIELD-MAPPING). Maps to the Sherpa diagnostic workflow — read the relevant doc before working.

**Impact:** README updated with documentation table. Best content from old docs preserved (principles, classification rules, events ARE/ARE NOT distinction, removal rationale). All docs reflect actual implemented state as of 2026-02-18.

---

## 2026-02-18: AWS Relationships Decoupled from Partner-Specific Data

**Decision:** Remove Strength, Partner Programs link, Partner Event Status link, and Last Touch from AWS Relationships table.

**Context:** Strength (Strong/Building/New/Deferred) was originally per-partner — "how strong is this relationship for Partner X." When relationships were decoupled from single-partner ownership (can link to multiple engagements across partners), per-partner strength became meaningless. Partner Programs and Partner Event Status links were Tier 2 enrollment data that doesn't belong on AWS team records. Last Touch is redundant with meeting dates.

**Rationale:** AWS Relationships should be pure team/person records. Their connection to partners flows through engagements and meetings, not through enrollment data. "Last touch" is derivable from the most recent linked meeting.

**Impact:** Migration 034 drops strength column. sync.ts, types.ts, prompt-builder, detail/list pages, action components all cleaned. 13 files modified, zero TypeScript errors.

---

## 2026-02-18: Dead API Route Cleanup Pattern

**Decision:** Delete /api/inbox/route.ts (unused GET list endpoint). Establish pattern: list pages use server components querying Supabase directly; API routes exist only for client-side mutations and external webhooks.

**Context:** The inbox page queries Supabase via server component, making the API GET route redundant. Same pattern exists for partners, programs, and relationships list pages.

**Rationale:** Server components are simpler and faster for reads — no API hop needed. API routes exist for: mutations (POST/PUT/DELETE from client components), webhooks (Mailgun, health check), and dev tools (classify/test).

**Impact:** 1 file deleted. Pattern documented for future reference. /api/inbox/count/route.ts preserved (used by Sidebar badge).

---

## 2026-02-18: Meetings Primary Field: Formula → Writable Text

**Decision:** Convert Meeting Name from a formula field to a writable singleLineText field. Roadrunner writes meeting.title directly.

**Context:** The formula field was fragile — it concatenated partner name + event name + date, breaking when any input was missing. Roadrunner generates better titles from classification context.

**Rationale:** Writable field gives Roadrunner full control over meeting display names. Backfilled all 14 existing records with clean, descriptive names (stripped leading dashes, added context in parentheses). Same field ID preserved — just type changed.

**Impact:** sync.ts writes meeting.title → Meeting Name. 3-tier match strategy uses title + date as fallback. All 14 records cleaned up.

---

## 2026-02-20: meetings.program_id — Decision Revised

**Decision:** Earlier decision "Meetings Don't Link Directly to Programs" was revised during implementation. Migration 032 added program_id FK to meetings, and Airtable Meetings table has a Program field (fldqhPAGvYppRZgCS). The link is valid — meetings like "KnowBe4 GTM Meeting (SMB Competency)" naturally reference a program.

**Context:** The original decision reflected an earlier design phase where meetings were conceptualized as purely engagement-scoped. In practice, meetings about program enrollment or compliance reviews have a direct program relationship that is a property of the meeting itself, not inherited from the engagement.

**Rationale:** The implementation is correct. Updating decisions.md to match reality rather than reverting the implementation to match an outdated decision.

**Impact:** No code changes. This entry corrects the decision log to reflect the implemented and correct behavior. meetings.program_id FK remains, Airtable sync writes program link.

---

## 2026-02-20: Legacy SMS Columns Dropped from approval_queue

**Decision:** Removed `options_sent`, `sms_sent`, `sms_sent_at` from the `approval_queue` table and all code references.

**Context:** These were remnants of the Twilio/SMS notification system removed in a prior session (Decision: "Twilio/SMS Removal", 2026-02-18). The columns were never written to after SMS removal. The `options_sent` field also powered a dead "select" action in the resolve route and rendered ghost buttons in ReviewCard — both paths unreachable since options_sent was never populated.

**Rationale:** Dead columns and dead code paths are maintenance traps. Removing them eliminates confusion about which resolve actions are actually supported (skip, new) vs. which are legacy (select).

**Impact:** Migration 036 drops 3 columns. Removed deprecated fields from ApprovalQueueItem type, dead "select" action handler from resolve route, ghost options rendering from ReviewCard. 5 files changed. No functional impact — purely schema and code hygiene.

---

## 2026-02-21: Sidebar Nav Reorder

**Decision:** Reorder sidebar navigation to follow workflow adjacency: Inbox → Engagements → Partners → Meetings → Events → Programs → Relationships.

**Context:** The previous order (Inbox, Engagements, Partners, Events, Relationships, Meetings, Programs) grouped entities alphabetically rather than by usage frequency. Meetings and Events are consulted together when scheduling; Programs and Relationships are reference data accessed less often.

**Rationale:** Workflow-adjacent grouping reduces scroll distance for the most common navigation sequences. Meetings moves up next to Partners (the entities most often cross-referenced), while reference-only views (Programs, Relationships) move to the bottom.

**Impact:** Sidebar.tsx navItems array reordered. No route or page changes.

---

## 2026-02-21: FilterBar v2 — Single-Select Behavior

**Decision:** Replace the current multi-select toggle-pill FilterBar with a single-select dropdown/chip pattern. Only one filter value active at a time per dimension.

**Context:** The existing FilterBar uses `Set<string>` to allow multiple simultaneous selections (e.g., "active" + "paused" statuses). In practice, users almost always filter to a single value. Multi-select adds visual clutter and interaction complexity with no demonstrated benefit for a single-user app.

**Rationale:** Single-select is simpler to implement, easier to read at a glance, and matches the actual usage pattern. The "All" state (no filter) remains the default.

**Impact:** FilterBar.tsx rewrite. All consumer pages (Engagements, Partners, Events, Programs, Meetings, Relationships) update their filter state from `Set<string>` to `string | null`. Net reduction in code complexity.

---

## 2026-02-21: Phase 2 Build Sequence

**Decision:** Phase 2 UI foundation components will be built in this order: (1) Sidebar reorder, (2) FilterBar v2, (3) CompactRow, (4) DetailHeader.

**Context:** Each component builds on the previous. Sidebar reorder is a trivial array change that validates the dev workflow. FilterBar v2 touches every list page but is self-contained. CompactRow standardizes list items across all entity pages. DetailHeader standardizes detail page headers.

**Rationale:** Ordering by dependency and blast radius — smallest change first, widest-reaching last. Each step is independently shippable and testable.

**Impact:** Defines the implementation sequence for the next 4 PRs.

---

## 2026-02-21: PostgREST Schema Cache — Restart Required

**Decision:** After running Supabase migrations that add new columns, the Supabase project must be restarted (Settings → General → Restart project) before PostgREST will accept writes to those columns.

**Context:** Migration 037 added `geo` to events and `what_they_do` to partners. The migration succeeded (columns exist in the database), but PostgREST continued to silently drop these fields on INSERT/UPDATE because its schema cache was stale. This produced no errors — upserts succeeded but the new columns stayed NULL.

**Rationale:** PostgREST caches the database schema at startup. New columns are invisible to the API until the cache refreshes. On Supabase free tier, there is no `NOTIFY pgrst` channel to trigger a live reload — a full project restart is the only reliable method.

**Impact:** Two-step deployment required for schema changes: (1) run migration + restart Supabase project, (2) deploy code to Vercel. Order matters — code deployed before restart will also silently drop the new fields.

---

## 2026-02-21: Canonical Event Count — 43

**Decision:** The canonical event count in the system is 43 (as of 2026-02-21), not 54 as previously referenced in some planning documents.

**Context:** During Airtable sync verification, the actual event count was confirmed as 43. The "54 events" figure appeared in early planning estimates before deduplication and data cleanup.

**Rationale:** Accurate counts prevent confusion when debugging sync issues or validating data integrity.

**Impact:** Reference data only. No code changes. Future sync validations should expect ~43 events (will grow as new events are added).

---

## 2026-02-21: Composition-Based Slot Architecture for UI Components

**Decision:** CompactRow (primary/badges/secondary/meta) and DetailHeader (title/badges/subtitle/fields/actions) replace all per-entity inline markup.

**Context:** Six list pages and six detail pages each had their own card/header markup with inconsistent padding, badge placement, and field layouts.

**Rationale:** Composition over inheritance. Components define visual slots, pages fill them. Avoids god-components with 30 props. React-idiomatic, easy to test, adding a new entity means writing one mapping function.

**Impact:** All list pages use CompactRow, all detail pages use DetailHeader. Changing row/header styling is now a single-file edit. Skill doc captures slot mappings per entity for future sessions.

---

## 2026-02-21: FilterBar Single-Select Pattern

**Decision:** One active filter at a time (string | null), click to select exclusively, click again to deselect back to All.

**Context:** Multi-select filters (Set<string>) caused confusion — users could combine filters and get empty results without understanding why.

**Rationale:** Chip/pill UI gives full landscape at a glance. One tap to filter, tap again to reset. Dropdown hides options behind click. Segmented control doesn't scale past 4 options.

**Impact:** All 5 FilterBar consumers converted. Second filter dimensions (like Events year) use separate chip rows, not modifications to FilterBar.

---

## 2026-02-21: Sidebar Navigation Priority Gradient

**Decision:** Nav order is Inbox → Engagements → Partners → Meetings → Events → Programs → Relationships.

**Context:** Previous order didn't reflect usage patterns. Relationships were 5th despite being a reference catalog.

**Rationale:** Priority gradient: action items → active work → portfolio → time-bound → reference catalogs. Meetings moved up (time-sensitive), Events/Programs/Relationships moved down (reference).

**Impact:** New nav items should be inserted based on this principle.

---

## 2026-02-21: Detail Belongs on Detail Pages

**Decision:** List rows show entity identity + one key context line only. Eligibility (programs), contact info (relationships), description (events) dropped from list rows.

**Context:** List rows were trying to show too much, reducing scan density and duplicating information that has full space on detail pages.

**Rationale:** Higher information density on lists. Each entity must earn its detail page visit. Detail pages now use DetailHeader subtitle for the primary descriptive text (what_they_do for partners, current_state for engagements, description for programs).

**Impact:** All 6 list pages follow this pattern. Slot mappings documented in .claude/skills/roadrunner-ui/references/entity-catalog.md.

---

## 2026-02-21: Skill Doc as Design System Source of Truth

**Decision:** roadrunner-ui skill installed in .claude/roadrunner-ui/ with SKILL.md (234 lines) + 3 reference files (component-api.md, entity-catalog.md, design-tokens.md).

**Context:** Design decisions were scattered across conversation context and lost between sessions.

**Rationale:** Progressive disclosure — SKILL.md body loaded on trigger, reference files loaded on demand. Under 500 lines per spec. Future sessions read the same patterns automatically.

**Impact:** All future UI work in Claude Code starts from this skill. Update the skill to change conventions globally.

---

## 2026-02-21: Migration Verification Required After Supabase Applies

**Decision:** Always verify column existence after running migrations, especially multi-statement ones.

**Context:** Migration 022 partially failed — ALTER TABLE ADD COLUMN event_id silently failed while other statements succeeded. Events detail page crashed server-side on the missing column.

**Rationale:** Supabase migrations can partially fail without clear error reporting. PostgREST schema cache adds another layer of silent failure.

**Impact:** Add post-migration verification step to future migration workflows. Two checks: (1) column exists via SELECT, (2) PostgREST accepts the column via REST API query.

---

## 2026-02-22: Two-Phase Classification Architecture

**Decision:** Split email classification into Phase 1 (Match — lightweight routing) and Phase 2 (Analyze — deep analysis with full thread history). Phase 1 identifies which engagement an email belongs to using a compact index. Phase 2 produces current_state, open_items, participants, and entity matches with access to the engagement's complete email history.

**Context:** Single-phase classification sent full engagement context (current_state, open_items for ALL engagements) on every call, wasting tokens. Claude only saw a compressed summary, never the actual source emails, leading to state drift and inability to verify previous classifications.

**Rationale:** Two cognitive tasks (routing vs. analysis) deserve different context windows. Phase 1 needs breadth (see all engagements). Phase 2 needs depth (see full history of one engagement). Splitting them optimizes both. Phase 1 context: ~2K tokens. Phase 2 context: ~6-17K tokens depending on history depth.

**Impact:** Every email now goes through two Claude API calls instead of one. Phase 1 is fast/cheap (~500 tokens response). Phase 2 is thorough. Total cost per email is slightly higher but accuracy is significantly better. Files: classifier.ts (orchestration), phase1-prompt.ts (new), phase2-prompt.ts (new), claude.ts (two new API functions).

---

## 2026-02-22: Phase 2 Receives Full Email History

**Decision:** Phase 2 sees all source emails for the matched engagement (chronologically ordered, full body text) plus the existing current_state as an "anchor" to evolve.

**Context:** Previously Claude only saw the current_state paragraph (which it wrote last time) plus the new email. This created a game-of-telephone effect where each update slightly drifted from reality. Claude couldn't verify what it previously summarized.

**Rationale:** Even a 50-message engagement is only ~12K tokens of body text. Well within the 200K context window. Giving Claude the raw source material produces more accurate summaries and prevents information loss. The existing current_state serves as an anchor so Claude doesn't randomly restructure the summary.

**Impact:** More accurate current_state evolution. Claude can detect contradictions, understand the full narrative arc, and correctly identify what's genuinely new. Token cost per Phase 2 call scales with engagement size but remains manageable.

---

## 2026-02-22: Open Items Threshold — Blockers and Commitments Only

**Decision:** Open items must be "worth mentioning in a status update to leadership." Only concrete commitments, explicit blockers, and deadline-bearing requests qualify.

**Context:** The previous prompt extracted granular tasks ("I'll update the spreadsheet", "send follow-up email") that cluttered the UI and weren't useful for strategic tracking.

**Rationale:** Roadrunner is a relationship intelligence tool, not a task manager. PDMs need to see "Complete Security Competency technical review" not "send email to John." The threshold ensures open_items are actionable at the right altitude.

**Impact:** Fewer, higher-quality open items per engagement. Reduces noise in the UI. May need calibration through testing.

---

## 2026-02-22: Tags Removed from Classification

**Decision:** Removed suggested_tags from both Phase 1 and Phase 2 prompts, removed tag pills from engagement detail UI, removed tag merging from persistence layer. Tags column preserved in DB.

**Context:** Tags were freeform lowercase labels with no controlled vocabulary. They overlapped with pillar (categorical classification) and current_state (descriptive context) without serving a distinct purpose.

**Rationale:** Pillar (Co-Sell/Co-Build/Co-Market) handles the categorical work. Current_state handles the descriptive work. Tags were a middle ground nobody would filter by. Removing them gives Claude fewer things to generate, improving focus on what matters.

**Impact:** Cleaner UI, simpler prompt, tags column still in DB for potential future use.

---

## 2026-02-22: Pillar Inference (Co-Sell / Co-Build / Co-Market)

**Decision:** Added pillar classification to Phase 2 output. Co-Sell = revenue/deals/marketplace. Co-Build = integrations/certifications/technical. Co-Market = events/content/campaigns. Null if unclear.

**Context:** Needed categorical classification to replace tags. Pillar is a well-understood AWS partner framework concept that maps directly to how PDMs think about their work.

**Rationale:** Three categories are manageable, meaningful, and map to real business constructs. Claude infers from full context (history + new email). Null is acceptable for early-stage engagements.

**Impact:** Engagements now have a pillar field. Enables future filtering/grouping by work type. Written to DB by persistence layer.

---

## 2026-02-22: Defined Participant Role Vocabulary

**Decision:** Replaced freeform participant roles with a defined set: forwarder, partner_contact, aws_stakeholder, executive, technical_contact, third_party.

**Context:** Previous freeform roles produced inconsistent values like "sender", "cc'd", "recipient" — routing metadata rather than meaningful relationship descriptors.

**Rationale:** Constrained vocabulary produces consistent data that enables filtering and aggregation. Six roles cover all real-world cases for AWS PDM workflow.

**Impact:** More useful participant data. Enables future features like "show me all executives involved in my engagements."

---

## 2026-02-22: Inbox Resolve Runs Phase 2

**Decision:** When a user manually assigns an email to an engagement from Inbox, Phase 2 runs with the correct engagement's full history before persisting results.

**Context:** Previously, the single-phase classification result (written without knowing the correct engagement) was used directly. This produced inaccurate current_state updates.

**Rationale:** Phase 2 needs the correct engagement context to produce accurate analysis. Running it after user assignment ensures the current_state, open_items, and participant extraction are all informed by the right history.

**Impact:** Better accuracy for manually-resolved emails. Slightly slower resolve flow (adds one API call).

---

## 2026-02-22: Sonnet for Both Phases Initially

**Decision:** Use claude-sonnet-4-20250514 for both Phase 1 and Phase 2. May downgrade Phase 1 to Haiku after routing accuracy is proven.

**Context:** Phase 1 is pure pattern matching that could work with Haiku. But getting routing wrong cascades into Phase 2 analyzing the wrong engagement.

**Rationale:** Start safe, optimize later. Cost difference is negligible for single-user app. Speed difference (Haiku ~500ms vs Sonnet ~2s) is noticeable but not blocking.

**Impact:** Can be changed with a single model parameter swap in claude.ts after confidence in routing accuracy.

---

## 2026-02-24: Remove Priority Field

**Decision:** Priority field removed entirely from engagement model.

**Context:** Field was never set by classification, never used by PDMs, showed "—" on every engagement.

**Rationale:** Dead weight in schema, UI, prompts, and sync. Removing simplifies the entire engagement model.

**Impact:** Removed from DB (migration 038), types, supabase.ts, sync.ts, 2 API routes, 3 UI components, 5 test files.

---

## 2026-02-24: Remove Open Items Entirely

**Decision:** Open items (extraction, resolution, display) removed from the system.

**Context:** AI extraction of actionable items from email threads is too subjective. More likely to produce "that's wrong" reactions than value. Each PDM manages their own tasks.

**Rationale:** Roadrunner's job is summarizing engagement state, not task management. The "leadership altitude" test helped but the fundamental problem is subjectivity in interpreting email threads as tasks.

**Impact:** Removed from DB, types, classifier (mergeOpenItems, matchResolvedItems, resolveOpenItems), Phase 2 prompt, sync, API routes, OpenItemsCard component, 6 test files (13 dedicated tests removed).

---

## 2026-02-24: Simplify Status to Active/Planned/Archived

**Decision:** Engagement status reduced from 5 values (planned, active, paused, completed, archived) to 3 (active, planned, archived).

**Context:** "Paused" and "completed" didn't map to how PDMs think about engagements. They're either active or they're not, with "planned" as a holding state.

**Rationale:** Completed vs archived distinction doesn't matter operationally. Paused is just archived-you-might-reopen. Simpler model = less cognitive overhead.

**Impact:** Migration converts existing paused/completed to archived. Updated CHECK constraint, types, API validation, sync mapping, StatusBadge, all forms.

---

## 2026-02-24: Unified Timeline Architecture

**Decision:** Engagement detail page renders messages and meetings in a single chronologically-sorted timeline. Meetings are first-class timeline items positioned by meeting_date.

**Context:** Previously meetings piggybacked on their linked message's position via meetingsByMessageId lookup. A Feb 26 meeting appeared between Feb 20 and Feb 19 emails because the ICS was received with a Feb 20 message.

**Rationale:** Meetings are independent events with their own dates. A PDM looking at an engagement timeline expects chronological order. Both the meeting and its source email appear at their own dates.

**Impact:** New TimelineItem union type, unified timeline builder in page.tsx, Timeline.tsx renders by type, removed meetingsByMessageId piggybacking, section renamed from "Source Emails" to "Timeline".

---

## 2026-02-24: Sender Name Sanitize-First Pattern

**Decision:** parseSenderField() normalizes input (strip mailto artifacts, collapse brackets) before applying regex. displayName() includes defensive extraction for raw headers in the email field.

**Context:** Outlook's double-bracket mailto format ("Name <email<mailto:email>>") caused regex failure, dumping entire raw header into sender_email with sender_name: null.

**Rationale:** Sanitize-before-regex is more robust than adding regex alternatives. Handles unknown future noise patterns. Display-layer defense handles any bad data that leaks through. Comma-inverted names ("Last, First") flipped as part of normalization.

**Impact:** parseSenderField() pre-normalizes all inputs, displayName() defends against raw headers, handles comma inversion and 2-letter initials. 15 new tests.

---

## 2026-02-24: Graceful Degradation for Email Parsing

**Decision:** Three-tier parsing philosophy — high confidence (Outlook/Gmail headers), medium confidence (non-standard markers), low confidence (generic separators with metadata inheritance/fallback).

**Context:** Perfect email parsing is impossible across hundreds of clients. Rather than chasing every edge case, the system should degrade gracefully.

**Rationale:** Never lose content, always try metadata extraction, fall back through sent_at → forwarded_at → created_at. The display layer should handle nulls gracefully rather than requiring perfect extraction.

**Impact:** Establishes principle for all future parser work. Timeline already implements the date fallback chain.

---

## 2026-02-24: Remove Route-Level Dedup Gate

**Decision:** Removed the route-level dedup check in inbound/route.ts that compared only the first (oldest) parsed message. Now rely entirely on storeMessages() per-message fingerprint dedup.

**Context:** When re-forwarding a thread with new messages, the oldest message matched the dedup check and silently dropped the entire batch — including new messages. Users got no error, Mailgun got 200, messages vanished.

**Rationale:** The per-message dedup in storeMessages() already handles this correctly — it checks each message individually and only inserts new ones. The route-level gate was a premature optimization that broke the critical re-forward use case.

**Impact:** Re-forwarded threads with new replies now work correctly. Slightly more DB work on true duplicates (fingerprint check vs early abort), but correctness over performance.

---

## 2026-02-24: Engagement Slot Registry — Structured Fields

**Decision:** Added topic (3-8 words), goal (1 sentence), and engagement_type (nullable, taxonomy TBD) as structured fields on the engagements table alongside the existing current_state narrative.

**Context:** Engagements were a freeform name + one big prose paragraph. This made matching unreliable (semantic comparison of blobs), naming inconsistent (Claude invented titles), and display hard to scan. Needed structured fields for deterministic matching and quick-scan display.

**Rationale:** Follows "constrained intelligence" principle — Claude populates defined fields instead of generating freeform content. topic + partner_id gives deterministic matching. "{Partner} - {topic}" gives consistent naming. goal gives stable elevator pitch. current_state stays for the full narrative. engagement_type deferred until real data reveals natural categories.

**Impact:** Engagement names now computed as "{Partner} - {Topic}". Phase 2 prompt produces structured fields. Matching, display, and naming all benefit. DB migration 039 adds the columns.

---

## 2026-02-24: Dropped next_action, blocker, latest_development Fields

**Decision:** Removed next_action, next_action_owner, blocker, and latest_development from the slot registry design before implementation.

**Context:** Initially proposed as "quick scan" fields. Steven correctly identified these have the same failure mode as open_items — subjective extraction that degrades on complex multi-workstream threads, stale when follow-up emails aren't forwarded, and ambiguous when multiple actions are in flight.

**Rationale:** If a field can't be extracted accurately across diverse thread types at scale, it doesn't belong. The current_state narrative handles these naturally within context. Fewer fields that are accurate beats more fields that are sometimes wrong.

**Impact:** Keeps the engagement model lean — only fields that earn their place.

---

## 2026-02-24: Date Discipline Rules in Phase 2 Prompt

**Decision:** Added 6 explicit temporal rules to Phase 2: (1) point-in-time snapshot anchored to today's date, (2) no relative time words (recently, soon, this week), (3) stated dates from emails are facts, (4) no prediction — describe states not futures, (5) present progressive for ongoing activity, (6) deadlines must be sourced from emails.

**Context:** current_state was using relative time ("recently", "next week") that rotted between classifications. The narrative should read like a briefing written on a specific date, not a living document.

**Rationale:** current_state is a point-in-time snapshot. Grounding it to today's date and forbidding relative time makes it accurate regardless of when it's read. The timeline has rigid dates from data; the narrative should have the same discipline.

**Impact:** current_state quality improves. Today's date injected into Phase 2 context as temporal anchor.

---

## 2026-02-24: Topic/Goal Stability via Prompt Intelligence

**Decision:** Rather than code-level locking (only write if null), show Claude the existing topic and goal values in the engagement context and instruct preservation unless fundamental pivot.

**Context:** topic and goal are meant to be stable across emails, but persistence layer writes whatever Claude returns. Options were: (A) code lock — only write if null, require manual edits; (B) prompt intelligence — Claude sees existing values and preserves them.

**Rationale:** Code locking fights the AI. Prompt intelligence uses it. Same successful pattern as current_state anchoring. Claude can handle "keep this unless it genuinely changed" — that's a judgment call an AI should make.

**Impact:** Persistence layer stays simple (writes freely). Stability comes from the prompt. If topic/goal need updating after a genuine pivot, it happens automatically.

---

## 2026-02-25: Consistent Partner Contact Field Pattern

**Decision:** Every partner contact role follows Name + Email field pairs (Alliance Lead, PSA, Account Manager, PMM). Airtable is source of truth, Roadrunner syncs all 8 fields.

**Context:** Account Manager was a combined string ("Taylor Murphy - taymurph@amazon.com"), PSA had no email field, PMM had no email field. Inconsistent data made name resolution incomplete.

**Rationale:** Consistent pattern makes sync predictable, name resolution comprehensive, and future roles trivial to add. Split combined strings, added 3 new Airtable fields (PSA Email, Account Manager Email, PMM Email), added 5 new Roadrunner columns.

**Impact:** Name resolver now checks all 4 partner contact email fields. Taylor Murphy resolves instantly on any KnowBe4/Spacelift/Appgate/Veracode email without AI inference.

---

## 2026-02-25: Two-Layer Name Resolution (Catalogs → Participants)

**Decision:** Name resolution is a two-step lookup: catalog data (partner contacts + AWS relationship contacts) first, then participants (learned from email threads). No elaborate fallback chain.

**Context:** Previous architecture had confusing 3-layer priority with unclear boundaries. "Fallback" framing made it sound fragile.

**Rationale:** Partner contacts and AWS relationship contacts are all human-curated catalog data at the same trust level. Participants handle genuinely new people. Two layers, not three.

**Impact:** Simplified mental model. Clear ownership: catalogs for known contacts, participants for discovered contacts. Backfill after classification is the learning mechanism for new contacts, not a fallback.

---

## 2026-02-25: AWS Relationships = Cross-Portfolio Teams

**Decision:** AWS Relationships table stores product teams (AI/API Security, Edge Services/WAF, Observability, etc.) and program teams (Multicloud) that span the entire partner portfolio. Per-partner contacts (AM, PSA, PMM) live on the partner record.

**Context:** Confusion about whether Taylor Murphy (KnowBe4's AM) should be in AWS Relationships or on the partner. Answer: on the partner — she's a per-partner contact, not a cross-portfolio team.

**Rationale:** Different questions: "who works on this partner?" (partner record) vs "who runs this AWS program?" (AWS Relationships). Keeping them separate prevents data duplication and role confusion.

**Impact:** Clear data architecture for future team rollout. AWS Relationships could eventually sync from an internal directory of program/product team contacts.

---

## 2026-02-25: Post-Classification Backfill as Learning Mechanism

**Decision:** After Phase 2 classification upserts participants, backfill updates messages on the engagement where a participant has a better name than what was stored at parse time. Single bulk UPDATE, runs in persistClassificationResult() step 6.

**Context:** First email from a new contact gets incomplete name from parser ("Taylor" not "Taylor Murphy"). Claude extracts full name in Phase 2 and upserts to participants. But the message was already stored with the partial name.

**Rationale:** This is the correct design for genuinely new contacts — not a fallback. Catalog contacts resolve at parse time (no backfill needed). New contacts learn on first email, resolve instantly on second. "Better name" = more words or non-null replacing null. Never downgrades.

**Impact:** Self-healing system. Every email makes the contact directory richer. UI belt-and-suspenders lookup is redundant safety, not a feature.

---

## 2026-02-25: Meeting-Email Timeline Consolidation

**Decision:** When a meeting record has message_id linking to a source email, that email is suppressed from the timeline. Only the meeting card renders.

**Context:** Emails containing calendar invites created both a meeting record (from ICS parsing) and a message record. Both appeared in the timeline as separate items, confusing users.

**Rationale:** The meeting card has all the structured info (title, date, time, Zoom link). The raw email body is redundant and often full of dial-in boilerplate. Show the better representation.

**Impact:** Clean timelines. Spacelift engagement went from confusing duplicate items to single clean meeting card.

---

## 2026-02-25: Conference Boilerplate Stripping (Zoom/Teams/Webex)

**Decision:** stripConferenceBoilerplate() runs in cleanMessageBody() to remove Zoom, Teams, and Webex meeting blocks, Quick Reference sections, dial-in numbers, tel: protocol artifacts, and standalone conference URLs.

**Context:** Emails with meeting invites had bodies full of "Join Zoom Meeting", Meeting ID, Passcode, dial-in numbers — noise that obscured actual human-written content.

**Rationale:** Aggressive stripping is correct because the meeting record captures all structured data. If the email body is ONLY a meeting invite, the cleaned body should be minimal/empty.

**Impact:** Combined with timeline consolidation, meeting-related emails are now clean. Human content preserved, boilerplate eliminated.

---

## 2026-02-25: Body Sanitization Strategy — Three Directions

**Decision:** Top-down (gateway banners from beginning), bottom-up (signatures from end), targeted (inline artifacts like conference boilerplate, tracking URLs, image placeholders). Focus on what to keep, not what to remove.

**Context:** Pattern whack-a-mole — adding individual patterns for every corporate email artifact doesn't scale.

**Rationale:** Real email content is greeting + body + sign-off. Everything above (CAUTION/EXTERNAL banners) is gateway injection. Everything below (signatures, disclaimers) is noise. Inline artifacts (Zoom blocks, Exclaimer URLs) are targeted patterns.

**Impact:** Systematic approach that handles new email formats gracefully. Multi-line CAUTION banners, Zoom blocks, Mimecast URLs all stripped.

---

## 2026-02-25: Slot Registry UI Enables Human Correction Loop

**Decision:** Phase 2 already populates topic, goal, engagement_type in the database. Claude already reads these in Phase 1 for matching. The UI needs to surface these fields so users can see and correct them.

**Context:** Confusion about whether the UI is needed for classification to work. It's not — backend already works. But user visibility enables correction, which improves data quality, which improves classification accuracy.

**Rationale:** The UI is for the human correction loop, not for Claude. Better data → better matching → fewer inbox items. Without the UI, users can't see or fix wrong topics/goals.

**Impact:** Highest-leverage next step for classification accuracy improvement.

## 2026-02-26: Email-Only Entity Creation

**Decision:** Engagements can only be created via email classification (auto or inbox-confirmed). Meetings can only be created via ICS parsing. Manual create UI removed from both.

**Context:** Two code paths (manual + automated) meant two validation paths, two ways data could be inconsistent. Manual creation allowed records without email context.

**Rationale:** Single pipeline = single validation path. Human role shifts from creator to curator. Users who want to pre-create can forward themselves an email, which hits the same pipeline.

**Impact:** CreateEngagementForm deleted, MeetingsClient create form stripped. API POST routes kept (classifier + inbox + ICS still use them). ~390 lines removed.

## 2026-02-26: Engagement Status Simplified to 4 Values

**Decision:** Engagement status is now: active, blocked, completed, archived. "Planned" removed.

**Context:** With email-only creation, nothing enters as "planned" — it's already active the moment classification creates it.

**Rationale:** Every status must be reachable through normal system flow. "Planned" required manual creation which no longer exists.

**Impact:** CHECK constraint updated (migration 042), TypeScript types updated, all UI selectors updated, AT single select options updated by Steven.

## 2026-02-26: Meeting Status Simplified to 3 Values

**Decision:** Meeting status is now: scheduled, completed, did_not_occur. All lowercase. "Planned" removed.

**Context:** With ICS-only creation, meetings enter as "scheduled". Old values (Scheduling, Invites Sent, Confirmed) were aspirational workflow stages that were never implemented.

**Rationale:** Status should reflect reality, not workflow aspirations. Three clear states cover all cases.

**Impact:** CHECK constraint updated (migration 041), data migrated (old values → new), ICS parser default changed to "scheduled", TypeScript types updated, all UI components updated.

## 2026-02-26: Programs Schema Cleanup

**Decision:** Renamed eligibility→requirements, dropped url and status columns, added what_it_unlocks and notes.

**Context:** Field contract audit revealed naming mismatch (AT calls it Requirements, RR called it eligibility), ghost columns (url/status removed from AT), and missing catalog fields.

**Rationale:** Column names should match the authoritative source. Ghost columns create confusion. Catalog sync should be complete.

**Impact:** Migration 041, 16 TypeScript files updated, sync mapping updated, prompt-builder updated.

## 2026-02-26: Events Schema Expansion

**Decision:** Added sponsor_option (boolean), partner_day (boolean), partner_day_date (date) to events table.

**Context:** These fields exist in Airtable but were never synced to Roadrunner.

**Rationale:** Complete catalog sync — classifier needs event context including partner day and sponsorship info.

**Impact:** Migration 041, Event interface updated, syncEvents mapping updated.

## 2026-02-26: Engagement Date Fields Removed

**Decision:** Removed start_date and target_completion from engagements table and contract.

**Context:** Fields were in AT (hidden) and were initially added to RR in migration 041. Steven decided they're clutter.

**Rationale:** Engagements are email-driven activity streams, not projects with deadlines. created_at is the real start date. Message/meeting timestamps tell the real timeline.

**Impact:** Migration 042 drops columns, TypeScript interface updated, AT fields deleted by Steven.

## 2026-02-26: Engagement program_id FK Added

**Decision:** Added program_id UUID FK on engagements table referencing programs(id).

**Context:** Meetings already had program_id. Engagements linked to programs only through entity_links (generic many-to-many) which couldn't sync cleanly to AT.

**Rationale:** Direct FK mirrors the meetings pattern, enables clean sync of engagement→program link to AT's Program linked record field.

**Impact:** Migration 041, Engagement interface updated. Sync push not yet wired (Chunk 5 TODO).

## 2026-02-27: Legacy Constraint Removal

**Decision:** Dropped `initiatives_status_check` from engagements table (migration 043).

**Context:** `schema_live.sql` audit revealed two overlapping CHECK constraints on `engagements.status`. Legacy constraint from table rename (initiatives→engagements) only allowed active/paused/closed, while correct constraint allows active/blocked/completed/archived. AND enforcement meant only 'active' satisfied both.

**Rationale:** Tests passed because they mock Supabase — the bug was invisible at the TypeScript level but would reject any status change against the live DB.

**Impact:** Engagement lifecycle statuses (blocked, completed, archived) now work. Critical fix.

## 2026-02-27: Tags Removal

**Decision:** Removed tags column from engagements schema, types, classifier output, Phase 2 prompt, sync mappings, and UI (migration 045).

**Context:** Tags were generated by the classifier and stored as jsonb but never used for filtering, routing, or display decisions. No workflow consumed them.

**Rationale:** Structured categorization (pillar, program links, AWS relationship links) is richer and more actionable than free-form AI labels. If free-form labeling is needed later, add it back with intent.

**Impact:** Cleaner schema, simpler classification output, less sync overhead.

## 2026-02-27: Three-Action Resolve Architecture

**Decision:** Replaced resolve route's skip/new actions with confirm/assign_existing/discard. All three have full parity with auto-assign path (topic, goal, pillar, Airtable sync, meeting linking).

**Context:** The old resolve path was missing topic, goal, pillar, and Airtable sync — creating second-class engagements. "Skip" created orphaned messages with no recovery path.

**Rationale:** Every path that creates or assigns an engagement must produce identical data quality. The human review path should not be a lesser version of the automated path.

**Impact:** Inbox resolution is now a first-class operation. No data quality divergence between auto-assigned and manually-resolved engagements.

## 2026-02-27: Orphan Elimination

**Decision:** Eliminated "orphaned messages" as a concept. Skip→Discard. OrphanedMessageCard deleted. getOrphanedMessages deleted.

**Context:** "Skip" created messages in permanent limbo — no engagement, not noise, invisible in UI. Dead-end data.

**Rationale:** Every message either gets assigned to an engagement or explicitly discarded as noise. If discarded incorrectly, the next email in the thread will re-enter the pipeline anyway. No need for limbo.

**Impact:** Simpler mental model, no invisible data accumulation, cleaner inbox.

## 2026-02-27: Inbox as Safety Net Philosophy

**Decision:** The inbox should be nearly empty. The AI suggestion is front and center with one-click Confirm. Assign Existing is a quiet secondary action. No ranked lists, no multi-match comparison UI.

**Context:** Initial design considered ranked match lists and side-by-side comparisons. Steven pushed back — building fancy review UI compensates for classifier weakness instead of fixing it.

**Rationale:** Invest in making the classifier smarter (fewer inbox items) not the inbox fancier (better review UX). The inbox is a safety net, not a workflow.

**Impact:** UI stays simple. Future investment goes into classification quality, not review features.

## 2026-02-27: Partner Field ID Correction

**Decision:** Fixed stale Airtable field ID for Partner linked record on engagements (fld8MJU06GPUU0iy6 → fldkYNE9C0UcdnGCL).

**Context:** Steven had deleted and recreated Airtable linked record fields, generating new field IDs. The sync code still had the old ID. Airtable silently ignores writes to invalid field IDs when `typecast: true` is set.

**Rationale:** Discovered during sync gap investigation. Confirmed by cross-referencing live Airtable metadata API response against code.

**Impact:** Partner links on engagements now actually sync to Airtable. All previous engagement syncs were silently dropping the partner link.

## 2026-02-27: Engagement Sync Gaps Closed

**Decision:** Wired engagement program_id and engagement_aws_relationships sync to Airtable, copying the meeting sync pattern exactly.

**Context:** These were the last two TODOs in the field contract. FKs and junction tables existed in Roadrunner but push logic wasn't implemented.

**Rationale:** Meeting sync already solved this problem — same lookup maps, same linked record resolution, same pattern. No reason to invent a new approach.

**Impact:** Field contract has zero remaining sync TODOs. All engagement data flows to Airtable.

## 2026-02-18: Meeting Notes — Airtable-Only Scratch Space

**Decision:** Stop pushing meeting.notes from Roadrunner to Airtable. Stop populating meeting.notes from ICS DESCRIPTION in Supabase. Airtable Notes field on Meetings table is manual-only.

**Context:** ICS DESCRIPTION contains Zoom/Teams boilerplate (dial-in numbers, passcodes, SIP addresses) that dominated the meeting detail UI and Airtable Notes field with useless data.

**Rationale:** Meeting structured fields (date, time, location, attendees, links) already capture everything useful. Notes in Airtable serves as optional scratch space for post-meeting annotations.

**Impact:** `createMeetingFromICS()` no longer sets notes. `sync.ts` no longer pushes `MF.notes`. UI conditionally hides empty notes section.

## 2026-02-18: Meeting Partner as Linked Record

**Decision:** Convert Meeting Partner field from singleLineText to multipleRecordLinks, matching Engagement Partner pattern.

**Context:** `sync.ts` was already doing record ID lookups but writing to a text field, which would fail or write literal record ID strings.

**Rationale:** Consistency with Engagement Partner. Enables cross-table views. Sync code already had the right logic, just needed the Airtable field type to match.

**Impact:** Airtable field manually converted. `sync.ts` partner push already sent `[recordId]` format. No code change needed.

## 2026-02-18: Engagement Participants Synced to Stakeholder Fields

**Decision:** Populate AWS Stakeholders, Partner Stakeholders, and Third Parties in Airtable from Roadrunner's participants + participant_links tables.

**Context:** These three text fields existed in Airtable but were only manually populated. Roadrunner had structured participant data that wasn't flowing to Airtable.

**Rationale:** Field ownership principle — every Airtable field is either synced or Airtable-only. These fields had participant data in Roadrunner that should be authoritative.

**Impact:** New `fetchEngagementParticipants()` function with batch-fetch support. Three-bucket split using same classification as meeting attendees. Both single-push and bulk-sync paths updated.

## 2026-02-18: Field Ownership Principle

**Decision:** Every Airtable field must be either (1) synced from Roadrunner or (2) Airtable-only for a stated reason. No half-synced fields, no orphans.

**Context:** Audit revealed participant data in Roadrunner not flowing to stakeholder fields, meeting notes being pushed as raw ICS data.

**Rationale:** Clear ownership prevents stale data, conflicting sources of truth, and sync bugs. Makes it immediately obvious whether a field change should happen in Roadrunner or Airtable.

**Impact:** Governs all future field additions. Documented in FIELD-MAPPING.md.

## 2026-02-18: Engagement Summary Column Dropped

**Decision:** Remove the summary column from engagements table. `current_state` is the sole source of truth.

**Context:** `summary` was created in migration 001, annotated as legacy in migration 010. Classifier was mirroring `current_state` into `summary` on every write. UI only used it as fallback.

**Rationale:** Dead column that's always a copy of `current_state`. Creates confusion about which field is authoritative. The fallback path in UI would never trigger.

**Impact:** Removed from `types.ts`, `supabase.ts`, `classifier.ts`, 3 UI files, 3 test files. Migration 035 drops the column.

## 2026-02-18: Forwarder Note = Substantive Text Only

**Decision:** Filter signature blocks from forwarder note detection. Only substantive text (actual sentences, instructions, context) should be captured as `forwarder_note`.

**Context:** Outlook auto-inserts signature blocks when forwarding. The parser was capturing these as `forwarder_note`, sending corporate contact info to Claude as editorial context.

**Rationale:** Pattern-based detection using capitalization rules (title-case words = signature, lowercase words = substantive) is generic and doesn't require hardcoding specific signatures.

**Impact:** `stripSignatureLines()` function in `email-parser.ts`. 12 new tests. Works for any user's signature, not just Steven's.

## 2026-02-22: Full-Width Detail Pages — No Sidebars

**Decision:** Detail pages use full-width stacked layout. Sidebars eliminated.

**Context:** Partner and Meeting detail pages had sidebars duplicating header metadata and burying important content below the fold.

**Rationale:** Sidebars create duplication and bury content in the less-visible right column. Full-width layout gives every section equal access to horizontal space and establishes scannable top-to-bottom flow.

**Impact:** Partner detail, Meeting detail converted. Pattern applies to all future detail page work.

## 2026-02-22: Two-Column Context Cards

**Decision:** Dense identity content merges into single two-column cards (responsive: side-by-side desktop, stacked mobile).

**Context:** Partner detail had "What They Do" as a throwaway subtitle and AWS Context as a separate card — together consuming ~50% of viewport.

**Rationale:** Two related pieces of context belong together visually. Single card with two columns communicates "these are complementary" while halving vertical space.

**Impact:** Partner detail uses this for What They Do + AWS Context. Pattern reusable for any detail page with two complementary context blocks.

## 2026-02-22: Viewport Budget — Identity + Context ≤ 1/3 Viewport

**Decision:** On detail pages, header + context sections must not exceed approximately one-third of viewport height.

**Context:** Partner detail page was top-heavy — meetings, engagements, and relationships pushed entirely below the fold.

**Rationale:** Activity content (what you interact with) should be visible without scrolling. Identity content (what something is) is reference material that supports activity, not the primary focus.

**Impact:** All detail pages. Forces condensed context treatments and prevents creeping header bloat.

## 2026-02-22: Attendee Grouping by Email Domain

**Decision:** Meeting attendees grouped by organization (AWS/Partner/Other) using email domain matching. Relay inbox address filtered out.

**Context:** Meeting detail had flat ungrouped attendee list including the relay forwarding address.

**Rationale:** Domain-based grouping is deterministic and maintenance-free — no manual tagging needed. Filtering relay address removes infrastructure noise from user-facing display.

**Impact:** Meeting detail page. Pattern applies anywhere attendees are displayed.

## 2026-02-22: Meeting-in-Thread Distinct Card Pattern

**Decision:** Messages with associated meetings render as visually distinct clickable cards in engagement email threads.

**Context:** Meeting invites in Source Emails section looked identical to regular email replies.

**Rationale:** Meetings are temporal events with structured data (date, time, location) that regular emails don't have. Visual distinction communicates "this is a different kind of thing" without breaking chronological flow.

**Impact:** Engagement detail page. Pattern: temporal entities get distinct treatment in non-temporal contexts.

## 2026-02-22: Three-Tier Visual Weight by Entity Type

**Decision:** Temporal entities (meetings) get timeline/card treatment. Workstreams (engagements) get status-driven lists. Structural entities (AWS relationships) get compact minimal lists.

**Context:** Partner detail previously treated engagements, meetings, and relationships with identical flat sections.

**Rationale:** Visual weight should match how frequently an entity changes and how time-sensitive it is. Meetings change daily, engagements weekly, relationships rarely.

**Impact:** Partner detail page sections. Pattern applies system-wide wherever mixed entity types appear together.

## 2026-02-22: URL-as-Location Detection

**Decision:** Location fields containing URLs render as clickable action buttons. Physical addresses render as plain text.

**Context:** Meeting locations showing raw Zoom URLs as long unformatted strings.

**Rationale:** URLs are actionable (you click them to join), addresses are informational (you read them). Different data types deserve different rendering.

**Impact:** Meeting detail page and meeting-in-thread cards. Pattern applies anywhere location fields are displayed.

## 2026-02-22: Four Visual Treatments by Entity Type

**Decision:** Each entity type gets a specific visual treatment instead of one universal component. PillGrid for catalogs, TableList for portfolios, CalendarCard for temporal items, inline table rows for activity items.

**Context:** CompactRow was being used for everything, creating visual monotony where all 7 entity types looked identical.

**Rationale:** Different information has different scanning patterns. You scan a catalog differently than a portfolio. Forcing one layout onto everything optimized for nothing.

**Impact:** 3 new shared components (PillGrid, TableList, CalendarCard) + 1 CSS pattern (inline table rows). All list pages converted.

## 2026-02-22: CompactRow Deprecated — Inline Table Rows as Default

**Decision:** CompactRow (rounded-xl card wrapper per list item) fully deprecated with zero imports remaining. Default list item treatment is clean flat inline table rows with border-bottom separators.

**Context:** CompactRow created heavy visual weight for items that didn't need it. The rounded card wrapper per row consumed vertical space and created inconsistency.

**Rationale:** The flat row pattern is universally cleaner, more scannable, and naturally aligns columns. Cards add visual weight that should be reserved for truly important items (inbox review cards).

**Impact:** CompactRow.tsx marked deprecated. All pages use inline rows, PillGrid, CalendarCard, or TableList.

## 2026-02-22: Context-Aware Badge Display

**Decision:** Badges removed from list views when surrounding context already conveys the same information. Status badges right-aligned for consistent alignment.

**Context:** Showing "[Security]" badge on every partner under the "SECURITY" group header is redundant. Inline badges after variable-length names caused misalignment.

**Rationale:** Information should appear exactly once in the user's visual field. Redundant badges add noise without information.

**Impact:** All list pages and detail page linked sections follow this rule.

## 2026-02-22: Data Formatting Utility Layer

**Decision:** Raw data from the database never renders directly in the UI. Three utility functions handle all display formatting: extractCity() for locations, formatCompactDateRange() for dates, cleanMeetingTitle() for meeting names.

**Context:** Postal codes, venue names, FW: prefixes, and raw URLs were leaking through to the UI because data was rendered as-is from the database.

**Rationale:** Centralizing formatting in utility functions ensures consistency and makes it easy to fix formatting bugs in one place.

**Impact:** src/lib/format-utils.ts contains all formatters. Applied across all pages.

---

## 2026-02-27: Phase 1 Prompt Rewrite — Multi-Engagement Partner Awareness

**Decision:** Rewrote Phase 1 classification prompt. Replaced "Prefer existing engagements" with "Match by partner AND topic." Added multi-engagement partner concept, topic mismatch = new engagement rule, ambiguous same-partner instruction, confidence recalibration, and concrete example callout.

**Context:** Spacelift Solution Spotlight email (about a marketing campaign) was incorrectly merged into Spacelift OpenTofu engagement (about an integration project) at 0.92 confidence. Phase 1 over-weighted partner name match and had no concept that one partner could have multiple concurrent engagements with different topics.

**Rationale:** Six specific prompt problems identified: (1) "Prefer existing" biased toward matching, (2) confidence calibration didn't address same-partner-different-topic, (3) no multi-engagement partner concept, (4) new engagement bar too high for existing partners, (5) engagement index lacked topic field, (6) no guidance for partner-matches-but-topic-doesn't. All six addressed in rewrite.

**Impact:** Classifier now correctly differentiates initiatives for the same partner. Validated: 3 separate Spacelift engagements created (OpenTofu/Co-Build, Solution Spotlight/Co-Market, IC Marketplace Onboarding/Co-Sell) with vague "scheduling" email correctly routed to inbox at 65% confidence for human review.

---

## 2026-02-27: Topic Added to Engagement Index

**Decision:** Added explicit Topic field to Phase 1 engagement index lines. Format changed from `"Name" (id) — Partner: X | Subject: "Y"` to `"Name" (id) — Partner: X | Topic: "Z" | Last Subject: "Y"`.

**Context:** Phase 1 could only infer topic from engagement name and last email subject. For multi-engagement partners, explicit topic comparison is essential for accurate routing.

**Rationale:** The engagement name embeds the topic (e.g., "Spacelift - OpenTofu Integration") but relying on name parsing is fragile. An explicit topic field gives the classifier structured data to compare against.

**Impact:** Phase 1 has direct topic comparison capability. Combined with prompt rewrite, enables accurate multi-engagement partner routing.

---

## 2026-02-27: Programs Catalog Has No Status Lifecycle

**Decision:** Removed .eq("status", "active") filter from getActivePrograms() in supabase.ts. Programs are a catalog table with no status column.

**Context:** Migration 041 (Feb 26) dropped programs.status column, but getActivePrograms() still filtered by it. Supabase returned an error, inbound route caught it silently (returns 200 to Mailgun), and messages were stored but never classified. Pipeline appeared completely broken — zero engagements from 6+ forwarded emails.

**Rationale:** Programs are synced from Airtable as a reference catalog. They don't have lifecycle status — they're either in the catalog or not. The filter was leftover from when programs had a status field.

**Impact:** Classification pipeline restored. Third instance of silent failure pattern this session (overlapping CHECK constraint, stale field IDs, nonexistent column query). All three shared root cause: changes at one layer without verifying dependent layers.

---

## 2026-02-27: Meeting Partner Field ID Correction + Full Field Audit

**Decision:** Fixed stale Airtable field ID for Partner linked record on Meetings table (fldZjCUMpBtgpU13X → fldubdX4ZYXFQ2sIZ). Conducted full audit of all 29 field IDs across ENF (11 fields) and MF (18 fields).

**Context:** Same pattern as engagement Partner field ID fix earlier in session. Steven recreated Airtable linked record fields, generating new IDs. Discovered during meeting sync test — "Unknown field name" error.

**Rationale:** After finding two stale field IDs in one session, a comprehensive audit was warranted. All 29 IDs cross-referenced against live AT API. Zero additional mismatches found.

**Impact:** Meeting partner links now sync to Airtable. All field IDs verified correct. FIELD-MAPPING.md updated.

---

## 2026-02-28: Meeting Pipeline Refactor (Steps 1-6)

**Decision:** Comprehensive meeting pipeline overhaul across 6 steps, touching ICS parser → meeting creation → sync → resolve linking → classifier enrichment → cleanup.

### Step 1: ICS Parser Enhancement
Extracted METHOD, STATUS, SEQUENCE, RRULE, and organizer name from ICS content. Added `is_cancellation` derived flag (METHOD=CANCEL or STATUS=CANCELLED). 18 → 31 ICS parser tests.

### Step 2: createMeetingFromICS Three-Scenario Refactor
Refactored from simple insert to three-path flow: **new** (insert with partner matching), **cancel** (update existing to cancelled status), **update** (sequence-aware upsert — rejects stale updates where sequence < stored). Deterministic partner matching via `matchPartnerFromAttendees()` extracts attendee email domains and matches against partner catalog. Migration 046 added `sequence` (integer) and `is_recurring` (boolean) columns, added 'cancelled' to status CHECK, dropped `meeting_type` column.

### Step 3: Meeting Status Case Mapping
DB stores lowercase (`scheduled`, `completed`, `cancelled`, `did_not_occur`). Sync maps to title case (`Scheduled`, `Completed`, `Cancelled`, `Did Not Occur`) via `MEETING_STATUS_MAP` for Airtable singleSelect compatibility. Removed `meeting_type` from sync — now Airtable-only manual field.

### Step 4: Meeting Linking in Resolve Route
Discovered `linkMeetingToEngagement()` was already called in the resolve route for both `confirm` and `assign_existing` actions. Added 4 tests verifying: meeting invite confirmed → linked, meeting invite assigned → linked to new engagement, regular email → not linked, discard → not linked.

### Step 5: Structured Meeting Data for Classifier
Phase 1 now queries meeting records by `message_id` (meeting exists before classification runs) and appends structured attendee list + partner hint from ICS domain matching. Phase 2 linked meetings enriched from one-line summary (attendee count) to full attendee names/emails, organizer, and recurring flag. New `buildMeetingHint()` in phase1-prompt.ts, new `buildNewMeetingData()` in phase2-prompt.ts.

### Step 6: Cleanup
Removed dead `buildEngagementsSection()` and `buildPartnersSection()` from prompt-builder.ts (superseded by Phase 1's compact builders). Removed 5 associated tests and unused type imports. Updated FIELD-MAPPING.md with new DB columns, status contract, Airtable-only fields, and partner matching note.

### Key Decisions
- **meeting_type and cadence are Airtable-only manual fields** — not synced from DB, not part of classification output. Taxonomy TBD from real usage patterns.
- **Meeting status contract:** DB lowercase → `MEETING_STATUS_MAP` → AT title case. Single source of truth for the mapping.
- **Partner matching before classification:** `createMeetingFromICS` resolves `partner_id` from attendee domains before classifier runs, enabling deterministic matching instead of fuzzy text inference.
- **Sequence-aware upserts:** ICS updates with sequence < stored sequence are rejected as stale, preventing out-of-order calendar updates from overwriting newer data.

### Migration 046
- Added `cancelled` to meetings status CHECK constraint
- Dropped `meeting_type` column
- Added `sequence` (integer, nullable) column
- Added `is_recurring` (boolean, default false) column

### Test Progression
370 → 374 (resolve route) → 384 (classifier enrichment) → 379 (cleanup: -5 dead tests)

---

## 2026-02-28: Curated-Input Classification Philosophy

**Decision:** Roadrunner receives intentionally forwarded emails, not a firehose. Classification assumes content is engagement-relevant by default. Three tiers: auto-assign (majority), inbox (ambiguous match), no-match (edge case).

**Context:** Phase 1 prompt had excessive noise-filtering language (~6 lines) relative to its actual input. PDMs curate what they forward. System was overcomplicating classification by assuming adversarial input.

**Rationale:** Shifting the default assumption from "identify what this is" to "figure out which engagement" dramatically simplifies the classification prompt and reduces misclassification from decision-branch bloat.

**Impact:** Future prompt rewrites should lead with matching, not filtering. Inbox should be rare (1% target), not a workflow hub.

---

## 2026-02-28: ICS Parser Full Signal Extraction

**Decision:** Parser now extracts method, status, sequence, is_recurring, organizer_name, is_cancellation (6 new fields). Three-path cancellation detection: METHOD:CANCEL, STATUS:CANCELLED, title regex fallback.

**Context:** Parser was ignoring METHOD (cancellations created as "scheduled"), SEQUENCE (updates silently dropped), RRULE (no recurrence detection), and organizer name (extracted then discarded).

**Rationale:** ICS data is structured and rich — capture everything at parse time so downstream consumers can use it without re-parsing.

**Impact:** Foundation for cancellation handling, update tracking, and future RRULE-based cadence detection.

---

## 2026-02-28: Three-Scenario Meeting Creation (New/Cancel/Update)

**Decision:** createMeetingFromICS handles three scenarios: (a) new meeting with deterministic partner matching, (b) cancellation updates status to 'cancelled' and preserves original data, (c) updates are sequence-aware and only apply if incoming >= stored.

**Context:** Previous implementation used ignoreDuplicates:true — duplicate ics_uid silently returned null. Meetings could never update, cancellations created new "scheduled" records.

**Rationale:** Calendar invites have a lifecycle (create → update → cancel). The system must handle the full lifecycle, not just creation.

**Impact:** Meetings now reflect reality — cancellations show as cancelled, time changes propagate, stale updates are rejected.

---

## 2026-02-28: Deterministic Partner Matching from Attendees

**Decision:** matchPartnerFromAttendees() scans non-Amazon attendee email domains against partner contact fields. If exactly one partner matches → partner_id set. Zero or ambiguous → null.

**Context:** Partner resolution for meetings only happened via classifier (linkMeetingToEngagement copying from engagement). If classification was uncertain, meeting had no partner.

**Rationale:** Attendee emails are structured data that deterministically maps to partners. No AI needed. This runs before classification, giving Phase 1 a partner hint.

**Impact:** Meetings get partner_id at creation time. Phase 1 classification is simpler and more accurate for meetings. Reusable helper function.

---

## 2026-02-28: Meeting Status Three-Layer Contract

**Decision:** DB stores lowercase ('scheduled', 'completed', 'cancelled', 'did_not_occur'). sync.ts MEETING_STATUS_MAP converts to title case for Airtable. Added 'cancelled' to DB CHECK constraint via migration 046.

**Context:** Code pushed raw lowercase to AT, creating duplicate "scheduled"/"Scheduled" options. Engagement status already had correct mapping; meetings did not.

**Rationale:** Follow the established engagement pattern. DB stores normalized values, sync layer handles display formatting.

**Impact:** No more rogue AT options. Pattern is now consistent across both entity types.

---

## 2026-02-28: Meeting Type and Cadence as Airtable-Only Manual Fields

**Decision:** Meeting type and cadence will NOT be in Roadrunner's DB or classification pipeline. They are manual Airtable fields the PDM tags by hand. meeting_type column dropped from DB (migration 046).

**Context:** Meeting taxonomy is unknown — need 50-100 meetings to see natural categories. Building classification for an uncertain taxonomy creates prompt issues disguised as AI issues.

**Rationale:** Constrained intelligence — don't let AI invent categories. Start manual, learn patterns, automate when taxonomy is proven. Same philosophy as engagement matching.

**Impact:** Cleaner DB schema. Sync code simplified. Classification prompt stays lean. Automation added later when taxonomy is proven.

---

## 2026-02-28: Structured Meeting Data Fed to Classifier

**Decision:** Phase 1 now receives "Meeting Data" section with partner hint, organizer, structured attendee list, and recurring flag. Phase 2 receives enriched meeting summary with full attendee details instead of just count.

**Context:** Classifier saw meetings as email body text only. Clean [{name, email}] array sat in DB unused. AI was reconstructing structured data from prose.

**Rationale:** Use the best data available. Structured attendees enable deterministic matching. Partner hint from attendee domain matching makes Phase 1's job dramatically easier.

**Impact:** Higher classification accuracy for meetings. Less reliance on email body parsing. Foundation for "meetings should almost never need human review."

---

## 2026-02-28: Dead Prompt Builders Removed

**Decision:** buildEngagementsSection() and buildPartnersSection() removed from prompt-builder.ts (-61 lines code, -92 lines tests, -153 total).

**Context:** Phase 1 uses its own compact builders (buildEngagementIndex, buildCompactPartnerCatalog). The full builders were exported but never imported anywhere outside their own test file.

**Rationale:** Dead code is confusion risk. Someone (or Claude) might use the wrong builder.

**Impact:** Cleaner codebase. One way to build each context section.

---

## 2026-02-28: Universal Contact Format Name \<email\> (Title)

**Decision:** All contact storage uses `Name <email> (Title)` with `<—>` for missing email, `(—)` for missing title. Newline-separated in multi-person fields.

**Context:** 11 inconsistent contact storage patterns across Partners (9 fields) and AWS Relationships (4 fields) — separate name/email columns, text arrays, raw strings.

**Rationale:** One format, one parser. Self-documenting placeholders make incomplete data visible at a glance. Newlines are unambiguous delimiters.

**Impact:** `contact-parser.ts` is the single parse/render path. All sync pull/push, name resolution, and prompt building flows through this format.

---

## 2026-02-28: Role vs Title Separation

**Decision:** Airtable column name defines role (PSA, Alliance Lead). Parenthetical is job title (Partner Solutions Architect). Both stored but serve different purposes.

**Context:** Classifier was writing role labels like "stakeholder" into the title column, polluting it with non-title data.

**Rationale:** Roles are structural (what function someone serves). Titles are identity (what they're called). Classifier needs both for accurate engagement categorization.

**Impact:** `participant_links.role` holds classifier labels. `participants.title` reserved for real job titles only. No blocklist or heuristic needed.

---

## 2026-02-28: JSONB Dual-Column Architecture

**Decision:** Partners get `aws_team` (PSA, AM, PMM) and `partner_contacts` (Alliance Lead, Contacts) as separate JSONB arrays. AWS Relationships get `contacts` JSONB. Meetings get `organizer_name` text.

**Context:** Contact data was scattered across 13+ scalar columns with no structured querying capability.

**Rationale:** JSONB arrays of `{name, email, title, role}` objects enable structured queries, role-aware lookups, and clean rendering. Org-boundary separation (AWS staff vs partner staff) reflects real-world distinction.

**Impact:** Name resolver reads JSONB instead of scanning 8+ scalar columns. Prompts render richer contact context. Foundation for UI contact cards in Phase 3.

---

## 2026-02-28: Dual-Write Transition Strategy

**Decision:** Sync pull writes both new JSONB columns and old scalar columns simultaneously. UI reads old columns during transition.

**Context:** UI pages (partners/[id], relationships/[id]) still reference old column names.

**Rationale:** Zero-downtime migration. Nothing breaks during transition. Old columns become dead code only when UI switches to JSONB reads.

**Impact:** Phase 3 scope is clear: update UI to read JSONB, drop old columns, remove dual-write code.

---

## 2026-02-28: Fetch-All-and-Filter for Name Resolution

**Decision:** Name resolver continues fetch-all-and-filter-in-memory pattern, just reading from JSONB columns instead of scalar columns.

**Context:** Postgres JSONB containment queries (`@>`) are more efficient at scale but add SQL complexity.

**Rationale:** 20 partners + 7 relationships = trivial dataset. JSONB containment is premature optimization. Same proven pattern, new data source.

**Impact:** Simpler code, easier debugging. Revisit if partner count grows 10x+.

---

## 2026-02-28: contact-parser.ts as Single Source of Truth

**Decision:** All `Name <email> (Title)` parsing and rendering goes through one utility file. No ad-hoc regex elsewhere.

**Context:** Contact format logic was scattered across pull.ts, push.ts, name-resolver.ts with inconsistent parsing.

**Rationale:** One format = one parser. Future format changes touch one file. 26 tests cover all edge cases.

**Impact:** `parseContact`, `parseRoleContact`, `parseContactList`, `renderContact`, `renderContactList` are the only contact format functions in the codebase.

---

## 2026-03-01: Phase 3 — Drop Legacy Scalar Contact Columns

**Decision:** Completed Phase 3 of contact standardization. Removed all 12 old scalar contact columns from TypeScript interfaces, all code references, dual-write logic, and created migration 048 to drop the database columns.

**Context:** Phase 1 added JSONB columns (`aws_team`, `partner_contacts`, `contacts`). Phase 2 added the unified contact format parser and dual-write. Phase 3 cuts over completely — old columns are dead code.

**Changes:**
- Removed 9 Partner scalar fields: `alliance_lead`, `alliance_lead_email`, `psa`, `psa_email`, `account_manager`, `account_manager_email`, `pmm`, `pmm_email`, `partner_contact_emails`
- Removed 3 AwsRelationship scalar fields: `primary_contact_name`, `primary_contact_email`, `aws_contact_emails`
- Deduplicated `Contact`/`RoleContact` types — single definition in `types.ts`, imported everywhere
- Removed dual-write from `pull.ts` (12 lines across `mapPartner` and `mapRelationship`)
- Updated 7 UI pages/components to read from JSONB arrays with role-based lookup
- Updated 2 API routes to accept JSONB payloads
- Rewrote `RelationshipActions.tsx` edit form to use `Name <email> (Title)` textarea format
- Fixed all 5 test fixture files to use new JSONB shape
- Migration 048: `DROP COLUMN IF EXISTS` for all 12 columns

**Rationale:** Compiler-driven refactoring — remove types first, let `tsc --noEmit` generate the 72-error fix list, fix systematically in dependency order (types → lib → UI → API → tests).

**Impact:** 405 tests pass, 0 failures. 3 pre-existing unrelated compile errors remain. Zero old-column references in source code. JSONB arrays are now the only contact data path.

---

## 2026-03-01: Compiler-Driven Refactoring Pattern

**Decision:** When removing fields from shared interfaces, strip them from TypeScript types FIRST, then use `tsc --noEmit` errors as an exhaustive task list for all consumers.

**Context:** Phase 3 required removing 12 scalar contact columns referenced across 19 files and 75 locations. Manual search would miss edge cases.

**Rationale:** The compiler catches 100% of typed references. Tests use runtime data so they keep passing during the refactor, giving you a stable baseline. Fix compile errors file by file, run tests after each chunk.

**Impact:** Reusable pattern for any future cross-cutting interface change. Applied successfully: 72 errors → 0 across 4 chunks with zero regressions.

---

## 2026-03-01: Single JSONB Contact Data Path

**Decision:** All contact consumers (UI pages, API routes, lib modules, classifier prompts, sync) now read exclusively from JSONB columns (aws_team, partner_contacts, contacts). Dual-write removed. Migration 048 drops 12 legacy scalar columns.

**Context:** Phase 1 created JSONB columns, Phase 2 populated them with dual-write for backward compatibility, Phase 3 cuts over all consumers and removes the bridge.

**Rationale:** Dual-write was always transitional. Maintaining two data paths creates divergence risk and doubles the surface area for bugs. With all consumers migrated and verified, the old path is pure liability.

**Impact:** contact-parser.ts is the universal format handler. One data path from Airtable through classification through display. No more scalar/JSONB divergence risk.

---

## 2026-03-01: FIELD-MAPPING.md as Verified Sync Contract

**Decision:** FIELD-MAPPING.md was fully rewritten from live Airtable schema (via MCP) cross-referenced against code (field-maps.ts audit). Must be updated whenever field-maps.ts changes.

**Context:** Previous version had 9 deleted field IDs still listed, 13 undocumented field IDs, and 1 ghost URL field. The doc was worse than no doc because it would mislead Claude Code.

**Rationale:** The field mapping doc serves two audiences — Steven (reference) and Claude Code (session context). Accuracy is non-negotiable for the latter.

**Impact:** Every field ID in the doc is now verified against both live Airtable and running code. Changelog section added to track future updates.

---

## 2026-03-01: Chunked Refactoring Sequence

**Decision:** Large cross-cutting refactors follow the sequence: Types → Lib → UI → API/Tests → Migration. Each chunk verified independently before proceeding.

**Context:** Phase 3 touched 19 files across every layer. Doing it all at once would make failures impossible to diagnose.

**Rationale:** Types first creates the compiler safety net. Lib before UI because UI depends on lib. API and tests last because they're leaf nodes. Migration absolutely last because it's irreversible.

---

## 2026-03-01: Await All Airtable Pushes (Kill Fire-and-Forget)

**Decision:** Convert all fire-and-forget Airtable push calls to awaited calls with try/catch error handling.

**Context:** The Qualys RSA Conference Partnership Meeting engagement existed in Supabase with 6 messages and 7 participants but never appeared in Airtable (`airtable_record_id: null`). Investigation revealed the classification pipeline used `import("./sync").then(({ pushEngagementToAirtable }) => ...)` — a dangling promise. On Vercel serverless, the function terminates after sending the HTTP response, killing in-flight background promises. The push was silently murdered.

**Rationale:** Email processing is not latency-sensitive — adding ~500ms for a synchronous Airtable push is acceptable. The alternative (a retry queue or webhook-based push) is over-engineering at 20-partner scale. Bulk sync remains as a safety net for cases where Airtable itself is unavailable.

**Impact:** 12 push/delete calls across 6 files converted from fire-and-forget to awaited. Zero fire-and-forget patterns remain. Every engagement and meeting created or updated in Supabase will now reliably land in Airtable regardless of Vercel's function lifecycle.

**Impact:** Establishes the standard pattern for future refactors. Each chunk has a clear error-count target and test baseline.

---

## 2026-03-01: Engagement as Authoritative Hub (Phase A — Event Links)

**Decision:** Engagement is the single authoritative hub for all entity connections. Partner, Program, Event, and AWS Relationships all link FROM the engagement. Meetings are timeline events within engagements — they inherit connections from their parent engagement rather than maintaining independent links.

**Context:** The Qualys RSA Conference engagement had a classifier-generated entity_link to RSA Conference 2026 (visible in Roadrunner UI under CONNECTIONS) but no way to push that to Airtable because no Event field existed on Partner Engagements. Meanwhile, meetings independently maintained their own partner_id, event_id, and program_id — duplicating what the engagement already knows. This created architectural ambiguity: is the meeting or the engagement the source of truth for connections?

**Rationale:** An engagement is a story; messages and meetings are chapters. Chapters belong to books — you don't put metadata on both independently. Making the engagement the definitive hub eliminates duplicate linking, simplifies push logic, and ensures Airtable reflects the full picture. Phase A wires event links. Phase B (future) will make engagement_id required on meetings. Phase C (future) will derive meeting AT links from the engagement.

**Impact:** Created Event linked record field on AT Partner Engagements (fldscmkRoT65oa6Oy). Push logic resolves entity_links to populate event connections. Every engagement with a classifier-detected event relationship will now show that link in Airtable.

---

## 2026-03-01: Meeting Simplification (Phase B+C — Engagement-Centric Meetings)

**Decision:** Meetings inherit all entity connections from their parent engagement. Meeting push to Airtable only includes meeting-specific data (title, date, time, location, status, attendees, source) plus the engagement link. Partner, Program, Event, and AWS Relationships are displayed in AT via lookup fields from the Engagement link.

**Context:** The Meetings AT table had 18 fields including 4 direct linked record fields (Partner, Program, Event, AWS Relationships) that duplicated what the engagement already knew. The push logic independently resolved all 4 FKs plus a junction table — 5 separate resolution paths for data that should flow from one source. With meetings table empty (0 rows), this was a clean-slate opportunity.

**Rationale:** A meeting is a chapter in an engagement's story. It doesn't independently know which partner or program it's about — the engagement does. Meeting-specific data is: when, where, who attended (a subset of the engagement's participants), and what was discussed. Everything else is inherited. AT lookup fields provide the same grid readability without data duplication or sync complexity.

**Impact:**
- Removed 4 AT linked record fields from Meetings, replaced with 3 lookup fields (Partner, Program, Event from Engagement)
- Removed MF.partner, MF.program, MF.event, MF.awsRelationships from field-maps.ts
- Simplified buildMeetingFields() — no more independent FK resolution for partner/event/program/awsRelationships
- Added engagement gate — meetings without an engagement don't push to AT (prevents ICS temporal gap from creating orphans)
- meeting_aws_relationships junction table no longer used by push (retained in schema for now)

---

## 2026-03-01: Consistent Stakeholder Naming + Three-Bucket Attendee Split

**Decision:** Standardize attendee/stakeholder field naming across Engagements and Meetings tables. Both use: AWS Stakeholders, Partner Stakeholders, Third Parties. Meeting attendee splitting uses three buckets.

**Context:** Engagements used "AWS Stakeholders / Partner Stakeholders / Third Parties" while Meetings used "AWS Contact(s) / Partner Contact(s)" with no third-party field. Meetings are a subset of the same participant pool — naming and bucketing should match. Third parties (analysts, consultants, other vendors) were previously dropped during meeting attendee classification.

**Impact:** Renamed 2 AT fields on Meetings, created Third Parties field (fldhU8nE7uGE1agML). Updated field-maps.ts constants (MF.awsContacts → MF.awsStakeholders, MF.partnerContacts → MF.partnerStakeholders, added MF.thirdParties). Three-bucket splitting ensures no attendees are silently dropped. Verified linkMeetingToEngagement already triggers awaited AT push.

---

## 2026-03-01: Meetings as Timeline Events (Architectural Principle)

**Decision:** Meetings and email messages are both timeline events within an engagement. They follow the same conceptual flow: inbound signal → classify → match or create engagement → engagement is the hub. A standalone meeting without an engagement is architecturally invalid — if a calendar invite can't match an existing engagement, a new engagement should be created, same as an unmatched email thread.

**Context:** The ICS pipeline previously treated meetings as potentially independent entities with their own partner/event/program links. This created architectural ambiguity about whether the meeting or engagement was the source of truth for connections. During Phase B+C simplification, we established that engagements own ALL connections and meetings inherit through the engagement link.

**Rationale:** If every signal (email or calendar) flows through the same classify→engage pipeline, the system has one code path, one mental model, and one source of truth. The Phase 1 prompt can treat ICS content the same as email content — just another signal about partner activity that needs an engagement home. This simplification directly enables the upcoming prompt rewrite.

**Impact:** Guides Phase 1 prompt rewrite (ICS and email use same classification logic). Eliminates the concept of "standalone meetings." engagement_id on meetings is logically required even though the schema still allows NULL for the temporal gap during ICS processing (create meeting → classify → link → push).

---

## 2026-03-01: Phase 1 Prompt Rewrite — Curated-Input Philosophy

**Decision:** Rewrote the Phase 1 system prompt from scratch around curated-input philosophy and a strict 7-step decision framework: (1) forwarder note, (2) participant match, (3) partner match, (4) disambiguation (5 sub-signals), (5) internal/third-party senders, (6) new engagement, (7) flag for review.

**Context:** The original Phase 1 prompt was written before the engagement-hub model solidified. It treated routing as a filtering problem and lacked explicit disambiguation logic for multi-engagement partners. With 3 concurrent Spacelift engagements in production, the prompt needed structured disambiguation — not just "pick the best match."

**Rationale:** PDMs forward intentionally. The classifier routes, it doesn't filter. The 7-step framework gives Claude a deterministic escalation path: try the strongest signal first, fall through to weaker signals, and flag for review only when genuinely ambiguous. This matches how a human would triage the same email.

**Impact:** Replaced PHASE1_SYSTEM_PROMPT in phase1-prompt.ts. No changes to Phase1Result contract, Phase 2, or classifier orchestration. 45 tests pass (up from 34).

---

## 2026-03-01: Engagement Index Enrichment — Participants, Pillar, Entity Links

**Decision:** Enriched the Phase 1 engagement index with participant emails (capped at 8, forwarder excluded, partner domains first), pillar, and linked entity names (programs/events from entity_links table). Engagements grouped by partner in the rendered index.

**Context:** The original engagement index showed only engagement name, partner, and last email subject. Multi-engagement partners (e.g., Spacelift with 3 concurrent engagements) couldn't be disambiguated without participant overlap or entity link signals. Live data queries confirmed participant emails are the strongest disambiguation signal — austinm@spacelift.io appears in IC Marketplace + Solution Spotlight but NOT OpenTofu.

**Rationale:** Participant emails give Claude the same signal a human PDM uses: "who's on this thread?" Partner-domain-first sorting surfaces the most distinctive emails (partner contacts) before the less distinctive ones (internal Amazon). Cap at 8 keeps token count reasonable. Entity links add a secondary signal for program/event-specific emails.

**Impact:** Added getEngagementParticipants() and getEngagementEntityLinks() fetchers in phase1-prompt.ts. Updated buildPhase1Context() with parallel data fetching. Rewrote buildEngagementIndex() with 4-param signature (backward-compatible defaults). No changes to Phase1Result contract or downstream pipeline.

---

## 2026-03-01: Docs Consolidation — Kill PHASE-2-DESIGN.md, Rewrite CLASSIFICATION.md

**Decision:** Deleted docs/PHASE-2-DESIGN.md (653 lines, fatally stale). Rewrote docs/CLASSIFICATION.md as the single authoritative classification pipeline doc. Updated ARCHITECTURE.md and DEVELOPMENT.md with targeted fixes. Created docs/goal-state.md as a living orientation doc.

**Context:** PHASE-2-DESIGN.md still referenced open_items, suggested_tags, Haiku model, and SESSION_LOG.md — all removed months ago. CLASSIFICATION.md was outdated but structurally sound. ARCHITECTURE.md had stale directory trees, wrong migration counts, and old file references. DEVELOPMENT.md had wrong env var names and outdated test counts.

**Rationale:** One stale doc is worse than no doc — it actively misleads. PHASE-2-DESIGN.md had diverged so far from implementation that updating it would be a full rewrite with no value over CLASSIFICATION.md. The goal-state.md gives future sessions a 30-second orientation without reading 7 files.

**Impact:** docs/ now has 7 files (was 8). All docs reflect current implementation: 48 migrations, 414 tests, 14 suites, correct env var names, two-phase pipeline with curated-input philosophy. No code changes.


### Decision 90: Eliminate Single-Engagement Routing Shortcut

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Removed all logic that treated partners with one engagement differently from multi-engagement partners. The number of existing engagements has zero influence on routing.

**Context:** Spacelift Solution Spotlight emails (marketing campaign) were merged into DevOps/OpenTofu Collaboration (technical integration) because Phase 1 Step 3 said "partner has one engagement + content is consistent → route there." This short-circuited before new-engagement detection.

**Rationale:** The count of existing engagements is a database state fact, not a classification signal. A partner having one engagement means you've tracked one initiative — it says nothing about whether the current email belongs to it. Every email must be evaluated by comparing content against engagement context.

**Impact:** Prevents an entire class of wrong-merge bugs. Every email now goes through content evaluation regardless of engagement count.

---

### Decision 91: Enrich Phase 1 Engagement Index with Semantic Context

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Added current_state (truncated to 150 words), topic, and goal fields to each engagement entry in the Phase 1 engagement index.

**Context:** Phase 1 had participant emails, pillar, entity links, and last subject — but no semantic description of what the engagement is actually about. This was insufficient to distinguish engagements with the same partner but different topics.

**Rationale:** The current_state already exists in the DB from Phase 2 analysis. Adding it to Phase 1 context gives the classifier "smarter folder labels" without duplicating Phase 2's deep analysis role. Token cost is minimal (~150 words per engagement).

**Impact:** Phase 1 can now distinguish "Technical collaboration with AWS IaC team on OpenTofu" from "Marketing webinar campaign with Bridge Partners" for the same partner. Directly addresses multi-engagement disambiguation.

---

### Decision 92: Rewrite Decision Framework — Content Evaluation Required

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Replaced 7-step "stop when confident" framework with 6-step framework requiring content evaluation for every routing decision.

**Context:** The old Step 3 short-circuited on partner match alone, bypassing new-engagement detection entirely.

**Rationale:** Ordered "stop when confident" steps are dangerous when early steps use weak signals (partner match). The new framework flows: identify partner → evaluate against ALL engagements → route/new/review. No early exits.

**Impact:** Confidence now reflects actual content match quality. Partner identification alone can never produce high confidence.

---

### Decision 93: Fallback Meeting Detection from Plain Text

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Built two-tier fallback detector for meeting invites that arrive without VCALENDAR data. Tier 1: Outlook "Original Appointment" blocks. Tier 2: Generic When: + Where: patterns. Source type: "body_parsed".

**Context:** Outlook strips ICS when forwarding meeting invites, converting structured calendar data to plain-text blocks. All three existing ICS detection paths (body-calendar, inline body-plain, file attachment) require BEGIN:VCALENDAR. Forwarded meetings were treated as regular emails.

**Rationale:** Can't control how Outlook forwards. The fallback creates real meeting records so the existing pipeline (Phase 1 Meeting Data hint, engagement linking) works without modification. ICS path still takes priority when available.

**Impact:** Meeting invites forwarded from Outlook now get detected and processed. 39 new tests. Requires real-data validation next session.

---

### Decision 94: Apply Unapplied Migration 046

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Run migration 046 against production to add `sequence` (INTEGER) and `is_recurring` (BOOLEAN) columns, drop stale `meeting_type` column, and update status CHECK constraint on meetings table.

**Context:** All meeting creation (ICS and fallback) was silently failing with "Could not find the 'is_recurring' column" error. Migration existed in codebase since session ~March 1 but was never applied to production Supabase.

**Rationale:** The code, types, tests, and schema_live.sql all depended on these columns. Applying the migration was the correct fix vs stripping columns from code (which would touch ICS parser, meeting creation, types, and UI).

**Impact:** Immediately unblocked all meeting creation. Three meetings created and visible within minutes of applying.

---

### Decision 95: Decouple Meeting Linking from content_type

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Remove the `content_type === "meeting_invite"` gate from meeting-to-engagement linking in `classifier.ts` (auto-assign path) and `reviews/resolve/route.ts` (confirm + assign_existing paths). Link meetings unconditionally when a meeting record exists for a classified message.

**Context:** The gate caused meetings to stay orphaned (no `engagement_id`) whenever Claude classified the message as `"engagement_email"` or `"mixed"` instead of `"meeting_invite"`. Only 1 of 3 test meetings got linked because the other two had different content_type labels.

**Rationale:** Whether a meeting record exists is a hard fact (ICS was parsed), not something Claude should have veto power over. `content_type` remains as informational metadata for display/analytics, not as a gate for data linking.

**Impact:** Eliminates entire class of orphaned meeting bugs. Every meeting with a `message_id` will be linked to its classified engagement.

---

### Decision 96: Meetings Inherit Partner from Engagement

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** `linkMeetingToEngagement()` now queries the engagement's `partner_id` and `partner_name` and sets both on the meeting record, overriding any attendee-based partner matching from initial creation.

**Context:** Meetings were showing "Partner: —" on the detail page because `createMeetingFromICS()` couldn't match a partner from attendee domains (e.g., when only Amazon emails were on the invite). But the engagement already knew its partner.

**Rationale:** Engagement-hub architecture — the engagement is the single authority for partner, program, event, and relationship connections. Meetings are timeline events within engagements and inherit through that connection.

**Impact:** Meeting detail pages now show correct partner and engagement links without requiring partner email addresses in the ICS attendee list.

---

### Decision 97: Remove Fallback Meeting Detector

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Delete `meeting-detector.ts`, its test suite, `createMeetingFromFallback()`, and all calling code. ICS parsing is the sole meeting detection path.

**Context:** The fallback detector (Tier 1 Outlook Original Appointment, Tier 2 generic When/Where) was built from diagnostic analysis of what Outlook "probably" delivers, never validated against real data. It also risked false positives on emails that mention dates/times/locations without being meeting invites.

**Rationale:** With migration 046 applied, ICS parsing works correctly for both direct participant and forwarded invites. If ICS data arrives, we detect it. If it doesn't (e.g., Outlook strips it during forwarding), the email is classified normally. We don't guess.

**Impact:** Removed ~200 lines of code + 39 tests. Simplified inbound route. Test count: 427 across 14 suites (down from 466/15, net cleaner).

---

### Decision 98: Create-Then-Link Pattern for Meetings Is Correct

**Date:** 2026-03-02
**Status:** Documented (no code change)

**Decision:** Maintain the current order: ICS meeting creation (step 9) before classification (step 11). The brief UI window where a meeting appears without an engagement link is accepted as a timing artifact.

**Context:** During testing, a meeting briefly appeared unlinked on the UI before classification completed and set the `engagement_id` (~20s later due to Claude API call). Initially appeared to be a bug.

**Rationale:** Creating the meeting first is safer — if classification fails, the structured calendar data is preserved. The alternative (hold creation until after classification) risks data loss. The 20-second classification window is invisible in normal usage since users don't watch the UI in real-time during email forwarding.

**Impact:** No code change needed. Documented as intentional design to prevent re-investigation in future sessions.

---

### Decision 99: Complete Meeting Entity Inheritance Through Engagement

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Remove `program_id`, `event_id` columns and `meeting_aws_relationships` junction table from meetings. All entity relationships inherit exclusively through the parent engagement.

**Context:** Meetings table carried redundant FK columns for program and event, plus a junction table for AWS relationships. None were ever populated by the automated pipeline (ICS parser, classifier, Phase 2). Airtable already used lookup fields through the Engagement link for all of these.

**Rationale:** Engagement-hub model proved itself with partner inheritance (Decision #96). Extending it to all entities eliminates data inconsistency (meeting pointing to Program X while engagement points to Program Y), simplifies the meeting pipeline (no independent entity resolution), and matches Airtable's existing architecture.

**Impact:** Migration 050 created and applied. 18 files modified. Dead code removed from DB layer (5 functions), API routes, UI pages, types, and tests. 13 tables (down from 14). 427 tests maintained.

---

### Decision 100: Phase 2 Structural Improvements + Phase 1 Tightening

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Five interconnected changes to the classification pipeline: (1) Expose existing participants and entity links to Phase 2, (2) Restructure current_state instructions as decision matrix, (3) Implement 3-tier program catalog rendering with event time filtering, (4) Add `_reasoning` self-audit to entity matching, (5) Split Phase 1 Topic/Context evaluation and add negative constraints on new engagement path.

**Context:** Phase 2 was blind to its own structured state (couldn't see existing participants or entity links). current_state instructions were prose rules requiring simultaneous constraint juggling. Full catalog (65 programs, 43 events) sent to every classification. Phase 1 had a "new engagement" escape hatch with no negative constraints.

**Rationale:** Make it structurally harder for the model to be wrong, rather than asking it more persuasively to be right. Phase 2 quality feeds Phase 1 accuracy through the current_state flywheel. Each change reduces a specific failure mode: blind evolution, constraint overload, false match surface, unjustified matches, and escape hatch routing.

**Impact:** 9 files modified across two implementation commands. classifier.ts now fetches and passes existing state. Phase 2 prompt uses decision matrix. prompt-builder.ts renders 3 program tiers (42 competencies + 6 service ready compressed, ~24 detailed). Events filtered to 7-month window. Phase 1 has 7 evaluation criteria (up from 6) and explicit "NOT a new engagement" examples. 427 tests maintained.

---

### Decision 100a: Participants Are Add-Only in Phase 2

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Phase 2 can add new participants but never remove existing ones.

**Context:** Needed to decide whether Phase 2 should have full CRUD over participants or just append.

**Rationale:** Once someone is linked, they were linked for a reason. AI removing participants risks pruning legitimate contacts. Manual removal remains available for corrections.

**Impact:** Phase 2 prompt instructs "only extract NEW people not in the existing list."

---

### Decision 100b: Entity Match _reasoning Preserved in JSONB, Not Stripped

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** The `_reasoning` self-audit field is not stripped from `parsePhase2Response`. It flows through as extra untyped JSON.

**Context:** Needed to decide where to strip the debugging field. Options: strip in parser, strip in persistence, or don't strip.

**Rationale:** TypeScript interfaces act as natural filters — downstream code only accesses typed fields. Keeping `_reasoning` in the JSONB provides free debugging data. No type changes or parser changes needed.

**Impact:** `classification_result` JSONB in `approval_queue` and `messages` contains entity match justifications for debugging.

---

### Decision 100c: Program Catalog Rendered in 3 Tiers

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Competencies (42) and Service Ready (6) rendered as compact lists with shared headers. Structurally unique programs (~24) retain full detail.

**Context:** All competencies follow identical lifecycle, MDF, requirements, and renewal patterns. Only the subject domain differs. Sending 42 near-identical entries with full boilerplate created false match noise.

**Rationale:** Reduce false match surface. Model can match any competency by name + ID without wading through 42 copies of identical boilerplate. Token savings are secondary to accuracy improvement.

**Impact:** `buildProgramsSection` in `prompt-builder.ts` now filters by program type and renders accordingly.

---

### Decision 100d: Events Filtered to 7-Month Window

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Phase 2 only receives events within past 30 days through future 6 months (plus events with no date set).

**Context:** 43 events in catalog, most are international AWS Summits unlikely to appear in partner emails. Stale events are noise.

**Rationale:** Every irrelevant event is a potential false match. Time filtering removes the vast majority of noise while preserving any event that could plausibly be referenced.

**Impact:** Event filtering applied in `buildPhase2Context` before calling `buildEventsSection`.

---

## 2026-03-07 — Meeting Notes Feature

### Decision 101: Meeting Notes Module Lives Inside Roadrunner

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** Notes feature built as new tables/routes/pages within the existing Roadrunner codebase, not a separate application.

**Context:** Steven needed meeting note-taking ASAP and considered a separate lightweight app. Evaluated shared infrastructure needs (Supabase, Airtable sync, Claude API, UI shell, partner catalog).

**Rationale:** Both systems need the same data (partners, engagements, contacts), same infra (Supabase, Vercel, Claude API), and same UI patterns. Separate app = re-wire all plumbing for zero benefit. "Slightly decoupled" means new tables + routes, not new deployment.

**Impact:** New tables (meeting_notes, note_tasks), 7 new API route files, 8 new page/component files — all within existing project structure.

---

### Decision 102: Partner Context Sourced from Local Supabase, Not Airtable MCP

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `buildPartnerContext()` reads exclusively from local Supabase tables. Airtable MCP is never called during note-taking or summarization.

**Context:** Steven raised concern about MCP reliability. Evaluated whether context should pull fresh from Airtable vs use synced local data.

**Rationale:** Roadrunner already syncs Airtable catalog data into Supabase (partners, programs, events, relationships). Local queries are ~50ms, always available, no MCP dependency. Catalog freshness depends on periodic sync, which is acceptable.

**Impact:** Note-taking is fast and reliable. Trade-off: context is only as fresh as last catalog sync. Running `POST /api/sync` before a notes session ensures currency.

---

### Decision 103: Two Note Types — Meeting and Seed

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `meeting_notes` table supports `note_type` 'meeting' (regular) and 'seed' (historical context dump). Same table, same AI pipeline, different prompt strategies.

**Context:** Steven has 12+ months of OneNote notes per partner that need to be ingested before taking new notes. Needed a way to bootstrap partner context.

**Rationale:** A seed is structurally identical to a meeting note — it has raw_notes, gets AI-summarized, produces tasks and flags. Only the prompt changes (chronological narrative vs single meeting summary). Separate tables would duplicate everything for no benefit.

**Impact:** Seed notes become foundational context. `getRecentNoteSummaries()` returns seeds first, then meeting notes by date — so Claude always has the historical base when summarizing new meetings.

---

### Decision 104: Three-Phase Note Workflow

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `/notes/new` is a single-page state machine with three phases: Setup (partner selection + context load), Note-taking (textarea + auto-save + context sidebar), Review (AI summary edit + task management + flags).

**Context:** Needed a flow that works during live calls — fast to start, unobtrusive during note-taking, structured review after.

**Rationale:** No page reloads between phases keeps the experience fluid. Draft is created at Phase 1→2 transition so auto-save has an ID immediately. Phase 3 is optional — user can save as draft and summarize later.

**Impact:** 4 sub-components (NoteWorkspace, ContextSidebar, PreviousNotes, TaskEditor) manage the phases. Auto-save interval set up in Phase 2, cleaned up on unmount.

---

### Decision 105: Context Snapshot at Summarization Time

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `context_snapshot` JSONB field stores the full PartnerContext object that was fed to Claude when summarization ran.

**Context:** Partner data changes over time. Need to know what Claude knew when it produced a specific summary.

**Rationale:** Without snapshots, you can't audit AI decisions retroactively. With snapshots, you can always compare "what did Claude see?" vs "what's true now?" — critical for the eventual slot registry feature.

**Impact:** Adds ~2-5KB per note. Stored as untyped JSONB (same pattern as `classification_result` on messages).

---

### Decision 106: Tasks as First-Class Entities with Owner Classification

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `note_tasks` table with owner enum ('me', 'partner', 'aws_internal'), separate from `meeting_notes`. CASCADE delete on parent note.

**Context:** Steven needs to track what he owes vs what partners owe vs what AWS internal teams owe. Currently tracks this mentally or in scattered OneNote lists.

**Rationale:** Separate table enables cross-partner task queries (`getOpenTasks`, `getTasksByPartner`) without parsing JSONB. Owner classification enables the "what do I owe?" and "what am I waiting on?" views. `source` field distinguishes fresh tasks from seed-extracted historical ones.

**Impact:** `/api/notes/tasks` endpoint provides cross-cutting task view. Foundation for future task dashboard and Airtable push.

---

### Decision 107: AI Gap Detection via Typed Flags

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `ai_flags` JSONB with typed flags: 'gap' (missing/contradictory data), 'intel' (partner intelligence), 'question' (ambiguous items), 'followup' (next meeting items).

**Context:** Steven described wanting the AI to notice when notes mention something that's missing from Airtable (e.g., "they use Tackle" but CRM Status field is empty).

**Rationale:** Structured flag types enable future automation — gaps can trigger Airtable update prompts, intel can auto-populate partner fields, followups can seed next meeting agendas. For MVP, flags are displayed as colored cards in the review phase.

**Impact:** Foundation for the "slot registry" vision. AI compares notes against partner context and surfaces discrepancies proactively.

---

### Decision 108: Auto-Save with 30-Second Interval

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** Draft created on "Start Taking Notes" click. Raw notes auto-saved via PUT every 30 seconds and on browser tab switch (`visibilitychange` event). Subtle save indicator.

**Context:** Notes are taken during live calls. Browser crash or accidental tab close would lose everything without auto-save.

**Rationale:** 30 seconds balances data safety vs API load. Saving on visibility change catches the "laptop lid close" and "switch to screen share" scenarios. Creating the draft first (POST) gives us an ID for all subsequent PUTs.

**Impact:** Notes are never more than 30 seconds stale. No explicit "save" action needed during note-taking.

---

## 2026-03-07 — Partner Profile Enrichment

### Decision 109: Partner Profile Enrichment for AI Context

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** Added 7 fields to Supabase partners table (architecture, listing_types, pricing_model, isva_status, deployed_on_aws, prm_status, crm_status) synced from Airtable, exposed in AI meeting notes prompts, context sidebar, and partner detail page UI.

**Context:** The AI summarizer had a significant context gap — it knew partner name/segment/what they do, but not deployment model, listing types, pricing, or program statuses. These fields are critical for intelligent gap detection (e.g., "notes mention a new SaaS listing but current Listing Types only shows AMI").

**Rationale:** All 7 fields already existed in Airtable with rich data for all 21 partners. Adding them to the sync layer (field-maps.ts + pull.ts), context builder (notes-context.ts), and partner detail page was a focused additive change. No new tables, no new routes — just enriching existing data flow. Multi-select fields (listing_types, pricing_model) use TEXT[] arrays matching the existing focus_area pattern.

**Impact:** Migration 052, sync field-maps updated (7 new Airtable field ID mappings), context builder enriched (formatContextForPrompt includes architecture/listings/pricing/statuses), partner detail page enhanced (new "Partner Profile" card with colored badges), notes context sidebar updated. Every AI summarization call now sees the full partner operating model.

---

## 2026-03-08 — Meeting Notes Summarizer Redesign

### Decision 110: Unified Summarizer Prompt

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced two separate prompts (MEETING_SYSTEM_PROMPT, SEED_SYSTEM_PROMPT) with one unified SYSTEM_PROMPT + NOTE_TYPE_MODIFIER object.

**Context:** Two prompts with different section structures created maintenance burden and artificial divergence. Seed vs meeting is only a temporal scope difference.

**Rationale:** One prompt is easier to tune, test, and evolve. Note type modifier is a 2-line inline string replacement (<<NOTE_TYPE>>), not a separate code path.

**Impact:** Single prompt in notes-summarizer.ts. All future prompt improvements apply to both note types automatically.

---

### Decision 111: Kill AI Flags, Flat Prose Summaries

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Removed 4-category AI flags (gap/intel/question/followup) from prompt output and detail page UI. Summary format changed from rigid markdown sections to concise flat prose with optional bullet points for 3+ item lists.

**Context:** AI flags were generating speculation ("Appgate making significant investment with re:Invent sponsorship — indicates strong commitment"). Summary sections (## Key Discussion Points, ## Decisions Made, ## Updates/Status Changes) forced arbitrary categorization.

**Rationale:** The AI's job is to extract and organize, not analyze. Future intelligence comes from controlled slot registry with defined partner requirements, not open-ended speculation. Summaries should read like a quick Slack recap, not a report.

**Impact:** flags field in NoteSummaryResult always returns []. ai_flags JSONB column preserved in DB for backward compatibility but no longer populated. AI Flags section removed from note detail page.

---

### Decision 112: Task Extraction with 4-Step Contact Matching

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** AI resolves mentioned names against known contacts list using 4-step priority: (1) Match to known partner contacts → owner: "partner", (2) PDM self-reference → owner: "me", (3) Unknown name → capture name, classify from context, (4) No owner identifiable → default to "me".

**Context:** Previous prompt said "owner_name: specific person name if mentioned, null otherwise" with no instruction to match against known contacts.

**Rationale:** Named, role-aware task ownership is the foundation for cross-partner task visibility and accountability tracking.

**Impact:** Tasks now have accurate owner_name matched to known contacts (e.g., "Jackie" → "Jackie Funk", Alliance Lead).

---

### Decision 113: Task Done-State Gate with Examples

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Added strict guardrail: "Before creating each task, apply this test: Could someone check this off as DONE in a single action or short effort? If not, it's a goal — do not create a task." Includes 4 negative examples (goals) and 4 positive examples (tasks). Bias: "When in doubt, do NOT create the task."

**Context:** AI was generating vague goals as tasks ("Ramp up marketplace presence", "Help partner target FSI accounts", "Identify which competencies to pursue").

**Rationale:** Polluted task lists erode trust faster than missing tasks. Users can manually add tasks; they can't easily filter AI noise. Eventually partner plans and slot registry will track strategic goals separately.

**Impact:** KnowBe4 seed went from 4 vague tasks to 1 real task. Dramatically cleaner task extraction.

---

### Decision 114: Task Materialization on Summarize

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** AI-extracted tasks become real note_tasks rows immediately when summarization completes, not deferred to finalization.

**Context:** Previous flow saved ai_tasks as JSONB blob on meeting_notes record but never created note_tasks rows. Detail page queried note_tasks, found none, showed "No tasks yet" even with AI-extracted tasks.

**Rationale:** Decision #106 established tasks as first-class entities. Deferring materialization contradicted this — tasks existed only as unstructured JSON.

**Impact:** Tasks visible on detail page immediately after Summarize. Re-summarization deletes only origin='ai' tasks, preserving manual tasks.

---

### Decision 115: Origin Column for Task Provenance

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Added origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('ai', 'manual')) to note_tasks table (Migration 053).

**Context:** Needed to distinguish AI-generated tasks from manually-added tasks to enable safe re-summarization (delete AI tasks without losing manual ones).

**Rationale:** Considered alternatives: (a) delete all tasks on re-summarize (loses manual), (b) only re-create if no manual tasks (fragile). Origin column is cleanest — explicit provenance, no ambiguity.

**Impact:** Migration 053 applied. createNoteTask() accepts optional origin parameter. deleteAiTasksForNote() function added for targeted cleanup.

---

### Decision 116: Status Model Simplified to Draft/Complete

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced 3-state model (draft/summarized/finalized) with 2-state (draft/complete). Migration 054 converts existing rows.

**Context:** "Summarized" vs "finalized" distinction had no practical value — what would you do with a note that's summarized but not finalized?

**Rationale:** The act of reviewing and saving IS the finalization. Simpler mental model, fewer UI elements (removed status dropdown from detail page), cleaner filters on list page.

**Impact:** Migration 054 applied. 8 files updated. DB constraint now CHECK (status IN ('draft', 'complete')).

---

### Decision 117: Review Flow — Stacked Layout, No Tabs

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced 3-tab review phase (Raw Notes / Summary / Tasks) with stacked layout showing all content at once. Raw notes collapsible at top, summary always visible, tasks always visible below.

**Context:** Tasks were hidden behind a tab click — users couldn't see summary and tasks simultaneously to approve both.

**Rationale:** The review phase exists so the user can verify AI output before saving. Hiding tasks behind a tab defeats this purpose. One view, one approval, one Save button.

**Impact:** NoteWorkspace.tsx rewritten. ReviewTab type eliminated. "Finalize & Save" simplified to "Save".

---

### Decision 118: Task Form with Contact Quick-Pick

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Manual task add form now includes owner_name field with quick-pick buttons from known partner contacts. Partner-side contacts shown when "Partner" selected, AWS-side contacts shown when "AWS Internal" selected.

**Context:** The add form only had owner category dropdown (me/partner/aws_internal) with no way to specify the person. API already accepted owner_name end-to-end.

**Rationale:** When AI misses a task, manual add is the safety net. It needs to be fast and accurate — selecting a known contact should be two clicks, not typing from memory.

**Impact:** TaskEditor.tsx updated with contacts prop, extractName() helper, quick-pick pills. NoteWorkspace passes context.contacts through.

---

### Decision 119: PDM-Grounded Task Extraction + Deadline Rule

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced generic task examples with real PDM work patterns (co-sell deliverables, Salesforce updates, portal completions, signature requests, event prep). Added explicit deadline rule: any mention of a date triggers task extraction with due_date.

**Context:** AI missed "complete partner migration portal before July 31" because it treated a deadline-bearing commitment as context. Generic examples ("Send training deck") didn't cover the breadth of PDM work.

**Rationale:** LLMs pattern-match against examples. PDM-specific examples (swap contacts in Salesforce, review briefings, submit architecture diagrams) teach the model what real tasks look like in this domain.

**Impact:** notes-summarizer.ts prompt updated. 6 positive examples, 4 negative examples, all grounded in PDM workflow.

---

### Decision 120: Entity Model as Single Source of Truth

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Created unified `docs/entity-model.md` replacing DATA-MODEL.md and FIELD-MAPPING.md. Two layers: Mermaid ERD (all 15 Supabase tables + 5 Airtable-only tables) and field-level registry with sync directions, AT field IDs, ownership badges, and UI locations.

**Context:** DATA-MODEL.md (13 tables, last updated 2026-03-02) and FIELD-MAPPING.md (field IDs only, no schema context) were diverging. Neither covered Airtable-only tables, planned connections, or the full field-level picture.

**Rationale:** One document that answers "what exists, who owns it, where does it sync, and what's planned" eliminates cross-referencing. The ERD shows relationships at a glance; the registry provides field-level precision for implementation.

**Impact:** entity-model.md is 712 lines covering all tables, all AT field IDs, sync directions, and a planned connections roadmap. DATA-MODEL.md and FIELD-MAPPING.md deprecated with pointer to replacement.

---

### Decision 121: Sync Alignment Governing Principle

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Every field on a synced table either syncs now, syncs later (documented), or gets deleted. No permanent partial sync. Tables are binary: fully synced or not yet started.

**Context:** Audit revealed engagement_type, partner_name, and ai_flags columns that existed in Supabase but had no Airtable counterpart and no sync implementation. They were dead weight masquerading as schema.

**Rationale:** Partial sync creates false confidence — developers assume a field is tracked when it isn't. The entity model registry makes sync gaps visible. If a field doesn't sync and isn't planned to, it shouldn't exist on a synced table.

**Impact:** Migration 055 drops 4 dead columns. Entity model documents every field's sync status. Future additions must declare sync intent at creation time.

---

### Decision 122: Engagement Status Expanded to 5 States

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Engagement status now supports 5 values: planned, active, blocked, completed, archived. All map bidirectionally to Airtable single-select options. STATUS_TO_AIRTABLE updated to include blocked→"Blocked" and completed→"Completed".

**Context:** STATUS_TO_AIRTABLE only mapped active→"Active" and archived→"Archived". Engagements with status "blocked" or "completed" silently fell through to the default ("Active") during Airtable push, losing status fidelity.

**Rationale:** Status is a core field for PDM workflow. If Airtable supports 5 statuses and Supabase supports 5 statuses, the sync layer must map all 5, not just 2.

**Impact:** Migration 055 adds 'planned' to CHECK constraint. sync/utils.ts STATUS_TO_AIRTABLE maps all 5 states. Airtable now accurately reflects engagement lifecycle.

---

### Decision 123: Drop engagement_type

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Removed `engagement_type` column from engagements table and TypeScript types. Pillar (Co-Sell/Co-Market/Co-Build) is the categorical axis, topic+goal are the specifics.

**Context:** engagement_type was added speculatively in migration 039 ("taxonomy TBD from real data patterns"). After 5 active engagements and months of use, it was never populated, never synced to Airtable, and never displayed in UI.

**Rationale:** Meetings have types (event format: intro call, QBR, demo, etc.). Engagements don't — they're categorized by pillar and described by topic+goal. Adding a type taxonomy would duplicate pillar's function or create a confusing second dimension.

**Impact:** Migration 055 drops column. Removed from Engagement type in types.ts. No code references existed (field was always null).

---

### Decision 124: Drop partner_name Legacy Columns

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Removed `partner_name` column from both engagements and meetings tables. All partner resolution now flows through `partner_id` FK → partners table. DB query functions return computed `partner_name` via batch FK lookup.

**Context:** partner_name was a denormalized text column written at creation time. The Airtable push layer used a name-text-to-AT-record-ID map to resolve partner links — fragile and case-sensitive.

**Rationale:** FK-based lookup is reliable, case-insensitive, and doesn't go stale when partner names change. The computed field pattern (`& { partner_name: string | null }` on return types) preserves downstream convenience without schema denormalization.

**Impact:** Migration 055 drops columns. push.ts refactored from `partnerNameToId` map to `partnerDbToAtId` map. 31 files updated across DB, sync, API, UI, and tests.

---

### Decision 125: Meeting Type Added to Supabase

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Added `meeting_type` column to meetings table with 9-option CHECK constraint matching Airtable exactly: intro_call, follow_up, qbr, demo, workshop, executive_briefing, partner_day, event_meeting, other.

**Context:** Meeting type existed in Airtable (fldGWa1MFoqoc89qC) but had no Supabase counterpart. Meetings couldn't be categorized in Roadrunner.

**Rationale:** Meeting categorization enables filtering, reporting, and AI context. The 9 options cover the PDM meeting taxonomy observed in real data.

**Impact:** Migration 055 adds column. Meeting type syncs to AT when not null. Meeting type added to Meeting TypeScript interface.

---

### Decision 126: Topic + Goal Pushed to Airtable

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Engagement topic and goal fields now push to Airtable via new fields (topic: fldDRMrtkVHOdDYVy, goal: fld1yU46baF052MHd).

**Context:** Topic and goal were extracted by Phase 2 classification and stored in Supabase since decision 107, but never synced to Airtable. PDMs couldn't see AI-generated context in their Airtable views.

**Rationale:** Topic and goal are the most concise summary of what an engagement is about. Making them visible in Airtable closes the information gap between the two systems.

**Impact:** field-maps.ts ENF updated. buildEngagementFields in push.ts includes topic and goal. AT fields created and mapped.

---

### Decision 127: Meeting Notes Pushed to Airtable

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Meeting `notes` field now syncs to Airtable Notes field (fldzGUipu36EA9rax). Organizer, sequence, and is_recurring remain RR-internal (ICS parsing plumbing, not user-facing data).

**Context:** Meetings had a notes column in Supabase but no AT sync. Other ICS-derived fields (organizer_name, sequence, is_recurring) also lacked sync — intentionally, as they're parsing metadata.

**Rationale:** Notes are user-facing content that should be visible in both systems. ICS metadata (who organized, sequence number, recurrence flag) is internal plumbing that Airtable doesn't need.

**Impact:** field-maps.ts MF updated. buildMeetingFields in push.ts includes notes when present.

---

### Decision 128: Dead Column Cleanup — ai_flags

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Dropped `ai_flags` column from meeting_notes table and removed `flags` array from `NoteSummaryResult` TypeScript type.

**Context:** ai_flags was added early in notes development for AI-generated warning flags. Decision 115 (unified AI summarizer) switched to flat prose format. The flags array was hardcoded to `[]` in the summarizer — dead code.

**Rationale:** A column that's always null and a type field that's always `[]` are noise. They mislead developers into thinking flag functionality exists.

**Impact:** Migration 055 drops column. NoteSummaryResult simplified. notes-summarizer.ts cleaned up. Route handlers no longer pass ai_flags.

---

### Decision 129: Airtable Dead Text Fields Deleted

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Deleted 4 singleLineText pseudo-link fields from Airtable: "Partner Meetings" on Partners table, "Meetings" on Programs/Events/AWS Relationships tables.

**Context:** These were plain text fields manually maintained in Airtable, predating the Roadrunner engagement-hub architecture. Real meeting connections flow through the Engagement hub: Meeting → Engagement → Partner/Program/Event/Relationship.

**Rationale:** Text fields that pretend to be links create maintenance burden and confusion. The engagement-hub architecture makes them redundant — Airtable lookup fields through the Engagement link provide the real connections.

**Impact:** No Supabase changes needed (fields were AT-only). AT base cleaned up. entity-model.md documents the real lookup field paths.

---

### Decision 130: Third Parties Handled by Participant System

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Third-party stakeholders (consultants, integrators, ISVs) are tracked via the participant system (participants + participant_links with role="third_party") and rendered to Airtable display fields at sync time. No dedicated Supabase column needed.

**Context:** Airtable has "Third Parties" multilineText fields on both Engagements and Meetings. The question was whether to add a third_parties column to Supabase.

**Rationale:** The participant system already captures third-party contacts with role attribution. Adding a denormalized text column would duplicate data and diverge from the engagement-hub principle. The sync layer computes the AT display text from participant_links at push time.

**Impact:** No schema change. entity-model.md documents the AT computed fields and their participant system source.

---

### Decision 131: Three-Tier Navigation — Pulse → Portfolio → Reference

**Date:** 2026-03-11
**Status:** Implemented (sidebar), design ongoing (full vision)

**Decision:** UI organized by workflow tiers, not data types. Tier 1 (Pulse + Inbox) = what needs attention. Tier 2 (Partners + Engagements) = core portfolio. Tier 3 (Events + Programs + Relationships) = reference catalogs. Meetings and Notes accessed through Partners/Pulse, not as standalone top-level pages (temporarily kept in sidebar during transition).

**Context:** Flat 8-item sidebar gave equal weight to all pages. PDMs think in terms of "what do I need to do" not "which data type do I want to browse."

**Rationale:** Mirrors how the data actually works — Partners and Engagements are the primary working views, everything else is context.

**Impact:** Sidebar restructured into 4 tiers with visual weight hierarchy. Home page becomes Pulse. Meetings/Notes will eventually move out of top-level nav into partner context.

---

### Decision 132: Data Rings Model — Catalog → Activity → Strategy

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** System data organized into three concentric rings. Ring 1 (Catalog): Partners, Programs, Events, AWS Relationships — AT-owned, pulled into RR, slow-changing. Ring 2 (Activity): Engagements, Meetings, Messages, Notes, Tasks, Participants — RR-owned, pushed to AT, fast-changing. Ring 3 (Strategy): Partner Programs, Partner Events, Partner Plans, Funding — AT-only today, future sync. Engagement is the connective tissue between all rings.

**Context:** Needed a mental model for how all 26 tables relate, which system owns what, and how data flows.

**Rationale:** Clear ownership prevents sync conflicts. Ring model makes it obvious where new features slot in.

**Impact:** Governs all future schema decisions, sync direction choices, and UI information architecture.

---

### Decision 133: Roadrunner Is Standalone Authority; Airtable Is Secondary

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Roadrunner must function independently. All UI reads from Supabase, never live Airtable calls. Over time, sync direction flips table-by-table (AT-owned becomes RR-owned, AT becomes read-only mirror). UI designed as if Roadrunner is the only system.

**Context:** Building for potential internal AWS adoption where Airtable wouldn't exist. Airtable is Steven's workshop/seed tool, not a runtime dependency.

**Rationale:** If any feature requires Airtable at runtime, it can't scale beyond one user. Supabase-only runtime is the only portable path.

**Impact:** No UI components make live AT calls. Catalog data must be fully synced to Supabase before features can use it. AT-only tables (Ring 3) need pull sync before Roadrunner can display them.

---

### Decision 134: Notes Require Meetings

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Every meeting note must be attached to a meeting record. No standalone notes allowed. This means meeting creation must be frictionless, including support for recurring cadences.

**Context:** Debated whether notes could exist independently. Concluded that untethered notes become a dumping ground and lose temporal context.

**Rationale:** Tying notes to meetings creates a natural chronological record, ensures the activity timeline works, and enforces a structured capture workflow. The constraint is actually liberating — it forces us to solve meeting creation friction.

**Impact:** Note creation flow changes from "pick a partner" to "pick a meeting." Need manual meeting creation for calls without ICS. Seed notes need rethinking (they were standalone by design).

---

### Decision 135: Meeting Type and Recurrence Are Independent Dimensions

**Date:** 2026-03-11
**Status:** Implemented (schema)

**Decision:** Meeting type = purpose (Partner Cadence Call, QBR, SCA Review, Executive Meeting, etc. — 9 types in DB CHECK). Recurring = boolean flag indicating the meeting is part of a repeating pattern. These combine but don't depend on each other.

**Context:** Confusion about whether QBRs and Partner Cadences were different "recurring paths." Clarified they're different types that both happen to recur.

**Rationale:** Separating purpose from pattern means the type taxonomy can grow independently of recurrence infrastructure.

**Impact:** meeting_type is manual selection from 9 options. is_recurring is a boolean. No series linking yet.

---

### Decision 136: Recurring Meeting Series Deferred; Boolean + Type Is the Bones

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Full series engine (meeting_series table, RRULE parsing, auto-occurrence generation) deferred to future session. Current state: each meeting is standalone, is_recurring boolean flag exists, meeting_type set manually.

**Context:** Recurring ICS invites send ONE invite with RRULE — Roadrunner gets one email, creates one meeting. System has no concept of "next week's occurrence." Full series support is significant build.

**Rationale:** Pulse page, partner convergence, and activity timeline all work with single-meeting model. Series adds automation but isn't prerequisite.

**Impact:** Schema ready for series_id FK when built. Recurring cadences work manually for now (each occurrence forwarded or created separately).

---

### Decision 137: Three Meeting Origin Paths

**Date:** 2026-03-11
**Status:** Design decided

**Decision:** Meetings enter Roadrunner via three paths: (1) ICS forwarding — primary, existing. (2) Cadence registration — future, "register a recurring pattern" that auto-generates occurrences. (3) Manual quick-capture — for calls without ICS (hallway chats, spontaneous calls).

**Context:** Old "Create Meeting" button was removed as too clunky. But notes-require-meetings means we need a way to create meetings for unplanned conversations.

**Rationale:** Different meeting origins have different UX needs. ICS is automated. Cadence is a one-time setup. Manual is a lightweight "I just had a call" capture.

**Impact:** Manual meeting creation needs to return to UI (lightweight, not the old full form). Cadence registration is a future feature.

---

### Decision 138: Contacts as Resolved Catalog Entity

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Participants table becomes the single contact registry for all humans in the system. partner_contacts JSONB, aws_team JSONB, and meeting attendees JSONB should all resolve against participants by email. One person = one record. UI never renders from snapshot copies when a live reference exists. Manual edits in Roadrunner win over sync.

**Context:** Contact data currently scattered across 4 storage patterns (partner_contacts JSONB, aws_team JSONB, participants table, attendees JSONB). Changing a contact's title in one place doesn't cascade to others.

**Rationale:** Single source per entity is the only way to prevent data drift. Email is natural unique key for people.

**Impact:** Major future refactor — contacts become Ring 1 catalog data. Airtable partner contacts upsert into participants during sync. Meeting attendees resolve against participants at render time. Need "manual override wins" conflict resolution.

---

### Decision 139: Resolve, Don't Duplicate — Cascading Source Updates

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Every piece of data has exactly one authoritative home. Everything else points to it via reference (FK, email lookup). When the source changes, all surfaces reflect the update without manual propagation.

**Context:** Core principle that emerged from discussing contact resolution, meeting attendees, and partner data. Currently many snapshot copies exist that drift.

**Rationale:** Duplication is the root cause of data inconsistency. In a system tracking 22 partners with dozens of contacts each, manual consistency maintenance doesn't scale.

**Impact:** Governs all future data architecture decisions. Any new feature must identify the source of each field and reference it, not copy it.

---

### Decision 140: Partner Detail Page as Convergence Point

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Partner detail page becomes the hub showing all three data rings. Profile + contacts (Ring 1), activity timeline with meetings + notes interleaved chronologically (Ring 2), tasks, engagements. Eventually strategic context from Ring 3 (programs enrolled, events attending, plan progress, financials).

**Context:** Current partner detail shows meetings and engagements in separate sections, no notes, no tasks. User has to visit 3+ pages to understand a partner's full picture.

**Rationale:** PDMs think partner-first. "How's Qualys going?" should be answerable from one page.

**Impact:** Biggest UI payoff. Requires notes query by partner, tasks query by partner (exists), merged activity timeline component. Next session priority.

---

### Decision 141: Meetings + Notes Merge in UI as Activity Timeline, Separate in DB

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Meetings and notes remain structurally different in the database (meetings have attendees/ICS/time; notes have raw text/AI summary/tasks). In the UI, they appear together as a chronological activity timeline per partner. Meeting without notes = scheduled event card. Meeting with notes = expandable card showing note content.

**Context:** Debated merging vs keeping separate. Separate DB entities are correct (different fields, different creation paths). But the user experience should be unified.

**Rationale:** The user doesn't think "I want to see meetings" and "I want to see notes" separately. They think "what's been happening with this partner?"

**Impact:** Need a new unified timeline component that interleaves meetings and notes by date. Replaces current MeetingTimeline on partner detail.

---

### Decision 142: Tasks Have Optional Due Dates

**Date:** 2026-03-11
**Status:** Implemented (schema + AI extraction)

**Decision:** due_date column already exists on note_tasks. Not forced, but populated when AI extracts deadlines from notes. Tasks with due dates sort to top on Pulse.

**Context:** Confirmed that the existing column should be actively used.

**Rationale:** Low cost (column exists), high value (enables prioritized task display and future deadline alerts).

**Impact:** AI summarizer already has deadline extraction rule. Pulse page displays due dates. No schema change needed.

---

### Decision 143: UI Must Guide Workflow, Not Dump Data

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Pulse page and partner detail should make the user feel like they know what to do next. Guard rails guide workflow through what users see. Not a vertical dump of lists — structured, focused, with clear CTAs. Information density must be intentional.

**Context:** First Pulse implementation was a vertical list dump that didn't guide action.

**Rationale:** The tool should be opinionated about workflow. A PDM opening the app at 8am should immediately know: these are my meetings, these need my attention, this is what's next.

**Impact:** Pulse page needs redesign with guided workflow approach. Partner detail needs similar intentionality. Primary design challenge for next session.

---

### Decision 144: Sidebar Visual Hierarchy Needs Real Grouping, Not Gradient Fade

**Date:** 2026-03-11
**Status:** Acknowledged, redesign deferred

**Decision:** Current sidebar tier implementation (gradient text dimming) is insufficient. Doesn't communicate structure — just makes things dimmer. Next iteration needs obvious visual separation that communicates meaning.

**Context:** The gradient approach was called out as gimmicky. The navigation tier model is correct but the visual execution failed.

**Rationale:** Visual hierarchy should be self-explanatory. If you have to squint to notice the grouping, the grouping doesn't exist.

**Impact:** Sidebar needs visual redesign next session. Possibly section labels, meaningful dividers, or a fundamentally different approach.

### Decision 145: Kill Pulse — Partners Is Home Page

**Date:** 2026-03-11
**Status:** Implemented

**Decision:** Remove Pulse page entirely. `/` redirects to `/partners`. Partners list IS the morning briefing.

**Context:** Pulse was an aggregator that duplicated data from other pages without adding unique value.

**Rationale:** Partners is the convergence point (Decision #140). Starting there gives the PDM immediate access to their portfolio. A dedicated briefing page may return later once partner detail convergence reveals what cross-cutting view is actually needed.

**Impact:** Pulse page deleted (279 lines). Route `/` redirects to `/partners`.

---

### Decision 146: Sidebar Restructure — 5 Items + Collapsible Catalog

**Date:** 2026-03-11
**Status:** Implemented

**Decision:** Sidebar shows Inbox | Partners, Engagements | Meetings, Tasks | Catalog (expandable → Programs, Events, Relationships). Notes removed from nav entirely. Uniform text styling, no gradient tiers.

**Context:** Old 9-item flat list with gradient text didn't reflect data hierarchy. Notes as standalone nav item contradicted Decision #134 (notes require meetings).

**Rationale:** Sidebar should reflect workflow: Review (Inbox) → Work (Partners, Engagements) → Activity (Meetings, Tasks) → Reference (Catalog). Dividers create zones without labels.

**Impact:** Sidebar.tsx rewritten. Notes nav removed. Tasks nav added. Catalog collapses 3 items into expandable group.

---

### Decision 147: Standard List Page Template

**Date:** 2026-03-11
**Status:** Implemented

**Decision:** All list pages follow one pattern: PageHeader + SearchBar + single-axis FilterBar pills + grouped single-column rows. No multi-column grids, no multi-axis filters, no per-page custom layouts.

**Context:** Every page had its own rendering pattern (PillGrid, CalendarCard, TableList, inline custom). Inconsistent filters (Events had type + year axes, Notes had type + status).

**Rationale:** One pattern = one mental model for the user, one component vocabulary for development, one skill doc for Claude Code. Rows are scannable. Single-axis filters prevent confusion.

**Impact:** EventsClient, ProgramsClient, MeetingsClient, RelationshipsClient, PartnersClient, EngagementsClient all rewritten to template. PillGrid, CalendarCard, TableList no longer used by list pages.

---

### Decision 148: Meeting + Notes Are 1:1

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** One meeting has exactly one set of notes. Notes are not independent entities — they're the documentation record of a specific meeting.

**Context:** Previous design allowed creating notes independently and potentially multiple notes per meeting. This created confusion about what a "note" is.

**Rationale:** In real life, meeting minutes belong to a specific meeting. The notes area should feel like opening a meeting and writing in it, not creating a separate document. AI summary, tasks, and raw notes are all part of the single meeting documentation.

**Impact:** Meeting detail page will gain inline notes area. No "create multiple notes for this meeting" UI.

---

### Decision 149: Notes Accessed Through Meetings, Not Standalone

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** `/notes` route redirects to `/meetings`. Notes are created and viewed from within meeting context. `/notes/[id]` stays alive for direct links (tasks link there).

**Context:** Notes as a standalone nav item and list page implied they're independent entities. Decision #134 + #148 establish they're part of meetings.

**Rationale:** If notes require meetings (134) and are 1:1 with meetings (148), a separate notes list is redundant. You find notes by finding the meeting.

**Impact:** Notes removed from sidebar (done). `/notes` list page to become redirect. Note creation flow starts from meeting detail.

---

### Decision 150: Seeds Are Partner-Level Context, Not Fake Meetings

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Historical context seeds live on the partner detail page, not crammed into meeting_notes with note_type="seed". Seeds are partner intelligence, not meeting documentation.

**Context:** Current seed notes pretend to be meetings but aren't — no date, no attendees, no meeting record. They're dumps of historical knowledge about a partner.

**Rationale:** Making seeds be meetings is architecturally dishonest. Partner context belongs at the partner level. This aligns with the partner-as-convergence-point vision (Decision #140).

**Impact:** Future seed workflow on partner detail page. Existing seed notes grandfathered. New architecture separates meeting documentation from partner context.

---

### Decision 151: Partner Scratchpad as Living Brain

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Each partner gets a free-form scratchpad (context area) that accumulates intelligence over time. The scratchpad feeds the AI summarizer as context when processing meeting notes. It starts unstructured and gradually accumulates structured facts.

**Context:** PDMs have extensive historical knowledge in OneNote and elsewhere. Seeds were the initial solution but they're static dumps. The scratchpad is a living document that grows with every interaction.

**Rationale:** The scratchpad bridges "dump everything I know" (today) to "structured partner profile" (slot registry, future). Meeting summaries can reference scratchpad context. AI can eventually append facts to the scratchpad when it recognizes key information in meeting notes (e.g., "partner now has CRM integration" → scratchpad updated → eventually maps to a slot).

**Impact:** Major future feature. Per-partner storage for accumulated intelligence. Feeds into AI summarization pipeline. Bridge to slot registry architecture.

---

### Decision 152: Tasks Come From Meetings Only (For Now)

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Tasks are children of meeting notes (note_tasks.meeting_note_id FK). No floating partner-level tasks without a meeting source. Future enhancement if validated by real usage.

**Context:** Question arose about wanting to jot down a random task for a partner. Workaround: capture it in next meeting's notes.

**Rationale:** Adding nullable FK or separate task mechanism adds complexity for an unvalidated use case. Constraint forces good workflow discipline — every task has context.

**Impact:** Task creation limited to note workspace. Tasks page shows tasks grouped by partner but all sourced from meetings.

---

### Decision 153: Tasks Page as Top-Level Nav Item

**Date:** 2026-03-11
**Status:** Implemented

**Decision:** `/tasks` is a new page showing all open tasks across partners. Rows grouped by partner, filtered by owner (Me/Partner/AWS Internal). Linked in sidebar.

**Context:** Tasks were buried inside individual notes with no cross-partner view. A PDM needs "what do I owe?" visibility.

**Rationale:** Tasks are the actionable output of the entire system. They deserve a dedicated view alongside Meetings in the Activity tier.

**Impact:** TasksClient.tsx + page.tsx created. Sidebar links to /tasks. Uses standard list page template.

---

### Decision 154: Sync Catalogs Button on Partners (Home) Page

**Date:** 2026-03-11
**Status:** Implemented

**Decision:** "Sync Catalogs" button on Partners page triggers POST /api/sync to pull all catalog data from Airtable (Partners, Programs, Events, Relationships).

**Context:** SyncStatus component was orphaned when Pulse was killed. Sync is a pull from Airtable, not per-page — it refreshes all catalogs at once.

**Rationale:** Partners is home. You land there, sync once, all catalogs refresh. Label "Sync Catalogs" is honest about scope.

**Impact:** PartnersClient.tsx includes sync button. SyncStatus.tsx remains in codebase but unused.

---

### Decision 155: Contact Registry Migration Sequenced After UI Stabilization

**Date:** 2026-03-11
**Status:** Deferred

**Decision:** The participants-table-as-single-registry migration (Decision #138) is deferred to the next architectural phase, after UI standardization and meetings+notes merge are complete.

**Context:** Contact data is scattered across 4+ locations. Fix requires touching sync layer, ICS parser, meeting pipeline, task system, and partner detail page.

**Rationale:** Doing data architecture migration on top of shifting UI would compound risk. Stabilize the surface first, then rewire the data underneath.

**Impact:** Contact consolidation is next major architectural work after UI phase completes.

---

## 2026-03-13 — Meetings + Notes Merge & Partner Convergence

### Decision 156: getMeetingNoteByMeetingId for 1:1 Meeting→Note Lookup

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** Added `getMeetingNoteByMeetingId(meetingId)` query to meeting-notes.ts. Returns full `MeetingNoteWithTasks` for a given meeting, enabling the meeting detail page to check for and display existing notes.

**Context:** Meeting detail page needed to know if a note already exists for this meeting to decide whether to show "Start Notes" button or render the existing workspace.

**Rationale:** 1:1 meeting→note relationship (Decision #148) means lookup by meeting_id is the primary access pattern from meeting context.

**Impact:** Exported from db/index.ts. Used by meeting detail page server component in Promise.all alongside engagement and partner fetches.

---

### Decision 157: POST /api/notes Auto-Inherits engagement_id from Meeting

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** When creating a note via POST /api/notes with a meeting_id but no engagement_id, the API auto-resolves engagement_id from the meeting's linked engagement.

**Context:** The MeetingNotesSection client component shouldn't need to know the engagement context — the API can resolve it from the meeting.

**Rationale:** Reduces coupling between UI and data model. Partner-level meetings (engagement_id NULL) correctly produce notes with engagement_id NULL.

**Impact:** POST /api/notes route enhanced. No UI changes needed — API handles the resolution transparently.

---

### Decision 158: Note Components Moved to Shared Location

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** NoteWorkspace, ContextSidebar, PreviousNotes, and TaskEditor moved from `src/app/notes/new/` to `src/components/notes/` for cross-page reuse.

**Context:** These components were local to the notes/new page but needed by meeting detail page. Moving them to shared location enables reuse without duplication.

**Rationale:** Components used by multiple pages belong in `src/components/`, not co-located with a single page.

**Impact:** 4 files moved. `src/app/notes/new/page.tsx` updated to import from `@/components/notes/`.

---

### Decision 159: NoteWorkspace Enhanced with Optional Props for Existing Notes

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** NoteWorkspace gained optional props: initialRawNotes, initialSummary, initialTasks, initialPhase, meetingId. Defaults preserve original new-note behavior.

**Context:** NoteWorkspace was designed for new notes only. Meeting detail page needs to render it with existing note data (pre-populated text, summary, tasks, and correct phase).

**Rationale:** Optional props with sensible defaults (empty string, empty array, "editing") mean the same component works for both new and existing notes without conditional logic at the call site.

**Impact:** NoteWorkspace.tsx enhanced. handleFinalize navigates to meeting or note based on meetingId prop.

---

### Decision 160: MeetingNotesSection Client Bridge

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** Created MeetingNotesSection client component (`src/components/notes/MeetingNotesSection.tsx`) to bridge server-rendered meeting detail with client NoteWorkspace. Three render states: no note → "Start Notes" button, just created → blank workspace, existing note → pre-populated workspace.

**Context:** Meeting detail page is a server component. NoteWorkspace requires client interactivity (useState, fetch, event handlers). Need a boundary component.

**Rationale:** Clean server/client boundary. Server fetches all data (note, context), passes to client component as props. Client handles all interactivity.

**Impact:** Meeting detail page stays server component. All notes interactivity isolated in MeetingNotesSection.

---

### Decision 161: Partner Detail Four-Layer Model

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** Partner detail page restructured to four-layer model: Profile (What They Do + AWS Context + Partner Profile + Partner Contacts) → Living Context (scratchpad) → Engagements → Activity (meetings with note indicators) → Tasks → AWS Relationships.

**Context:** Previous partner detail showed profile, meetings, engagements, relationships — but no notes visibility, no tasks, no living context section.

**Rationale:** A PDM clicking on a partner should see everything about that partner. The four-layer model organizes information by workflow: understand → strategize → track → act.

**Impact:** Section order reordered. Three new sections added (Living Context, Tasks, note indicators on meetings). Engagements moved above Meetings.

---

### Decision 162: MeetingTimeline Note Status Indicators

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** MeetingTimeline gains optional `noteStatusByMeetingId` prop showing note status indicators per meeting. Emerald dot + task count for complete notes, amber dot + "notes in progress" for drafts. Fully backward-compatible.

**Context:** On partner detail page, PDM needs to see at a glance which meetings have been processed (notes taken, tasks extracted).

**Rationale:** Subtle indicators (small dots + muted text) communicate status without cluttering the timeline. Optional prop means MeetingTimeline works identically on other pages.

**Impact:** MeetingTimeline.tsx enhanced. Partner detail page builds noteStatusByMeetingId Map from partner notes data.

---

### Decision 163: partner_context Table (Migration 056)

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** Created `partner_context` table: id UUID, partner_id FK CASCADE, content TEXT, source CHECK (scratchpad/ai_synthesis/seed_dump), timestamps. Indexes on partner_id and (partner_id, source).

**Context:** Partner scratchpad (Decision #151) needs storage that supports multiple timestamped entries, different sources, and future AI synthesis writes.

**Rationale:** Table (not text field on partners) supports: multiple entries with timestamps, source field for provenance, individual entry management (add/delete), and future brain synthesis (source='ai_synthesis').

**Impact:** Migration 056 applied. DB module `partner-context.ts` with getPartnerContext, addPartnerContext, deletePartnerContext. API route at `/api/partners/[id]/context`.

---

### Decision 164: Scratchpad UX — Type and Enter

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** PartnerScratchpad component: single-line input, Enter to submit, optimistic updates. Entries displayed most-recent-first with relative timestamps and hover-delete. Source badges only for non-scratchpad entries (SEED for seed_dump, AI for ai_synthesis).

**Context:** The scratchpad needs to be zero-friction — a PDM should be able to type "Jackie mentioned new SA hire" and hit Enter without any extra clicks.

**Rationale:** Speed of capture is everything. No submit button, no form, no modal. The input itself is the interface.

**Impact:** PartnerScratchpad.tsx replaces Living Context placeholder on partner detail page. Server-fetches initial entries, client manages state.

---

### Decision 165: Scratchpad Entries Wired into AI Context Pipeline

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** buildPartnerContext fetches scratchpad entries in parallel (6th fetch). formatContextForPrompt includes them as "PARTNER CONTEXT (PDM NOTES)" section after KEY CONTACTS, before ACTIVE ENGAGEMENTS. Filters to scratchpad/seed_dump only — excludes ai_synthesis to prevent feedback loops. ContextSidebar shows up to 5 recent entries.

**Context:** Scratchpad entries are the PDM's accumulated intelligence about a partner. The AI summarizer must know this context to produce grounded meeting summaries.

**Rationale:** If the PDM typed "Jackie mentioned they're hiring a new SA for East Coast" and meeting notes reference "Jackie brought up the SA search" — the AI should connect the dots.

**Impact:** notes-context.ts enhanced (import, fetch, format). ContextSidebar shows partner context section. PartnerContext and DisplayContext types extended with scratchpadEntries.

---

### Decision 166: /notes Routes Converted to Redirects

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** /notes → redirect to /meetings. /notes/new → redirect to /meetings. /notes/[id] → smart redirect: if note has meeting_id → /meetings/{meetingId}, if no meeting_id → /partners/{partnerId}, if not found → 404. NotesClient.tsx deleted. API routes preserved.

**Context:** Decisions #148 and #149 established that notes are accessed through meetings, not standalone. The standalone notes pages (list, create, detail) were redundant.

**Rationale:** Routes stay alive for bookmarks and shared URLs but redirect to the correct context. API routes still needed by MeetingNotesSection and NoteWorkspace.

**Impact:** ~970 lines deleted across 3 page files + NotesClient.tsx. Smart redirect preserves deep link functionality.

---

### Decision 167: Calendar Notes vs Meeting Notes Distinction

**Date:** 2026-03-13
**Status:** Implemented

**Decision:** Meeting detail page "Notes" section renamed to "Calendar Notes" to distinguish ICS invite notes (from the calendar invitation body) from the meeting notes workspace (where the PDM captures notes, AI summarizes, and tasks are extracted).

**Context:** Both the ICS invite body and the PDM's meeting documentation were labeled "Notes" — confusing.

**Rationale:** "Calendar Notes" clearly indicates this is content from the calendar invitation. The NoteWorkspace section is the primary notes area.

**Impact:** Single label change in meeting detail page JSX.

---

### Decision 168: Three org_type Values (internal/partner/third_party)

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** The universal person classification uses three values: internal, partner, third_party. No separate 'user' type for the PDM.

**Context:** Designing the contact registry's org_type enum. Considered adding 'user' as fourth type for the PDM.

**Rationale:** "Me" is a task ownership concept resolved via user-config.ts, not a data model category. Any PDM using Roadrunner would be 'internal' at their org. Three values cover every person cleanly — tested against all 76 contacts in the system.

**Impact:** participants.org_type CHECK constraint. Simpler, more universal.

---

### Decision 169: Dedicated Join Tables Over Polymorphic Junctions

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Four dedicated join tables (partner_participants, meeting_participants, engagement_participants, relationship_participants) replace the polymorphic participant_links pattern.

**Context:** participant_links used polymorphic entity_type/entity_id pattern with no FK constraints. Vision doc (Hole 2) identified orphan risk.

**Rationale:** Real FK CASCADE enforces referential integrity at the database level. The database does the work, not application code. Common queries ("who's on this partner's team") are single-table joins. The rare query ("everything about this person") is a UNION across four small tables.

**Impact:** Created 4 tables in migration 057. participant_links to be dropped in future cleanup.

---

### Decision 170: Tasks Are Partner-Level Entities (note_tasks → tasks)

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Tasks promoted from meeting-note children to partner-level entities. Table renamed from note_tasks to tasks.

**Context:** Tasks were tightly coupled to meeting_notes — CASCADE delete meant losing tasks when editing notes. Also prevented manual task creation since every task required a note.

**Rationale:** Tasks represent real work. They belong to a partner (gravity), not to a note (provenance). A PDM should be able to create a task by remembering something — "I need Jackie to send me that material" — without a meeting note existing.

**Impact:** Table renamed, meeting_note_id made nullable with SET NULL, partner_id made CASCADE. Two creation paths: ai_extracted (from meeting notes) and manual (typed directly).

---

### Decision 171: meeting_note_id SET NULL on Delete, Not CASCADE

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Deleting a meeting note sets task.meeting_note_id to NULL instead of cascading the delete to tasks.

**Context:** Previous behavior: delete a note → all tasks vanish. Wrong — tasks are independent work items.

**Rationale:** Tasks have independent value once created. Deleting a note is editorial. Deleting a task is a workflow decision. Different actions by different intent. Tasks lose provenance (meeting_note_id becomes NULL) but keep their value.

**Impact:** Migration 059 changed FK from CASCADE to SET NULL.

---

### Decision 172: Complete CASCADE Chain Corrected

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Fixed 4 FK constraints that had wrong cascade behaviors on meeting_notes and meetings tables.

**Context:** Multiple FK constraints had NO ACTION (PostgreSQL default), meaning deletes would fail instead of cascading properly.

**Rationale:** Delete a partner → meetings cascade → notes cascade → tasks survive (SET NULL). Delete a meeting → notes cascade → tasks survive. Delete a note → tasks survive. Participants always survive — they're real people, not derived data.

**Impact:** Migration 060 fixed 4 FK constraints: meeting_notes.meeting_id (NO ACTION→CASCADE), meeting_notes.partner_id (NO ACTION→CASCADE), meeting_notes.engagement_id (NO ACTION→SET NULL), meetings.partner_id (SET NULL→CASCADE).

---

### Decision 173: Relationships Universal Naming (aws_relationships → relationships)

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Renamed aws_relationships table to relationships. Columns aws_org → org, aws_service → service.

**Context:** Table was AWS-specific but the model should support any organization — Symbio, Tackle, BrightTalk are third-party teams that participate in partner work.

**Rationale:** A relationship is a team within an organization. The org_type field (internal/third_party) distinguishes them. No vendor-specific naming in the schema.

**Impact:** Migration 058 renamed table + columns. 12 code files updated. engagement_aws_relationships junction table also renamed to engagement_relationships.

---

### Decision 174: Owner CHECK Expanded to Four Values

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Task ownership expanded from (me/partner/aws_internal) to (me/internal/partner/third_party). Added owner_participant_id FK.

**Context:** Needed third_party for tracking work by Symbio, Tackle, etc. Also 'aws_internal' was vendor-specific.

**Rationale:** Four ownership planes: me (the PDM using Roadrunner), internal (colleagues at same org), partner (ISV contacts), third_party (external entities). Plus owner_participant_id FK to specific person.

**Impact:** Migration 059 expanded CHECK. owner_participant_id added for person-level assignment.

---

### Decision 175: Task Origin Values Cleaned (ai_extracted/manual, source dropped)

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Tasks have one creation-mode field: origin (ai_extracted | manual). Dropped the redundant source column.

**Context:** note_tasks had both 'source' (meeting/seed) and 'origin' (ai/manual) — overlapping concepts. With tasks decoupled from notes, 'source' lost meaning.

**Rationale:** One field captures how the task was created: AI extracted it from meeting notes, or human typed it manually. Clean and sufficient.

**Impact:** Migration 059 dropped source column, updated origin CHECK values.

---

### Decision 176: Contact Registry as Single Source of Truth

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** One participants row per person (keyed by email), four join tables for associations. Replaces scattered JSONB contact storage.

**Context:** Same person (e.g., CJ Sturgess) existed in up to 7 locations — partner JSONB, relationship JSONB, meeting attendees, task owner_name, participants table, participant_links, Airtable. No cross-references.

**Rationale:** Seven storage locations → two (participants table + join tables). Every read resolves from the same source.

**Impact:** 76 participants hydrated, 85 partner associations, 6 relationship associations. CJ Sturgess: 1 row, 12 partner links.

---

### Decision 177: Sync Layer Maintains Registry Automatically

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** pull.ts upserts into participants + join tables alongside JSONB writes on every catalog sync.

**Context:** Hydration script populated the registry once, but next Sync Catalogs would only update JSONB, leaving registry stale.

**Rationale:** Registry stays current automatically. JSONB remains as transitional fallback. Registry errors are caught and logged but never fail the sync.

**Impact:** Modified pull.ts + added helper functions in participants.ts. Both partners and relationships sync contacts to registry.

---

### Decision 178: JSONB Columns Are Transitional Artifacts

**Date:** 2026-03-14
**Status:** Planned

**Decision:** aws_team, partner_contacts, contacts JSONB columns will be dropped once UI reads are fully rewired to join tables.

**Context:** JSONB columns still exist and are still written to. UI still reads from them.

**Rationale:** Migration is additive-then-subtractive. Build new alongside old (nothing breaks), shift reads, shift writes, then drop old.

**Impact:** Future session work — UI rewire then JSONB drop.

---

### Decision 179: Legacy Notes Table Confirmed Dead

**Date:** 2026-03-14
**Status:** Planned

**Decision:** The old engagement-level notes table (id, engagement_id, content) should be dropped. Zero code references remain.

**Context:** All note functionality flows through meeting_notes. Legacy table is dead weight.

**Rationale:** No code references. No data value. Clean up.

**Impact:** To be dropped in future cleanup migration.

---

### Decision 180: participant_links Fully Replaced and Dropped

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Completed the migration from polymorphic participant_links to dedicated engagement_participants table. Rewired 10 functions across 8 files (classifier pipeline, Airtable push, Phase 1 prompt, engagement CRUD, UI). Dropped participant_links table in migration 062.

**Context:** Decision #169 created 4 dedicated join tables but only partner_participants and relationship_participants were wired. The classifier pipeline (persistClassificationResult, Phase 1 context, Airtable push) still wrote to/read from participant_links for engagement↔participant associations. DB reset created a clean slate with zero rows.

**Rationale:** engagement_participants has real FK CASCADE on both engagement_id and participant_id — the database enforces referential integrity. participant_links had no FK on entity_id (polymorphic UUID). Manual cascade cleanup code in deleteEngagement() and deleteEvent() was replaced by automatic database CASCADE.

**Impact:** 10 functions rewired, 1 API route renamed (participant-links → engagement-participants), 1 type replaced (ParticipantLink → EngagementParticipant), 1 table dropped. event↔participant cleanup removed (was dead code — zero event participants ever written). 427 tests passing.

---

### Decision 181: meeting_participants Write Path Wired

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Wired the meeting_participants join table with dual-write alongside meetings.attendees JSONB. Three new functions in participants.ts, four call sites in the meeting pipeline.

**Context:** meeting_participants table existed since migration 057 but had zero code — no reads, no writes. ICS attendees went exclusively to meetings.attendees JSONB. This was the last empty join table in the contact registry.

**Rationale:** Completes the write side of the contact registry. All 4 dedicated join tables (partner_participants, relationship_participants, engagement_participants, meeting_participants) now have active write paths. JSONB columns remain as transitional dual-write targets until read paths are rewired.

**Implementation:**
- `linkMeetingParticipant()` — private helper, insert with UNIQUE violation swallow
- `syncMeetingAttendeesToRegistry()` — upserts attendees to participants, links to meeting_participants with organizer role detection
- `replaceMeetingParticipants()` — delete-and-reinsert for ICS updates
- Call sites: createMeetingFromICS (new + update), createMeeting (manual), PUT /api/meetings/[id] (conditional)
- Error handling: Decision #177 pattern — registry errors logged, never fail parent operation

**Impact:** meeting_participants populated on every meeting creation/update. Organizer tracked with role='organizer'. Dual-write: JSONB stays until 7 read locations are rewired.

---

### Decision 182: Contact Registry Read Rewire Complete — 17/17, Zero JSONB Reads

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** All 17 JSONB contact reads across 10 files rewired to the contact registry (participants + 4 dedicated join tables). Zero transitional JSONB reads remain.

**Context:** Decision #178 designated JSONB columns as transitional artifacts. Decision #181 completed the write side. This decision completes the read side — every UI page, prompt builder, and sync function now reads from the registry.

**Implementation:**
- Step 2-3: Name resolver + Phase 1 domain matching rewired from 3 JSONB sources to participants table. getPartnerContactDomains() replaces partner.aws_team/partner_contacts domain extraction. 5 new registry read functions added.
- Step 4: Partner detail + notes context rewired. getContactsByPartner() replaces partner_contacts/aws_team JSONB parsing.
- Step 5: Relationship detail + prompt builder rewired. getContactsByRelationship() with optional param + JSONB fallback in buildRelationshipsSection().
- Step 6: Meeting attendees rewired across 6 files. getContactsByMeeting() with org_type-based bucketing replaces email domain heuristics in groupAttendees(), buildMeetingFields(), buildMeetingHint(), buildLinkedMeetings(), buildNewMeetingData(). Classifier pipeline bulk-fetches meeting contacts.
- Final: Added getContactsByPartnerBulk() and getContactsByRelationshipBulk() for server→client enrichment patterns. PartnersClient.tsx search and partner detail relationship inline both now read from registry.

**Impact:** JSONB columns (aws_team, partner_contacts, contacts, attendees) are now write-only artifacts. Ready for drop in future migration. 426 tests passing.

---

### Decision 183: Documentation Consolidated (8 → 5 Files)

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Consolidated 8 documentation files into 5. CLAUDE.md absorbed PROJECT.md (principles, terminology), ARCHITECTURE.md (tech stack, directory, data flow), and DEVELOPMENT.md (setup, testing, sync guide). Three source files deleted. Remaining docs: CLAUDE.md (master orientation), entity-model.md (schema bible), CLASSIFICATION.md (AI pipeline), goal-state.md (living status), decisions.md (append-only log).

**Context:** Documentation was scattered across 8 files with significant overlap. PROJECT.md and ARCHITECTURE.md both described "what is this project." DEVELOPMENT.md duplicated setup info. New developers (including Claude Code) had to read 4+ files to get oriented.

**Rationale:** One master orientation doc (CLAUDE.md) that answers "what is this, how does it work, how do I work on it" eliminates cross-referencing. Domain-specific docs (classification pipeline, entity model) stay separate because they serve different work contexts.

**Impact:** Session startup is faster — read CLAUDE.md, then the task-specific doc. Documentation map in CLAUDE.md Section 11 tells you which doc to read for which work.

---

### Decision 184: Entity Model Restructured with Ring Architecture

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Rewrote entity-model.md from a flat 2-layer structure (one ERD + field registry) to a ring-based architecture with 5 focused diagrams: Ring Overview (flowchart), Ring 1 Catalog (erDiagram), Ring 2 Activity (erDiagram), People & Connections (erDiagram), Ring 3 Posture (erDiagram). Added CASCADE behavior summary table, Legacy section, and What's Next tracker.

**Context:** The old entity-model.md was dated March 10 with 13 known issues — missing tables (partner_context, 4 join tables), dead tables still listed (notes, participant_links), wrong FK behaviors, stale column names.

**Rationale:** One mega-diagram with 20+ tables is unreadable. Four focused diagrams organized by ring let you understand one layer at a time. The CASCADE summary table prevents future FK mistakes. The ring model (Catalog → Activity → People → Posture) maps directly to the data ownership model and UI architecture.

**Impact:** entity-model.md is now the definitive schema reference. All 13 issues fixed. Every future migration can be placed by asking "which ring does this belong to?"

---

### Decision 185: Bulk Query Pattern for Server→Client Enrichment

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Established a pattern for enriching client component data: bulk-fetch from registry using `getContactsByPartnerBulk(ids[])` and `getContactsByRelationshipBulk(ids[])` in server components, serialize as plain objects, pass as props. Single query fetches all associations, Map groups by entity ID.

**Context:** Client components (PartnersClient.tsx) can't call DB functions. The partner list page shows 22 partners with contact names in search — needed registry data without N+1 queries.

**Rationale:** One `.in("partner_id", ids)` query returns all 85 partner-participant associations. Map<partnerId, contacts[]> grouping makes lookup O(1) per partner. Same pattern works for any entity type.

**Impact:** Reusable pattern for any future client component that needs registry data. Zero N+1 queries.

---

### Decision 186: Legacy Notes Table Dropped (Migration 061)

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Dropped the legacy engagement-level `notes` table (id, engagement_id, content) in migration 061. This was planned in Decision #179.

**Context:** The old notes table predated the meeting_notes system. Zero code references remained after the meetings+notes merge (Decision #148). All note functionality flows through meeting_notes.

**Rationale:** Dead table with zero references. Keeping it creates confusion about which notes table is the real one.

**Impact:** 20 tables → 19 (then 18 after participant_links drop in 062). Clean schema.

---

### Decision 187: Airtable Relationships Table Aligned with Roadrunner Schema

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** Aligned the Airtable Relationships table naming and fields with Roadrunner's schema. Table renamed AWS Relationships → Relationships. Columns renamed AWS Org → Org, AWS Service(s) → Service. New Org Type single-select field created (Internal / Third Party) with field ID fldmShxggHOAuioR4. All 7 existing records set to Internal. Linked record fields on Engagements and Meetings tables updated: AWS Relationships → Relationships. Stakeholder fields renamed to Internal Stakeholders on both tables. Contact field descriptions updated to remove "AWS" prefix.

**Context:** Migration 058 renamed the Supabase table and columns, and added org_type, but the Airtable source table still used the old "AWS" naming. The sync works by field IDs (not names), so there was no functional break — but the visual inconsistency created confusion when viewing Airtable.

**Rationale:** Airtable is the catalog source. It needs to accurately represent the data model. Adding the Org Type field to Airtable means new relationships created there (including future third-party teams like Symbio) will have org_type properly set and synced into Roadrunner via the new field-maps.ts mapping.

**Impact:** Airtable and Roadrunner schemas are fully aligned for the Relationships table. New field ID fldmShxggHOAuioR4 added to sync field-maps (RF constant). pull.ts maps "Internal" → "internal", "Third Party" → "third_party", default "internal" for backward compat.

---

### Decision 188: "Richer Wins" Contact Data Quality Rule

**Date:** 2026-03-14
**Status:** Implemented

**Decision:** upsertContactToRegistry() now applies "richer wins" logic: name only updates if the new value has more words than existing (prevents "Jackie Funk" → "Jackie"). Title and organization only update if the new value is longer. org_type and source only fill NULL (unchanged — already correct).

**Context:** Multiple sources write to the same participant record: Airtable sync (richest data — full names, titles, organizations), ICS parsing (minimal — often just first name + email), and the classifier. Without protection, the ICS path could degrade data quality by overwriting rich AT sync data with minimal ICS data.

**Rationale:** The same "richer wins" logic already existed in backfillMessageSenderNames(). Applying it to the central upsert function means all sources benefit. Any data is better than no data (NULL always gets filled), but richer data is never replaced by less-rich data.

**Impact:** Contact data quality is self-improving — the richest source always wins. AT sync provides the baseline, and no other source can degrade it.

---

### Decision 189: Manual meeting creation — single entry point on /meetings page

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** Manual meeting quick-capture form lives on the /meetings page as a modal triggered by "+ New Meeting" button. Not duplicated on partner detail.

**Context:** Needed manual meeting creation for calls without ICS invites. Considered having the form on both /meetings and partner detail pages.

**Rationale:** Single entry point prevents duplication and keeps workflow organized. Meeting appears on partner detail automatically via partner_id FK.

**Impact:** Completes the daily workflow loop: create meeting → take notes → AI summarizes → tasks extracted.

---

### Decision 190: Meeting title auto-prefills with partner name

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** Quick-capture form auto-prefills title with "PartnerName — " when a partner is selected. Suffix is user-editable; prefix updates on partner change.

**Context:** Quick-capture form needs to minimize clicks. Partner name as prefix establishes naming convention.

**Rationale:** "Appgate — " prefix on partner selection saves typing and creates consistent titles.

**Impact:** Minor UX improvement, supports future pattern recognition for recurring meetings.

---

### Decision 191: Brain synthesis is AI Call 3 — manual Synthesize trigger

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** Partner brain synthesis reads all data sources (profile, note summaries, scratchpad, engagements, tasks, contacts, status fields) and produces a 60-second briefing via Claude. Triggered manually via "Synthesize" button, not auto-generated.

**Context:** Living Context section existed but had no AI output. Scratchpad entries fed into note summarizer but no synthesized overview existed.

**Rationale:** Manual trigger (not auto) to control AI costs and let PDM decide when to refresh. Stored as partner_context source='ai_synthesis', replaced on each re-synthesis.

**Impact:** Partner page now has the "60-second briefing" — the vision's Layer D (What We Know). brain-synthesizer.ts + POST /api/partners/[id]/synthesize.

---

### Decision 192: Brain synthesis uses third-person factual tone

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** Brain synthesis prompt uses third-person factual tone. No "you should" — state what IS.

**Context:** Initial prompt used "you should prioritize..." which felt like advice, not a briefing.

**Rationale:** A dossier states what IS. "Relationship is active with 3 engagements. Main risk: PRM not started." Not "You should focus on PRM."

**Impact:** Consistent professional tone. Brain reads like an analyst's brief.

---

### Decision 193: Living Context = AI output; Scratchpad = human input

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** PartnerScratchpad component split into two visual sections: brain synthesis at top (AI output) and collapsible scratchpad below (human input). "New context since last synthesis" indicator bridges them.

**Context:** Confusion between what "Living Context" meant — was it the input box or the synthesis? Both lived in one undifferentiated flat list.

**Rationale:** Clear separation: brain synthesis displayed prominently at top, scratchpad entries collapsed (3 visible, expand to see all) below with input at bottom.

**Impact:** Mental model is clear: type into scratchpad → hit Synthesize → brain updates. Two different things with distinct purposes.

---

### Decision 194: AWS Context renamed to AWS Stickiness

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** "AWS Context" label in partner detail page renamed to "AWS Stickiness" to match Airtable field name.

**Context:** "AWS Context" was vague. The Airtable field is called "AWS Stickiness" which is more descriptive of the content.

**Rationale:** Match Airtable naming, be explicit about what the field contains.

**Impact:** Single label change in partner detail page. Cosmetic but reduces confusion.

---

### Decision 195: Seed notes eliminated — note_type CHECK allows only 'meeting'

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** Removed 'seed' from meeting_notes note_type CHECK constraint (migration 063). Cleaned seed-specific logic from 8 files.

**Context:** Seed notes were a pre-meetings concept for dumping historical partner context. With scratchpad live and notes 1:1 with meetings, seeds are redundant.

**Rationale:** Clean data model. Notes = meetings. Historical context = scratchpad (partner_context with source='seed_dump'). No ambiguity.

**Impact:** Migration 063. note_type CHECK narrowed to ('meeting'). Removed hasSeedNote, seed badges, seed ordering, seed prompt modifiers across types, DB, summarizer, context builder, and 3 UI components.

---

### Decision 196: Tasks independently creatable without meeting notes

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** Added POST /api/notes/tasks for manual task creation and "+ Add Task" inline form on partner detail page. No meeting_note_id required.

**Context:** Tasks only entered the system via AI extraction from meeting notes. PDMs need to add tasks from memory, emails, or ad-hoc observations.

**Rationale:** Tasks are partner-level entities (Decision #170). origin='manual' already existed in schema. POST handler validates partner_id, description, owner.

**Impact:** "+ Add Task" button on partner detail Tasks section. Inline form with description, owner dropdown, optional due date.

---

### Decision 197: AT push gate — only skip ICS meetings without engagement

**Date:** 2026-03-15
**Status:** Implemented

**Decision:** pushMeetingToAirtable() engagement gate changed from "skip all without engagement" to "skip only ICS-parsed without engagement."

**Context:** The gate blocked ALL meetings without engagement_id, including manual partner-level meetings (cadence calls, QBRs) that legitimately have no engagement.

**Rationale:** ICS meetings arrive before classification — skipping them is correct (they push after classification links them). Manual meetings are intentionally created with a partner — they should push immediately.

**Impact:** Manual meetings now sync to Airtable. ICS pre-classification behavior preserved.

---

### Decision 198: Partner Plans 2026 renamed to Co-Sell Goals 2026

**Date:** 2026-03-15
**Status:** Implemented (Airtable)

**Decision:** Renamed the Airtable "Partner Plans 2026" table to "Co-Sell Goals 2026" to clarify its purpose.

**Context:** Creating a new Partner Goals table for strategic objectives. "Partner Plans" name conflicted and was confusing.

**Rationale:** The existing table tracks financial/co-sell metrics (TCV, LARR, attainment %). Renaming clarifies its purpose and distinguishes from strategic goals.

**Impact:** All existing formulas, lookups, and links preserved. Name change only in Airtable.

---

### Decision 199: Partner Goals table created in Airtable for strategic objectives

**Date:** 2026-03-15
**Status:** Implemented (Airtable)

**Decision:** New Airtable table "Partner Goals" (tblmboZKyBasfh5pV) for tracking non-financial strategic objectives per partner.

**Context:** No structured way to track non-financial goals like "attain FSI Competency" or "complete PRM by July." Co-Sell Goals only covered TCV/LARR.

**Rationale:** Flat table with goal + partner + category + year + target date + status + optional program link. One row per goal. Simple, flexible, scales. Categories: Co-Sell, Co-Build, Co-Market, Compliance, Program, Vertical.

**Impact:** Ring 3 data. Future pull into Roadrunner for brain synthesis context.

---

### Decision 200: Dashboard spatial model for detail pages

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Complex detail pages (partner, engagement, meeting) use a two-column grid layout (`grid-cols-[3fr_2fr] gap-8`). Left column = workflow (brain, engagements, tasks, notes, activity). Right column = reference (about, profile, contacts, metadata). Right column separated by subtle vertical border (`border-l border-border/20 pl-8`). Simpler detail pages (program, event, relationship) use single-column. Responsive: stacks on mobile.

**Context:** Previous layout was a vertical stack of equally-weighted bordered cards. PDMs need a dashboard they can scan in 5 seconds before a call — not a document to scroll through.

**Rationale:** Two-column dashboard mirrors how CRMs display account data. Workflow on left because it's action-oriented. Reference on right because it's glanceable context.

**Impact:** All detail pages restructured. DetailHeader component deprecated (replaced by inline identity bar).

---

### Decision 201: "No boxes" default — borders are earned

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Sections separated by whitespace (20-28px) and section labels (11px uppercase muted). No `rounded-xl border bg-surface` card wrappers around sections. Borders earned ONLY when: element is a distinct clickable entity (engagement card), element is an input (scratchpad, search), or element is a data boundary (column separator).

**Context:** Every section was wrapped in identical bordered cards, making everything equal weight. Information hierarchy was nonexistent.

**Rationale:** Whitespace creates visual hierarchy. Cards around everything create visual noise. Only bordered elements draw the eye — making borders earned means the important interactive elements stand out.

**Impact:** Every page rewritten. ~50 `rounded-xl` card wrappers removed across all pages.

---

### Decision 202: Identity bar replaces DetailHeader

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Every detail page uses a compact identity bar: entity name (20px weight-500) + badge(s) + actions right-aligned, separated by a single bottom border (`border-border/30`). No card wrapper. DetailHeader component is deprecated.

**Context:** DetailHeader was a card component with title, badges, subtitle, fields grid. It consumed significant viewport space and treated all metadata as equally important.

**Rationale:** The identity bar is a thin strip that says "you're looking at X" without dominating. Metadata that was in DetailHeader fields now lives in the right column where it belongs.

**Impact:** DetailHeader removed from all 6 detail pages. Component still exists for backward compat but is no longer used.

---

### Decision 203: Status dots replace text badges for binary status

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Engagement/meeting status uses a 6-7px colored circle (green=active, amber=blocked, purple=completed, gray=archived) instead of StatusBadge text labels. Pills reserved for categorical data (pillar, owner, type). Plain text for free-form metadata.

**Context:** StatusBadge took up horizontal space with text like "Active" when a green dot communicates the same thing instantly.

**Rationale:** Three-tier status display: dots (binary), pills (categorical), text (free-form). Each serves a different scanning need.

**Impact:** StatusBadge removed from all detail page identity bars. Still available for list pages.

---

### Decision 204: Partner page is convergence-only — task creation moved to /tasks

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Partner detail page shows tasks read-only (description + owner + due date). "+ Add Task" button and form added to /tasks page with partner assignment dropdown. PartnerTasksSection no longer renders creation UI.

**Context:** Partner page was trying to be both a convergence point (things flow TO it) and a creation point (create tasks FROM it). The only creation on partner page is scratchpad input.

**Rationale:** Scratchpad is inherently partner-level input. Tasks are cross-cutting work items that happen to be assigned to partners. Creating them on the dedicated /tasks page is cleaner.

**Impact:** PartnerTasksSection simplified to display-only. TasksClient gained creation form with partner dropdown.

---

### Decision 205: Sidebar flattened — collapsible Catalog removed

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** All 8 nav items shown flat under 4 zone labels: REVIEW (Inbox), WORK (Partners, Engagements), ACTIVITY (Meetings, Tasks), REFERENCE (Programs, Events, Relationships). No collapsible parent. Zone labels: 10px, font-medium, uppercase, tracking-[0.1em], text-muted/40.

**Context:** The collapsible Catalog parent created janky indentation alignment and hid reference items behind an extra click.

**Rationale:** With only 8 items total, collapsibility adds complexity without saving space. Zone labels provide grouping without nesting.

**Impact:** Sidebar reduced in complexity. catalogOpen state, chevron animation, indent logic all removed.

---

### Decision 206: Page-level collapsibility rule

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** If ANY group on a list page has 10+ items, ALL groups on that page default-collapsed (showing header-only overview). If no group exceeds 10, all default-open. Search forces all groups open.

**Context:** Previous per-group threshold (10+ = collapsed, under 10 = open) created inconsistent states on the same page — e.g., Competencies collapsed while Service Ready was open.

**Rationale:** Consistency within a page matters more than per-group optimization. A page is either a scannable overview (all collapsed) or a readable list (all open).

**Impact:** Programs page: all 8 groups now default-collapsed. Other list pages unaffected (no group exceeds 10).

---

### Decision 207: JSONB backend fallbacks eliminated — registry is sole read source

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Removed 3 JSONB fallback branches from phase2-prompt.ts (partner_contacts, aws_team, attendees). Activated registry path in push.ts (getContactsByMeeting now called, meetingContacts passed to buildMeetingFields). Deleted dead buildNameResolutionMapFromRegistry and duplicate PERSONAL_DOMAINS from participants.ts.

**Context:** Registry was declared authoritative (Decision #177-182) but backend still had fallback code that read JSONB when registry was empty. This was dead code in practice (registry always populated for synced data) but contradicted the architectural decision.

**Rationale:** "Registry is the sole source" means no fallbacks. If registry is empty, the data doesn't exist — don't mask it with JSONB.

**Impact:** 4 JSONB UI reads remain (RelationshipsClient, engagement page JSONB rel.contacts, MeetingActions, RelationshipActions) — tracked for rewire during JSONB column drop.

---

### Decision 208: Engagement detail restructured with proper hierarchy

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Left column: goal callout + "Activity summary" (renamed from current_state) + timeline. Right column: partner + details (pillar, topic, status, updated) + connections (relationships with org/service + entity links with relationship labels) + participants (single instance, no duplication). EntityLink chips replaced with rows showing type + name + relationship label.

**Context:** Previous version had participants rendered twice (page-level org summary + CollapsibleParticipants), connections in left column (reference data in workflow zone), and EntityLinks shown as opaque chips without relationship context.

**Rationale:** Goal is structural (what we're trying to achieve). Activity summary is narrative (what's happened). They serve different purposes and belong in different visual treatments. Connections are reference data (right column). Participants should render exactly once.

**Impact:** Engagement detail page fully restructured. EntityLinkChip import removed. Page-level org breakdown calculation removed (CollapsibleParticipants handles its own).

---

### Decision 209: schema_live.sql deprecated

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Deleted schema_live.sql (stale since migration 051, now at 063). Updated CLAUDE.md to reference `supabase/migrations/` as the authoritative schema source.

**Context:** schema_live.sql was a convenience snapshot that was never maintained. It showed `note_type IN ('meeting', 'seed')` despite migration 063 removing 'seed'.

**Rationale:** A stale snapshot is worse than no snapshot — it actively misleads. The migrations directory is always correct.

**Impact:** One less file to maintain. Any future schema questions go to migrations.

---

### Decision 210: Semicolon delimiter in contact parser

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** `parseContactList()` splits on `/[\n;]/` instead of just `\n`.

**Context:** Airtable Contacts field uses semicolons to separate multiple people. Parser only split on newlines, silently dropping all contacts after the first.

**Rationale:** Semicolons are the natural AT delimiter for inline lists. Splitting on both is safe — no valid contact string contains a bare semicolon.

**Impact:** All multi-contact fields across 22 partners now parse correctly. KnowBe4 went from 2 to 4 visible contacts.

---

### Decision 211: Email normalization at registry entry point

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** `normalizeEmail()` strips trailing dots and whitespace before insertion into participants table.

**Context:** Airtable data sometimes has typos like "harleya@knowbe4.com." (trailing dot). These created phantom entries that never matched lookups.

**Rationale:** Clean at the gate, not at every read site. One function, one call site (`upsertContactToRegistry`).

**Impact:** Prevents duplicate participant rows from common email typos.

---

### Decision 212: Underscore heuristic for classifier role detection

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** `isClassifierRole()` returns true if role contains underscore, plus explicit checks for "forwarder", "attendee", "organizer". Replaces `CLASSIFIER_ROLES` allowlist.

**Context:** The allowlist missed "partner_contact" and "third_party", causing raw DB values to render in the UI. The classifier always uses snake_case; AT roles always use natural casing.

**Rationale:** Heuristic catches all current and future classifier roles without maintenance. No false positives possible because AT field names never use underscores.

**Impact:** Zero classifier role values ever render in the UI. Future-proof.

---

### Decision 213: Contact display hierarchy — named role → title → org_type label

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** `getDisplayRole(role, title, orgType)` implements a three-level fallback: (1) show AT-sourced role if it's a named role, (2) show participant title if no named role, (3) show clean org_type label ("AWS" / "Partner" / "Third Party") if nothing else.

**Context:** Each page had its own ad-hoc display logic — some showed raw roles, some showed titles, some showed nothing.

**Rationale:** One rule, centralized in `contact-display.ts`, applied everywhere via ContactRow. No contact ever shows blank or raw values.

**Impact:** Consistent contact labels across every surface in the app.

---

### Decision 214: Role priority sort order

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Alliance Lead=1, PSA=2, Account Manager=3, PMM=4, other named roles=50, Contact=99. `sortContactsByRole()` uses this order within each org_type group.

**Context:** Alliance Lead was sometimes appearing below generic contacts. Sort order wasn't defined.

**Rationale:** Reflects real-world importance hierarchy for a PDM. Extensible — new named roles get priority 50 by default.

**Impact:** Most important contacts always appear first.

---

### Decision 215: Shared ContactRow + ContactGroup components

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Created two shared components. ContactRow renders one contact (name + display label + title + email). ContactGroup handles org_type grouping with headers and role-priority sorting. Used by every contact surface.

**Context:** Four surfaces had four different inline JSX patterns with different fields, styling, and logic. Partner detail showed role + email. Engagement showed title/role fallback. Meeting showed name + email only.

**Rationale:** Approach A (shared component) over Approach B (shared logic, page-level layout) because the individual contact card should be pixel-identical everywhere. Pages handle grouping/arrangement.

**Impact:** Every contact in the app renders identically. Single place to update styling or add fields.

---

### Decision 216: All contact editing removed from UI

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Participants are read-only in Roadrunner. Removed "+ Add participant" from engagement detail, contacts textarea from relationship edit, attendees textarea from meeting edit. ParticipantList went from 297 lines to 36.

**Context:** Engagement participant editing was disconnected from the canonical registry — changes didn't propagate to participants table or Airtable. Multiple editing surfaces created confusion about source of truth.

**Rationale:** Contacts are managed in two places: Airtable (catalog contacts) and Supabase (classifier-created contacts). The UI displays; it doesn't edit. Eliminates disconnected write paths.

**Impact:** Simpler UI, no confusing edit forms, clear source of truth.

---

### Decision 217: org_type inferred from email domain in classifier path

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** `upsertParticipants()` infers org_type when creating new participants: Amazon domains → "internal", known partner domains → "partner", else → "third_party". Does NOT overwrite existing org_type (richer wins).

**Context:** Participants created purely by the classifier had org_type = null, causing ContactRow to show blank labels.

**Rationale:** Email domain is a reliable signal. Amazon employees are always @amazon.*. Partner contacts use company domains. The inference is a fallback — AT sync sets accurate org_type that takes precedence.

**Impact:** New classifier-created participants immediately show "AWS" / "Partner" / "Third Party" labels.

---

### Decision 218: JSONB contact columns dropped (migration 064)

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Dropped `partners.aws_team`, `partners.partner_contacts`, `relationships.contacts`, `meetings.attendees`. Removed all writes from sync layer. Removed fields from TypeScript interfaces. Removed from API routes.

**Context:** Contact registry (participants + 4 join tables) has been the sole read source since March 14. These columns were write-only artifacts.

**Rationale:** Schema should reflect reality. No dual-write, no "maybe we'll need it." The registry is the single source of truth, enforced at the database level.

**Impact:** Contact registry migration fully complete. Zero JSONB contact data anywhere in the system.

---

### Decision 219: ContextSidebar KEY CONTACTS uses ContactRow

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** Replaced the three static role-keyed string blocks ("Alliance Lead: Name <email> (Title)") with a loop over registry contacts rendered via ContactRow.

**Context:** Last remaining contact surface not using the shared component. Used a completely different data pipeline and rendering pattern.

**Rationale:** Zero exceptions to the shared rendering pattern. Consistent display everywhere.

**Impact:** Every contact surface in the entire app uses ContactRow.

---

### Decision 220: push.ts uses participants.title for AT stakeholder strings

**Date:** 2026-03-16
**Status:** Implemented

**Decision:** `fetchEngagementParticipants()` and `buildMeetingFields()` now select and use `participants.title` instead of hardcoding null.

**Context:** Every engagement and meeting pushed to AT showed "(—)" for stakeholder titles because push.ts never fetched the title field.

**Rationale:** The data existed in the participants table — it just wasn't being used.

**Impact:** Airtable stakeholder fields now show real titles.

---
