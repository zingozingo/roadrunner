# Plan 8: Engagement Message Management

**Created:** 2026-04-13
**Branch:** plan-8/engagement-message-management
**Scope:** Add the ability to select messages and meetings within an engagement and move them — to another existing engagement, to a new engagement, or back to the inbox. Any affected engagement is automatically re-synthesized. Empty engagements auto-delete with a warning.

## Context

The inbox routing pipeline now gives the PDM enough context to route correctly most of the time (Tier 1 fixes: body preview, enriched picker, naming bug). But mistakes still happen — a bad merge, a mixed email thread, a misrouted forward. Today there's no way to surgically fix these. Messages go into engagements but never come out. This plan creates message-level management: select items, move them, re-synthesize both sides automatically.

Diagnostic findings confirm the architecture supports this: all `engagement_id` FKs are nullable with SET NULL on delete, synthesis rebuilds from current DB state, and the existing resolve pipeline handles "messages arriving at an engagement" for the target side. The key technical challenge is source re-synthesis after message removal — the incremental synthesis model carries stale information from removed messages. The solution: clear `current_state` and `condensed` before rebuilding from remaining messages (Option C from synthesis audit).

## Success Criteria

- From an engagement detail page, Steven can open a management modal, see every message and meeting in the engagement, check items, and move them to another engagement, a new engagement, or back to the inbox
- After moving, both source and target engagements have accurate AI summaries with no stale content
- Meetings linked to moved messages (via `message_id`) automatically follow, along with their notes and tasks
- Standalone meetings (no `message_id`) are independently selectable and moveable
- If all items are removed, the user is warned and the engagement is auto-deleted
- The "move to new engagement" and "move to existing engagement" flows use the same shared picker and creation form as the inbox

## Key Design Decisions (resolved pre-plan)

1. **Linked meetings auto-follow their message.** A meeting spawned from an ICS attachment is part of that email's context. The service cascades it; the UI shows linked meetings as visual sub-items of their parent message (not independently selectable). Standalone meetings (no `message_id`) appear as their own selectable rows.
2. **Modal, not inline mode.** The management view is a focused modal overlay, not a layout switch on the engagement detail page. Keeps implementation clean and maintains engagement context in the background.
3. **Shared picker extraction.** The enriched engagement picker (name + topic + status + recency) is extracted from InboxClient into a shared component. Both inbox routing and management modal use the same picker. Same for the create-new form.
4. **Source re-synthesis uses Option C.** Clear `current_state` and `condensed` on the source engagement, then rebuild from the latest 10 remaining messages. This prevents stale information from removed messages persisting in the summary.
5. **Target re-synthesis uses incremental.** The moved messages are treated as "new" messages arriving at the target, using the normal resolve pipeline. No clearing needed.
6. **Participants are not moved.** Participants are engagement-level entities rebuilt by re-synthesis. No manual participant transfer.

## Phases

- **Phase 1 (Tasks 8.1–8.3):** Backend — service function, re-synthesis logic, and API route. No UI. Fully testable via API.
- **Phase 2 (Tasks 8.4–8.6):** UI — management modal, action bar with shared picker, and integration with engagement detail page.

## Write Access Rules

- Phase 1: `src/lib/engagement-manager.ts` (new), `src/lib/db/messages.ts`, `src/lib/db/meetings.ts`, `src/lib/db/meeting-notes.ts`, `src/lib/db/engagements.ts`, `src/app/api/engagements/[id]/reassign/route.ts` (new)
- Phase 2: `src/components/engagements/ManageEngagement.tsx` (new), `src/components/shared/EngagementPicker.tsx` (new), `src/components/shared/CreateEngagementForm.tsx` (new), `src/components/engagements/EngagementActions.tsx`, `src/components/inbox/InboxClient.tsx` (extract shared components), `src/app/engagements/[id]/page.tsx`
- All phases: `docs/`, `.claude/roadrunner-frontend/SKILL.md`, `.claude/roadrunner-backend/SKILL.md`

## SKILL.md Evolution

- **Frontend:** New "Management Modal" pattern (focused overlay with selection list and action bar). New "Shared Engagement Picker" pattern. New "Shared Create Engagement Form" pattern.
- **Backend:** New "Entity Reassignment" pattern (cascade logic + dual re-synthesis trigger).

## Verification Protocol (applies to ALL tasks)

After every task, before reporting done:
1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass (expected: 444+)
3. If UI changed: read `.claude/roadrunner-frontend/SKILL.md` first. Playwright screenshot at 1280px. VIEW the screenshot.
4. If a new service or db function was created: verify it follows three-layer architecture
5. If a pattern was established or evolved: update the relevant SKILL.md before committing
6. `git add -A && git commit -m "{type}: {description}"`

---

## Phase 1: Backend — Reassignment Service + API

### Task 8.1 — Create reassignMessages() service function

**Intent:** Build the core operation that moves messages and their cascaded entities from one engagement to another (or to null/inbox). Handles data movement only — re-synthesis is Task 8.2.

**Scope:** Create `src/lib/engagement-manager.ts` with `reassignMessages()`. Create per-item db functions for targeted entity movement. Do NOT handle re-synthesis or API exposure.

**Pre-flight:**
- [ ] Read `src/lib/db/messages.ts` — identify `linkMessagesToEngagement()`, `reparentMessagesToEngagement()` signatures
- [ ] Read `src/lib/db/meetings.ts` — identify how meetings link to messages (`message_id` FK) and engagement_id update functions
- [ ] Read `src/lib/db/meeting-notes.ts` — identify note-to-meeting and note-to-engagement FKs, reparent functions
- [ ] Read `src/lib/db/engagements.ts` — confirm tasks have direct `engagement_id` FK
- [ ] Read `src/lib/engagement-merge.ts` — understand cascade pattern (messages → meetings → notes → tasks)

**Implementation:**

Create `src/lib/engagement-manager.ts`:

```typescript
interface ReassignInput {
  messageIds: string[];       // Messages selected by user
  meetingIds: string[];       // Standalone meetings selected (no message_id link)
  sourceEngagementId: string;
  targetEngagementId: string | null;  // null = return to inbox
}

interface ReassignResult {
  movedMessages: number;
  movedMeetings: number;
  movedNotes: number;
  movedTasks: number;
  sourceEmpty: boolean;
}
```

Steps in order:
1. Move selected messages — update `engagement_id` to target (or NULL)
2. Cascade meetings from messages — find meetings where `message_id IN (selected messageIds)`, update their `engagement_id`
3. Move standalone meetings — update `engagement_id` for explicitly selected meetingIds
4. Cascade notes — for all meetings moved in steps 2+3, find `meeting_notes` by `meeting_id`, update `engagement_id`
5. Cascade tasks — for all notes moved in step 4, find `tasks` by `meeting_note_id`, update `engagement_id`
6. Check source empty — query whether source has any remaining messages OR meetings, return `sourceEmpty` flag

New db functions needed:
- `updateMessagesEngagement(messageIds: string[], engagementId: string | null)` in messages.ts
- `getMeetingsByMessageIds(messageIds: string[])` in meetings.ts
- `updateMeetingsEngagement(meetingIds: string[], engagementId: string | null)` in meetings.ts
- `getNotesByMeetingIds(meetingIds: string[])` in meeting-notes.ts
- `updateNotesEngagement(noteIds: string[], engagementId: string | null)` in meeting-notes.ts
- `getTasksByNoteIds(noteIds: string[])` in meeting-notes.ts or relevant db file
- `updateTasksEngagement(taskIds: string[], engagementId: string | null)` in relevant db file
- `getEngagementItemCounts(engagementId: string): { messages: number, meetings: number }` in engagements.ts

**Verification (in addition to plan-level protocol):**
- [ ] `reassignMessages()` handles all three targets: existing engagement ID, null (inbox), and supports new engagement (caller creates first, passes ID)
- [ ] Cascade chain is complete: messages → meetings (via message_id) → notes → tasks
- [ ] Standalone meetings also cascade to their notes and tasks
- [ ] No participant changes — participants are engagement-level
- [ ] All new db functions follow existing naming and typing conventions

**Done when:** `reassignMessages()` moves messages and meetings from one engagement to another or to null, cascading all related entities. Returns counts and source-empty flag.

**Steven checkpoint:** STOP. Report new db functions, service function signature, and cascade logic. Wait for confirmation.

---

### Task 8.2 — Add re-synthesis triggers

**Intent:** After messages move, both source and target engagements have stale AI summaries. Source re-synthesis uses Option C (clear + rebuild from remaining messages). Target uses incremental synthesis (normal resolve flow). Both push to Airtable afterward.

**Scope:** Extend `engagement-manager.ts` to include re-synthesis as the final step of `reassignMessages()`. Re-synthesis is integrated into the service function — callers do not need to trigger it separately.

**Pre-flight:**
- [ ] Read `src/lib/classifier.ts` — `synthesizeIntoEngagement()` params and behavior
- [ ] Read `src/lib/engagement-merge.ts:89-114` — merge re-synthesis pattern (template for source rebuild)
- [ ] Read `src/lib/inbox-resolver.ts` — `resolveInboxToEngagement()` (template for target synthesis)
- [ ] Read `src/lib/db/engagements.ts` — confirm `updateEngagement()` accepts null for `current_state` and `condensed`
- [ ] Read `src/lib/db/messages.ts` — confirm `getMessagesByEngagement()` returns DESC order

**Implementation:**

Integrate re-synthesis at the end of `reassignMessages()`, after all entity movement is complete:

**Source re-synthesis (Option C — clear + rebuild):**
1. `updateEngagement(sourceId, { current_state: null, condensed: null })` — clear stale summary
2. Fetch latest 10 remaining messages via `getMessagesByEngagement(sourceId)` (DESC, limit 10)
3. If zero messages remain: skip synthesis entirely (source may be deleted by caller)
4. Build synthetic Phase1Result with `isNew: false` and source engagement metadata
5. Call `synthesizeIntoEngagement()` with the 10 messages as "new" — AI sees "no current state yet" and writes fresh briefing from remaining messages plus meeting digests and participant context
6. Push source engagement to Airtable

**Target re-synthesis (incremental):**
1. If target is null (inbox): skip entirely
2. Fetch target engagement
3. Build synthetic Phase1Result with `isNew: false` and target engagement
4. Call `synthesizeIntoEngagement()` with the moved messages as "new" — AI evolves target's existing current_state
5. Push target engagement to Airtable

**Verification (in addition to plan-level protocol):**
- [ ] Source clears `current_state` and `condensed` BEFORE rebuilding
- [ ] Source uses latest 10 remaining messages
- [ ] Target uses incremental synthesis — does NOT clear current_state
- [ ] If target is null, no target synthesis is attempted
- [ ] If source has zero remaining messages, synthesis is skipped
- [ ] Both source and target push to Airtable
- [ ] Re-synthesis reuses existing functions — no new AI pipeline code

**Done when:** After `reassignMessages()` completes, both engagements have accurate summaries. Source no longer references moved content. Target incorporates new content.

**Steven checkpoint:** STOP. Report re-synthesis flow for source (Option C) and target (incremental). Confirm both push to Airtable. Wait for confirmation.

---

### Task 8.3 — Create the reassign API route

**Intent:** Expose reassignment as an API endpoint. Handles validation, the three move scenarios, and empty-engagement auto-delete.

**Scope:** Create `POST /api/engagements/[id]/reassign`. Thin route: validation → service → response.

**Pre-flight:**
- [ ] Read `src/app/api/reviews/resolve/route.ts` — `create_new` branch as template for "move to new engagement"
- [ ] Read `src/app/api/engagements/merge/route.ts` — validation patterns (same-partner check)
- [ ] Read `.claude/roadrunner-backend/SKILL.md` — route structure patterns

**Implementation:**

Request body:
```typescript
{
  messageIds: string[];
  meetingIds: string[];
  action: "move_to_existing" | "move_to_new" | "return_to_inbox";
  targetEngagementId?: string;   // Required for move_to_existing
  newEngagementTitle?: string;   // Required for move_to_new
}
```

Route logic:
1. **Validate:** source engagement exists, messageIds/meetingIds non-empty, all referenced items belong to source engagement
2. **Resolve target:**
   - `move_to_existing`: validate target exists, same partner as source
   - `move_to_new`: create engagement with user's title and source's partner_id
   - `return_to_inbox`: target is null
3. **Call `reassignMessages()`** — cascade + re-synthesis + AT push
4. **Handle empty source:** if `result.sourceEmpty`, delete source from Airtable then DB
5. **Return:** `{ moved: { messages, meetings, notes, tasks }, sourceDeleted: boolean, targetEngagement?: { id, name } }`

**Verification (in addition to plan-level protocol):**
- [ ] Validates all messageIds/meetingIds belong to source engagement
- [ ] `move_to_existing` enforces same-partner
- [ ] `move_to_new` creates engagement with user's title (not AI-overwritten per our fix)
- [ ] Empty source auto-deletes from Airtable and DB
- [ ] Response includes enough info for UI to redirect or update
- [ ] Route follows three-layer architecture — zero business logic

**Done when:** API supports all three move scenarios. Re-synthesis fires automatically. Empty engagements cleaned up.

**Steven checkpoint:** STOP. Report route structure, validation checks, response shape. Wait for confirmation before Phase 2.

---

## Phase 2: UI — Management Modal

### Task 8.4 — Create ManageEngagement modal with item list and selection

**Intent:** Build the management modal that shows every message and meeting in an engagement as a clean, selectable list. No AI summaries — just raw items with enough context to identify them.

**Scope:** Create `src/components/engagements/ManageEngagement.tsx` — the modal with item list and selection logic. Action bar is Task 8.5. Integration is Task 8.6.

**Pre-flight:**
- [ ] Read `.claude/roadrunner-frontend/SKILL.md` — selection lists, checkbox patterns, modal patterns, typography hierarchy
- [ ] Read `src/app/engagements/[id]/page.tsx` — what data is already fetched (messages, meetings) and available as props
- [ ] Read `src/components/inbox/InboxClient.tsx` — how inbox cards render message previews for visual consistency

**Implementation:**

Modal component receiving engagement's messages and meetings as props. Single combined list sorted by date (most recent first).

**Message rows:**
- Checkbox (left)
- Email icon
- Subject line (primary text)
- Sender name + email (secondary/muted)
- Body preview, 1 line truncated (tertiary/muted-60, same style as inbox cards)
- Timestamp (right-aligned)
- If message has a linked meeting (via `message_id`): meeting title + date shown as an indented sub-item with calendar icon and "Linked meeting" label. Not independently selectable — auto-follows parent message.

**Standalone meeting rows (no `message_id`):**
- Checkbox (left)
- Calendar icon
- Meeting title (primary text)
- Attendees (secondary/muted)
- Date and time (tertiary/muted-60)
- Timestamp (right-aligned)

**Selection logic:**
- Individual checkboxes per row (messages and standalone meetings only — linked meetings are not checkable)
- "Select all" checkbox in header
- Selection count: "3 items selected"
- When a message is checked and it has a linked meeting, the sub-item shows a subtle "will move with email" indicator

**Verification (in addition to plan-level protocol):**
- [ ] Messages show: subject, sender, body preview, timestamp
- [ ] Standalone meetings show: title, attendees, date/time
- [ ] Linked meetings appear as sub-items of their parent message, not as separate rows
- [ ] Select all / deselect all works correctly
- [ ] Selection count accurate (counts messages + standalone meetings, not linked meeting sub-items)
- [ ] Screenshot at 1280px: clean scannable list, clear visual hierarchy, no clutter

**Done when:** ManageEngagement modal renders a complete selectable list of all items in an engagement. Linked meetings visually follow their parent messages. Selection state is clear and accurate.

**Steven checkpoint:** STOP. Show screenshot. Confirm item display has enough context to identify each item. Confirm linked-meeting cascade is communicated clearly. Wait for confirmation.

---

### Task 8.5 — Action bar and shared picker extraction

**Intent:** Add the action bar to the modal with three move options. Extract the engagement picker and create-new form from InboxClient into shared components for reuse in both inbox and management modal.

**Scope:** Extract shared components from InboxClient. Add action bar to ManageEngagement. Wire API calls. Verify inbox still works after extraction.

**Pre-flight:**
- [ ] Read `.claude/roadrunner-frontend/SKILL.md` — Action Button Group Spec, Mutation Lifecycle Framework
- [ ] Read `src/components/inbox/InboxClient.tsx` — identify the engagement picker rendering (around lines 518-527) and create-new form (around lines 548-563). Map all state and props they depend on.
- [ ] Identify every place InboxClient references the picker/form — ensure extraction won't break internal references

**Implementation:**

**Extract shared components:**
- `src/components/shared/EngagementPicker.tsx` — accepts `partnerId`, `onSelect(engagement)` callback. Renders the enriched list (name + topic + status + recency). Fetches engagements for the given partner internally.
- `src/components/shared/CreateEngagementForm.tsx` — accepts `partnerId`, `partnerName`, `defaultTitle`, `onCreate(title)` callback. Renders title input with partner context.
- Update InboxClient to import and use these shared components. Verify inbox behavior is identical.

**Action bar (fixed bottom of modal, visible when 1+ items selected):**
- Selection count: "3 items selected"
- "Move to Engagement" button → opens EngagementPicker filtered to same partner
- "Move to New" button → opens CreateEngagementForm with partner pre-filled
- "Return to Inbox" button → confirmation dialog: "These items will appear in your inbox for re-routing"
- All buttons disabled when zero items selected

**API integration:**
On action confirmation, POST to `/api/engagements/[id]/reassign`:
- `messageIds`: selected message IDs
- `meetingIds`: selected standalone meeting IDs only (linked meetings cascade via service)
- `action`, `targetEngagementId`, or `newEngagementTitle` as appropriate

**After success:**
- Toast: "Moved 3 messages and 1 meeting to {engagement name}"
- Close modal
- Trigger page data refresh
- If `sourceDeleted: true`, redirect to engagements list or partner page

**Verification (in addition to plan-level protocol):**
- [ ] All three actions work end-to-end
- [ ] EngagementPicker matches inbox picker exactly (same enriched view)
- [ ] CreateEngagementForm matches inbox creation UX
- [ ] InboxClient still works identically after shared component extraction
- [ ] Loading state during API call follows Mutation Lifecycle Framework
- [ ] Success feedback is clear
- [ ] SKILL.md updated with Shared Engagement Picker and Shared Create Engagement Form patterns

**Done when:** Users can select items and execute any move action. Picker and creation flows match inbox. Inbox is unaffected by extraction.

**Steven checkpoint:** STOP. Show screenshots of each action flow. Verify inbox still works. Wait for confirmation.

---

### Task 8.6 — Integration, empty engagement handling, and polish

**Intent:** Wire ManageEngagement into the engagement detail page. Add "Manage" button. Handle empty-engagement warning. Polish edge cases.

**Scope:** Integration point between engagement detail page and ManageEngagement modal. Final edge case handling and visual polish.

**Pre-flight:**
- [ ] Read `src/app/engagements/[id]/page.tsx` — identify what props ManageEngagement needs and where the trigger button fits
- [ ] Read `src/components/engagements/EngagementActions.tsx` — existing action layout
- [ ] Read `.claude/roadrunner-frontend/SKILL.md` — confirmation dialog patterns

**Implementation:**

**"Manage" button:** Add to EngagementActions alongside Edit, Delete, Merge. Distinct but non-primary style — this is a power-user action.

**Modal trigger:** Clicking "Manage" opens ManageEngagement modal. Pass already-fetched messages and meetings as props — no additional API call.

**Empty engagement warning:** When user selects ALL items and chooses a move action, show confirmation dialog: "This will move all items out of **{engagement name}**. The engagement will be permanently deleted." Buttons: "Move and Delete" / "Cancel". The API handles deletion; the UI just warns.

**Edge cases:**
- Engagement with only standalone meetings (no messages): management modal still works
- Move to same engagement: validate and show error
- Single-item engagement: select all just selects 1, works normally
- API error: show error in modal, keep modal open for retry
- Post-move data refresh: `router.refresh()` or re-fetch to reflect updated content, updated AI summary, updated participants
- Source deleted: redirect to partner page or engagements list (no 404)

**Verification (in addition to plan-level protocol):**
- [ ] "Manage" button visible on engagement detail page
- [ ] Modal opens with correct data
- [ ] Empty engagement warning fires when all items selected
- [ ] Page reflects updated content after move (no stale data)
- [ ] Source deletion redirects cleanly
- [ ] Error handling: API failure shows error, modal stays open
- [ ] Frontend and backend SKILL.md updated with new patterns
- [ ] Screenshots: modal open, empty warning dialog, post-move updated page

**Done when:** Full end-to-end flow works: open engagement → Manage → select items → move → re-synthesize → page updates. Empty engagements auto-delete with warning. All edge cases handled.

**Steven checkpoint:** STOP. Show screenshots of full flow. This is the plan completion checkpoint.