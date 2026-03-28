# UI/UX Overhaul — Agent Task List

**Read docs/north-star.md, .claude/roadrunner-ui/SKILL.md, and docs/entity-model.md before starting any work.**
**Run the verification sequence after every task. Do not proceed to the next task until all checks pass.**

Verification sequence:
1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — all 435+ tests pass
3. `bash scripts/ui-audit.sh` — all mechanical checks pass
4. `npx tsx scripts/screenshot.ts` — screenshot every changed page at 1280 and 1440
5. `npx tsx scripts/interact.ts` — test key interaction flows for the pages you changed

Before starting each task, view the reference screenshots in `.claude/references/` and read `.claude/references/references.md`. Study what makes those products feel professional. Apply those principles — don't copy those layouts.

Before implementing any page, identify every state it can be in: loading, loaded, empty, partial data, error, mid-mutation, unsaved changes. Implement each state deliberately. After implementation, use Playwright to trigger each state and screenshot it. No page is done until every state has been visually verified.

Work through these tasks in order. Each task has a scope (what you're touching), intent (why it matters and how to think about it), context (specific things to know), and done-when (observable outcomes that must be true before moving on).

---

## Task 1: Layout Shell + Sidebar

**Scope:** Sidebar component, root layout, app frame.

**Intent:** The sidebar currently has 4 zones with 8 items, flattening everything to equal weight. The user's mental model is hierarchical: Today and Partners are daily drivers, Inbox is a triage queue, Tasks and Meetings are secondary views, Programs and Events are reference catalogs. The sidebar should reflect that hierarchy through visual weight — not just ordering, but how prominently each item presents itself. This is the skeleton everything else hangs on. Get it right first.

**Context:**
- Target structure per North Star Part 4: Primary (Today, Partners, Inbox with badge), Secondary (Tasks, Meetings), Tertiary (Programs, Events)
- Engagements and Relationships are removed from the sidebar entirely — accessed through partner detail
- Inbox badge already polls every 30s — preserve that behavior
- The brand mark at top currently says "Relay" — the app is called Roadrunner now, update if appropriate
- Mobile: hamburger toggle with overlay, current pattern is fine to keep

**Done-when:**
- Sidebar has exactly 7 items in 3 visual tiers
- Primary items are visually dominant, secondary items are present but subordinate, tertiary items are accessible but quiet
- Active state is visually unambiguous on every item
- Inbox badge renders with count
- Layout shell is stable at 1280, 1440, and 1920 viewport widths
- Mobile sidebar collapses and toggles correctly
- Playwright screenshot at all three widths confirms no layout breakage
- All 435+ tests pass, tsc clean, audit clean

---

## Task 2: Today Screen

**Scope:** Root page (`/`), the app landing page.

**Intent:** This is where the user starts every day. It's a launchpad, not a dashboard — the user should spend 10 seconds here, see what needs doing, and click into the thing. Design around the usage hierarchy: meetings first (one click to notes is the #1 interaction in the entire app), then tasks, then inbox signal, then upcoming meetings. Sections with no content should collapse gracefully, not show empty states that waste space.

**Context:**
- The Today page already exists and is functional — it shows today's meetings and inbox count. You are redesigning it, not wiring data from scratch.
- Today's Meetings: partner name, meeting type badge, prominent "Open Notes" action. One click → note workspace.
- Open Tasks: filtered to "me" by default, grouped by partner. Checkbox to complete inline. Due date highlighted if overdue.
- Inbox Items: just the count and a CTA to go triage. Not the full inbox.
- Upcoming Meetings: next 7 days. Same format as today's meetings but lower visual priority.
- North Star Part 2 (Screen 1: Today) has the full spec.

**Done-when:**
- All four sections render with real data
- Sections with no data collapse without leaving blank space
- Clicking a meeting navigates to the meeting detail / note workspace
- Tasks show with partner context and overdue highlighting
- Inbox count is visible with clear link to /inbox
- Page feels like a launchpad — scannable in seconds, not a data dump
- Playwright interaction test: click a meeting, verify navigation. Complete a task, verify visual feedback.
- All 435+ tests pass, tsc clean, audit clean

---

## Task 3: Partner List

**Scope:** Partner list page (`/partners`).

**Intent:** The partner list is the directory — "let me go look at Spacelift." Currently it shows name, focus area, and segment badge. It needs a compact performance indicator so you can see at a glance which partners are performing and which aren't, without leaving the list. Grouped by segment. Search should be fast and obvious.

**Context:**
- 24 partners, grouped by segment (Security, DevOps, CloudOps, Observability, OT/IoT)
- Financial fields on partner: mp_tcv_ytd, mp_tcv_goal, larr_ytd, larr_goal
- TCV attainment = ytd ÷ goal × 100 (computed in UI, not stored)
- Keep it compact — this is a list you scan, not a page you study
- North Star Part 2 (Screen 2: Partners) has the spec

**Done-when:**
- Partners grouped by segment with count per group
- Each row shows: name, segment badge, focus area, and a compact TCV attainment indicator
- Search filters the list in real-time
- Clicking a partner navigates to partner detail
- Empty search state is clean
- Playwright screenshot at 1440 confirms information density is balanced — tight but readable
- All 435+ tests pass, tsc clean, audit clean

---

## Task 4: Partner Detail + Engagement Detail

**Scope:** Partner detail page (`/partners/[id]`) and engagement detail page (`/engagements/[id]`).

**Intent:** Partner detail is the convergence point — the dossier. You open it and immediately orient: who is this partner, what's happening, how are they performing. Then you scroll to whatever layer you need. The current implementation has all the data wired but is deliberately unstyled. Your job is layout, visual hierarchy, and interaction design. This is the most complex page in the app — 12+ sections, each with its own data shape. The engagement detail page is accessed as a drill-through from partner detail and needs the same enterprise polish.

**Context — Partner Detail:**
- Fixed Identity Bar at top: partner name, segment badge, SPMS ID (small, muted). Always visible.
- Synthesis Paragraph: single paragraph from Brain Synthesizer. Currently the BrainSynthesis component likely still parses `## ` headers to split sections — the brain output is now a plain paragraph with no headers. Simplify the renderer to just display the paragraph.
- Co-Sell Performance Snapshot: 11 financial fields already wired. `fmtCurrency` helper exists at module-level in the partner detail page — extract to a shared utility if needed elsewhere. Display: MP TCV ytd/goal with attainment %, LARR ytd/goal with attainment %, prior year context, projected annual. No AI opinion — numbers speak.
- Below the fold — scrollable sections (each expand/collapse): Active Engagements (grouped by pillar), Open Tasks, Recent Meetings (last 90 days), Program Enrollments (type/status badges), Strategic Goals (clean empty state — this table has 0 records currently), Funding Wallets (MPOPP + MDF with computed remaining), People (from participants registry), Solution Profile (static reference data), Operational Status (badges/indicators), Scratchpad (always editable).
- All 6 Ring 3 sections are wired but deliberately unstyled — plain rows and text. Your job is layout and visual treatment.
- The PartnerReferencePanel slide-over with Profile/Status/People tabs still exists. North Star says single scrollable view with inline sections, not tabs behind a slide-over. Decide how to dissolve this — move the content into the scrollable sections, then remove the panel.
- North Star Part 2 (Partner Detail Page) has the full section-by-section spec.

**Context — Engagement Detail:**
- Accessed from partner detail's Active Engagements section
- Shows: condensed digest, current_state, connected meetings, timeline, participants
- Needs the same enterprise treatment: loading states, consistent badges, professional layout
- EngagementActions component stays — it handles edit, delete, merge

**Done-when:**
- Partner detail has a clear visual hierarchy: identity bar → synthesis → financial snapshot → scrollable sections
- BrainSynthesis renders a plain paragraph, not parsed sections
- PartnerReferencePanel slide-over is dissolved into inline scrollable sections
- Financial data displays consistently using extracted fmtCurrency utility
- All Ring 3 sections have proper visual treatment (not unstyled rows)
- Sections with no data show clean empty states (especially Strategic Goals and Event Participations)
- Engagement detail has consistent enterprise treatment
- Playwright screenshot of partner detail at 1440 shows clear information hierarchy — most important stuff visually prominent at top
- Playwright interaction test: expand/collapse sections, click through to engagement detail, trigger brain re-synthesis and verify loading state
- All 435+ tests pass, tsc clean, audit clean

---

## Task 5: Meeting Notes Workspace

**Scope:** Meeting detail page (`/meetings/[id]`), NoteWorkspace component, related note components.

**Intent:** Meeting notes is the #1 interaction with Roadrunner. The user opens it in a meeting, types notes, clicks Generate Summary, reviews the AI output, edits extracted tasks, and saves. This flow must be frictionless and professional. The current implementation works but has hobby-project rough edges — loading states that don't communicate progress, no navigation safety, ambiguous button labels. Elevate this to enterprise grade. Every state transition should be obvious. The user should never wonder "did it save?" or "what happens if I leave?"

**Context:**
- Three modes: Writing (textarea + context sidebar) → Review (AI summary + TaskEditor) → Saved (read-only + tasks)
- "Generate Summary" must show explicit progress indicator — not just dots. The user must know the system is working.
- "Save & Lock" commits summary + tasks. "Back to Notes" returns to editing. Clear, unambiguous.
- Critical: if user navigates away after summarize but before save, block navigation with confirmation dialog. No silent data loss.
- Error states must be clear and actionable: "Summary generation failed — try again" with retry button.
- Save operations must confirm visually — brief success indicator.
- North Star Part 3 has the full spec for all three modes.

**Done-when:**
- Generate Summary shows contextual loading state with message ("Generating summary...")
- Button disables during operation — no double-clicks
- Summary appears with structured sections (Discussion/Decisions/Key Context)
- TaskEditor is interactive — user can edit, remove, add tasks before committing
- Save & Lock shows visual confirmation
- Navigating away with unsaved changes triggers confirmation dialog
- Error states show retry button
- All three modes are visually distinct — user always knows which mode they're in
- Playwright interaction test: type notes → click Generate Summary → verify loading state appears → verify summary renders → click Save & Lock → verify confirmation → navigate away and verify dialog appears
- All 435+ tests pass, tsc clean, audit clean

---

## Task 6: Tasks + Inbox Polish

**Scope:** Tasks page (`/tasks`) and Inbox page (`/inbox`).

**Intent:** These pages are mostly functional. The work here is enterprise polish — consistent spacing, proper loading states, confirmation on destructive actions, inline interactions that feel responsive. Don't reimagine these pages; elevate them.

**Context — Tasks:**
- 36 open tasks, filtered by owner (Me/Internal/Partner/Third Party), "Group by partner" toggle
- Checkbox to complete inline — needs visual feedback on state change
- Delete needs confirmation dialog
- Inline description edit exists — verify it saves cleanly with visual confirmation
- Due dates should highlight overdue and approaching
- Scrolling through 36 tasks should be smooth — consider if grouping or pagination helps

**Context — Inbox:**
- Assign/create/discard workflow is functional
- "Pick Partner" flow for unknown partners works
- Discard needs confirmation dialog
- Routing to engagement should show visual feedback
- Inbox badge in sidebar should update after routing

**Done-when:**
- Every button has hover/active/disabled states
- Completing a task has immediate visual feedback (checkbox animation or state change)
- Deleting a task shows confirmation dialog
- Discarding inbox items shows confirmation dialog
- No layout shift on any state change
- Task filtering and grouping works smoothly
- Due date highlighting is clear (overdue = prominent, approaching = subtle)
- Playwright interaction test: complete a task, verify visual feedback. Delete a task, verify confirmation. Route an inbox item, verify feedback.
- Playwright screenshots confirm visual consistency with the redesigned pages from Tasks 1-5
- All 435+ tests pass, tsc clean, audit clean

---

## Task 7: Cleanup + Consistency Pass

**Scope:** The entire application.

**Intent:** After individual pages are done, zoom out. Look at the app as a whole. Are badges consistent across every context? Are loading patterns the same everywhere? Is spacing uniform? Are there pages touched early that now look inconsistent with decisions made later? This is the "walk through the house after the furniture is placed" pass. Also handle the structural removals: delete the list pages that are no longer in the sidebar, audit for orphaned components.

**Context:**
- Delete `/engagements` list page (route + page component). Engagement detail `/engagements/[id]` stays.
- Delete `/relationships` list page (route + page component). Relationship detail `/relationships/[id]` stays.
- Audit RelationshipActions component — may be orphaned after list page deletion. If only used on the deleted list page, remove it.
- Check legacy note routes (`/notes`, `/notes/new`, `/notes/[id]`) — if truly orphaned with no inbound links, delete them.
- Update SKILL.md with all patterns established during the overhaul — this is the living design system document.
- Verify all 24 partner brain syntheses render correctly as plain paragraphs.

**Done-when:**
- Deleted pages are fully removed — no dead routes, no orphaned imports
- Every badge (status, pillar, type, segment) looks identical across every page it appears on
- Every loading pattern is the same everywhere
- Spacing is uniform — no page feels tighter or looser than another
- Typography hierarchy is consistent — same heading sizes, same label treatment, same body text across all pages
- SKILL.md documents all patterns established during the overhaul
- Full quality checklist from North Star Part 10 passes
- Playwright screenshots of EVERY page at 1440 show a visually cohesive application — no page looks like it belongs to a different product
- All 435+ tests pass, tsc clean, audit clean
- ui-audit.sh passes clean with zero violations

---

*Work through these tasks in order. After each task, re-read docs/north-star.md Part 7 (Enterprise UX Standards) and Part 8 (Visual Design System) to recalibrate. View the reference screenshots in .claude/references/ to refresh your quality bar. Then run the full verification sequence. Only proceed to the next task when everything passes.*
