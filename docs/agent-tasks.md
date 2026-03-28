# UI/UX Overhaul — Agent Task List

## Who This Is For

Roadrunner is used by a single person — an AWS Partner Development Manager (PDM) managing 22 ISV partner relationships. He is in back-to-back meetings all day. He context-switches between partners constantly. Every design decision must serve this reality.

**#1 interaction: Meeting notes.** He opens Roadrunner mid-meeting to type notes, generate a summary, and extract tasks. Getting from app open to typing must be ONE CLICK. Speed and clarity are everything. If the meeting notes flow has any friction — unclear buttons, confusing states, slow feedback — the tool fails at its primary job.

**#2 interaction: Partner lookup.** Between meetings, he opens a partner page to orient: what's happening with this partner, how are they performing, what's active. He needs to absorb the situation in 10 seconds and drill into whatever needs attention. The partner detail page is a dossier — it must communicate hierarchy instantly.

**#3 interaction: Task management.** He has 36+ open tasks across 22 partners. He needs to see what he owes people, check things off, and not lose track. The current task page is a flat scrollable list with clunky filters — it works but doesn't scale. He needs to manage tasks efficiently, not wade through them.

**#4 interaction: Inbox triage.** Forwarded emails land in the inbox. He routes them to engagements or discards them. This should be fast and decisive — see the email, make the call, move on.

**The overarching principle:** This person has 15 minutes between meetings. Every screen must answer a question or enable an action within seconds. If a page makes him think "where do I click?" or "what am I looking at?" — that's a failure. The data is rich (22 partners, 30+ engagements, 44 meetings, 80 program enrollments, financial metrics, funding wallets, tasks, notes). The UI's job is to make that data legible, navigable, and actionable without overwhelming.

**You are not reskinning an existing app. You are solving workflow problems with design.** If a page layout doesn't serve the user's actual workflow, redesign it. If filters are clunky, rethink them. If information hierarchy is wrong, restructure it. The North Star describes the destination. The reference screenshots show the quality bar. But how you get there — the specific layout decisions, interaction patterns, component structures — that's your creative work. Be opinionated. Make choices. Document your reasoning in SKILL.md as you go.

---

## Before You Start

Read these documents in order:
1. `docs/north-star.md` — The complete vision
2. `.claude/roadrunner-ui/SKILL.md` — The design system (update it as you establish patterns)
3. `docs/entity-model.md` — The complete schema

View the reference screenshots in `.claude/references/` and read `.claude/references/references.md`. These are your quality bar — not templates to copy, but standards to meet or exceed.

---

## Verification Sequence (after every task)

1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — all 435+ tests pass
3. `bash scripts/ui-audit.sh` — all mechanical checks pass
4. `npx tsx scripts/screenshot.ts` — screenshot every changed page at 1280 and 1440
5. `npx tsx scripts/interact.ts` — test key interaction flows for the pages you changed

---

## Mid-Task Self-Check (run this mentally during every task, not just between tasks)

Pause periodically while working on a task and ask yourself:

1. **Am I solving the workflow problem or just moving pixels?** If the user's actual pain point on this page is that they can't find what they need fast enough, no amount of spacing fixes will help. Rethink the layout.
2. **Would this page make sense to someone seeing it for the first time?** Labels, hierarchy, and flow should be self-explanatory. If it needs a tutorial, it needs a redesign.
3. **Have I identified every state this page can be in?** Loading, loaded, empty, partial data, error, mid-mutation, unsaved changes. Each state must be deliberately designed. Use Playwright to trigger and screenshot each state.
4. **Does this look like the reference screenshots — not in layout, but in quality?** Same level of spacing discipline, typography hierarchy, interaction polish. If your output feels rougher than the references, keep iterating.
5. **Am I being consistent with patterns I've already established?** Check SKILL.md. If this page introduces a new pattern (how badges look, how lists are spaced, how sections collapse), document it there FIRST, then implement.
6. **Is there anything on this page that doesn't earn its space?** Every element must serve a purpose. If you can remove something without losing functionality or clarity, remove it.

---

## Task 1: Layout Shell + Sidebar

**Scope:** Sidebar component, root layout, app frame.

**Intent:** The sidebar currently has 4 zones with 8 items, flattening everything to equal weight. The user's mental model is hierarchical: Today and Partners are daily drivers, Inbox is a triage queue, Tasks and Meetings are secondary views, Programs and Events are reference catalogs. The sidebar should reflect that hierarchy through visual weight — not just ordering, but how prominently each item presents itself. This is the skeleton everything else hangs on. Get it right first.

Think about what the sidebar communicates at a glance. When the user opens the app between meetings, the sidebar should orient them: "Here's where you go." Primary items should feel like destinations. Secondary items should feel like tools. Tertiary items should feel like reference shelves. The visual treatment must make this hierarchy obvious without labels or explanations.

**Context:**
- Target structure per North Star Part 4: Primary (Today, Partners, Inbox with badge), Secondary (Tasks, Meetings), Tertiary (Programs, Events)
- Engagements and Relationships are removed from the sidebar entirely — accessed through partner detail
- Inbox badge already polls every 30s — preserve that behavior
- The brand mark at top currently says "Relay" — the app is called Roadrunner now, update if appropriate
- Mobile: hamburger toggle with overlay, current pattern is fine to keep

**Done-when:**
- Sidebar has exactly 7 items in 3 visual tiers
- The hierarchy is obvious without reading labels — visual weight alone communicates primary vs. secondary vs. tertiary
- Active state is visually unambiguous on every item
- Inbox badge renders with count
- Layout shell is stable at 1280, 1440, and 1920 viewport widths
- Mobile sidebar collapses and toggles correctly
- Playwright screenshot at all three widths confirms no layout breakage
- All 435+ tests pass, tsc clean, audit clean

---

## Task 2: Today Screen

**Scope:** Root page (`/`), the app landing page.

**Intent:** This is where the user starts every day. It's a launchpad, not a dashboard — the user should spend 10 seconds here, see what needs doing, and click into the thing. The user has 15 minutes between meetings. This page must answer "what do I need to do right now?" instantly.

Think about how a busy person scans a page. Their eyes go to the most visually prominent element first. That element must be today's meetings, because one-click-to-notes is the #1 interaction. Then tasks — what do I owe people? Then inbox — is anything waiting? Then upcoming — what's coming this week? The visual hierarchy must enforce this scanning order.

Sections with no content should collapse gracefully — not show empty states that waste precious screen space. If there are no meetings today, the tasks section moves up. The page adapts to what's relevant right now.

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
- The page answers "what do I need to do right now?" within 5 seconds of landing
- Playwright interaction test: click a meeting, verify navigation. Complete a task, verify visual feedback.
- All 435+ tests pass, tsc clean, audit clean

---

## Task 3: Partner List

**Scope:** Partner list page (`/partners`).

**Intent:** The partner list is the directory — "let me go look at Spacelift." The user manages 22 partners across 5 segments. They need to find a partner fast and get a sense of how that partner is doing before clicking in.

Think about what makes a list scannable. It's not just alphabetical order — it's visual rhythm. Consistent row heights, clear group boundaries, a performance signal that you can absorb peripherally without reading numbers. The user should be able to scan 22 partners and know which ones need attention without studying each row.

**Context:**
- 24 partners, grouped by segment (Security, DevOps, CloudOps, Observability, OT/IoT)
- Financial fields on partner: mp_tcv_ytd, mp_tcv_goal, larr_ytd, larr_goal
- TCV attainment = ytd ÷ goal × 100 (computed in UI, not stored)
- North Star Part 2 (Screen 2: Partners) has the spec

**Done-when:**
- Partners grouped by segment with count per group
- Each row shows: name, segment badge, focus area, and a compact TCV attainment indicator
- Search filters the list in real-time
- Clicking a partner navigates to partner detail
- The list is scannable — you can absorb the portfolio health at a glance
- Empty search state is clean
- Playwright screenshot at 1440 confirms information density is balanced — tight but readable
- All 435+ tests pass, tsc clean, audit clean

---

## Task 4: Partner Detail + Engagement Detail

**Scope:** Partner detail page (`/partners/[id]`) and engagement detail page (`/engagements/[id]`).

**Intent:** Partner detail is the convergence point — the dossier. The user opens it between meetings and needs to absorb the situation in 10 seconds: who is this partner, what's happening, how are they performing. Then they scroll to whatever layer needs attention.

This is the most complex page in the app — 12+ sections, each with its own data shape. The challenge isn't showing all the data — it's already wired. The challenge is creating a visual hierarchy so clear that the user's eyes naturally flow from the most important information to the least important, and they can stop scrolling the moment they've found what they need.

Think about information architecture, not just layout. The identity bar and synthesis paragraph orient you ("who is this, what's the story"). The financial snapshot gives you the quantitative picture ("how are they doing"). Everything below the fold is progressive detail you access on demand. The page should feel like peeling layers, not scrolling through a dump.

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
- A user can orient on a partner in 10 seconds by reading the synthesis and scanning the financial snapshot
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

**Intent:** Meeting notes is the #1 interaction with Roadrunner. The user opens it mid-meeting, types notes, clicks Generate Summary, reviews the AI output, edits extracted tasks, and saves. This flow must be frictionless and professional.

Think about what "frictionless" means for someone in a meeting. They have a browser tab open, they're half-listening, they're typing bullet points. They don't want to think about the tool — they want to think about the meeting. Every interaction must be obvious. Every state transition must be instant and clear. Every button must say exactly what it does. If the user ever pauses to wonder "what happens if I click this?" — that's a failure.

The current implementation works but has rough edges — loading states that don't communicate progress, no navigation safety, ambiguous button labels. These aren't cosmetic issues. A user who loses meeting notes because they navigated away without saving will stop trusting the tool.

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
- The entire flow feels like it was designed for someone who's simultaneously in a conversation
- Playwright interaction test: type notes → click Generate Summary → verify loading state appears → verify summary renders → click Save & Lock → verify confirmation → navigate away and verify dialog appears
- All 435+ tests pass, tsc clean, audit clean

---

## Task 6: Tasks + Inbox

**Scope:** Tasks page (`/tasks`) and Inbox page (`/inbox`).

**Intent — Tasks:** The user has 36+ open tasks across 22 partners. The current page is a flat scrollable list with owner filters and a "Group by partner" toggle. This works for 10 tasks. It does not work for 36. The user's real questions are: "What do I owe people this week?" and "What's overdue?" and "What did I promise Spacelift?" The page must make these questions answerable at a glance, not through scrolling and squinting.

Rethink how tasks are organized and surfaced. Consider whether the current filter model (owner tabs) is the right primary axis, or whether due-date urgency or partner grouping serves the workflow better. Consider what information each task row needs — is the current layout too sparse or too dense? Consider whether overdue tasks should be visually separated, not just color-coded. The North Star describes the destination; you design the path.

**Intent — Inbox:** The inbox triage flow is functional but needs enterprise polish. The user routes emails quickly — see it, decide, move on. Every action should have clear visual feedback. Destructive actions need confirmation. The flow should feel decisive and fast.

**Context — Tasks:**
- 36 open tasks across 22 partners
- Current filters: All, Me, Internal, Partner, Third Party (owner tabs)
- "Group by partner" toggle exists
- Each task has: description, owner, partner_id, engagement_id, meeting_note_id, due_date, status, origin
- Checkbox to complete, delete with confirmation, inline description edit
- Tasks with engagement_id show engagement provenance; tasks from meetings show meeting provenance
- Due dates exist but aren't prominently surfaced in the current UI

**Context — Inbox:**
- Assign/create/discard workflow is functional
- "Pick Partner" flow for unknown partners works
- Inbox badge in sidebar should update after routing

**Done-when:**
- Tasks page makes "what's overdue?" and "what do I owe this partner?" answerable without scrolling through everything
- Task organization serves the workflow — whatever structure you choose, it must be faster than the current flat list
- Every task interaction has visual feedback (complete, delete, edit)
- Due date urgency is visually prominent — overdue items are impossible to miss
- Filters or grouping feel natural, not clunky
- Inbox actions have confirmation on destructive operations and visual feedback on routing
- Inbox badge updates after routing
- Playwright interaction test: complete a task, verify visual feedback. Delete a task, verify confirmation. Route an inbox item, verify feedback.
- Playwright screenshots confirm visual consistency with the redesigned pages from Tasks 1-5
- All 435+ tests pass, tsc clean, audit clean

---

## Task 7: Cleanup + Consistency Pass

**Scope:** The entire application.

**Intent:** After individual pages are done, zoom out. Look at the app as a whole. Walk through every page in sequence as if you're the user moving through a real workday: open the app (Today), check a partner (Partner List → Partner Detail), take meeting notes (Meeting Detail), manage tasks (Tasks), triage inbox (Inbox). Does the experience feel cohesive? Does every page feel like it belongs to the same product? Are there visual decisions made early that feel inconsistent with decisions made later?

This is also where structural cleanup happens: deleting pages that are no longer in the sidebar, auditing for orphaned components, documenting the design system patterns you established.

**Context:**
- Delete `/engagements` list page (route + page component). Engagement detail `/engagements/[id]` stays.
- Delete `/relationships` list page (route + page component). Relationship detail `/relationships/[id]` stays.
- Audit RelationshipActions component — may be orphaned after list page deletion. If only used on the deleted list page, remove it.
- Check legacy note routes (`/notes`, `/notes/new`, `/notes/[id]`) — if truly orphaned with no inbound links, delete them.
- Update SKILL.md with all patterns established during the overhaul — this is the living design system document.
- Verify all 24 partner brain syntheses render correctly as plain paragraphs.

**Done-when:**
- Deleted pages are fully removed — no dead routes, no orphaned imports
- A walkthrough of the full user flow (Today → Partner → Notes → Tasks → Inbox) feels like a single cohesive product
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
