# Roadrunner — Plan Template

Use this template when creating a new task plan. Copy this structure into `docs/plans/active.md` and fill in the sections.

---

## Plan Header

```markdown
# Plan {N}: {Plan Name}
**Created:** {date}
**Branch:** plan-{N}/{short-kebab-name}
**Scope:** {1-2 sentence summary of what this plan delivers and why it matters}

## Context
{3-5 sentences: What's the current state? What problem does this plan solve? What user experience does it improve? Reference specific diagnostic findings or session discussions that motivated this plan.}

## Success Criteria
{What does "done" look like? Not task-level — plan-level. What can Steven do after this plan that he couldn't do before?}

## Phases
{List phases with brief purpose. Not every plan needs phases — a 3-task plan is just tasks. Use phases when there are 6+ tasks with natural groupings or dependency gates.}

## Write Access Rules
{Which files/directories does this plan touch? Helps the agent stay in scope.}
- Phase 1: {paths}
- Phase 2: {paths}
- All phases: docs/, .claude/roadrunner-frontend/SKILL.md (for pattern updates)

## SKILL.md Evolution
{Which patterns will be established or updated during this plan? Alerts the agent to check and update the design system as it works.}
- {Pattern area}: {what's expected to change}

## Verification Protocol (applies to ALL tasks)
After every task, before reporting done:
1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass (expected: {N})
3. `bash scripts/ui-audit.sh` — clean
4. If UI changed: Playwright screenshot at 1280px. VIEW the screenshot. Check for: overflow, truncation, alignment, spacing conformance with SKILL.md.
5. If interaction changed: test the flow manually or via `scripts/interact.ts`
6. If a pattern was established or evolved: update SKILL.md before committing
7. `git add -A && git commit -m "{type}: {description}"`
```

---

## Task Structure

Every task uses this exact structure:

```markdown
### Task {X.Y} — {Name}

**Intent:** {Why this task exists — the problem it solves, not the code it writes. 1-2 sentences.}

**Scope:** {What's in and what's explicitly out. Prevents scope creep.}

**Pre-flight:**
- [ ] Read SKILL.md sections: {specific sections relevant to this task}
- [ ] Diagnostic: {specific thing to check/measure before changing code — e.g., "count current mutation surfaces on this page", "check how the existing component handles loading", "verify the current layout at 1280px"}
- [ ] Check adjacent surfaces: {what else uses this pattern or component that might be affected?}

**Implementation:**
{What to build or change. Be specific about the approach, not just the outcome. Include design decisions that were made during planning so the agent doesn't re-decide them differently.}

**Verification (in addition to the plan-level protocol):**
- [ ] {Task-specific check — e.g., "discard survives page refresh", "error appears within 200ms of failure"}
- [ ] SKILL.md conformance: {specific patterns this task must follow — e.g., "button group follows Action Button Group Spec", "loading state follows row/card-level spec"}
- [ ] Adjacent surface check: {specific surfaces to verify didn't break — e.g., "verify Today page task toggle still works", "verify partner detail scratchpad still renders"}

**Done when:** {Observable outcome, not "code is written". What can the user do? What does the page look like? What behavior changed?}

**Steven checkpoint:** STOP. Report what changed, show verification results, show screenshot if UI changed. Wait for confirmation before next task.
```

---

## Task Complexity Guide

**Micro plan (1-3 tasks, no phases):**
- Single focused fix or feature
- Each task is 15-30 minutes of agent work
- Example: "Add UNIQUE constraint + backfill data + verify"

**Standard plan (4-10 tasks, 2-3 phases):**
- Feature area with related changes
- Each phase groups tasks that share write access or depend on each other
- Example: "Inbox UX overhaul" — Phase 1: detection fixes, Phase 2: mutation framework, Phase 3: visual polish

**Major plan (10-20 tasks, 4-6 phases):**
- Large initiative touching multiple pages or systems
- Phases have explicit dependency gates (Phase 2 can't start until Phase 1 is verified)
- Example: "Daily Driver MVP" — layout, save states, recurrence, people, polish

**Don't go above 20 tasks.** If the scope is bigger, split into sequential plans (Plan 4a, 4b). Each plan should be completable in 1-2 focused sessions.

---

## Pre-flight Guidance

The pre-flight step is what separates good plans from mediocre ones. It forces the agent to understand the current state before changing anything — the same instinct Steven brings to interactive work.

Good pre-flight examples:
- "Read the current InboxClient.tsx and identify every onClick handler" (specific, actionable)
- "Screenshot the partner detail page at 1280px and note any overflow" (visual baseline)
- "Count how many mutation surfaces on this page have loading states" (measurable)
- "Check if useNavigationGuard is already imported on this page" (prevents duplicate work)

Bad pre-flight examples:
- "Understand the codebase" (too vague)
- "Read CLAUDE.md" (the agent does this automatically)
- "Check for issues" (not specific enough to act on)

---

## Adjacent Surface Checks

The most common source of bugs in plan execution is fixing one thing and breaking something related. Adjacent surface checks prevent this.

For each task, identify:
1. **Components that share the same pattern** — if you change how buttons work on inbox, check buttons on tasks page
2. **Components that import the same utility** — if you modify useMutation, check every component that uses it
3. **Pages that display the same data** — if you change how meetings render on partner detail, check meetings list and Today page

The agent must check these BEFORE reporting a task as done.

---

## Steven Checkpoints

Every task ends with a checkpoint. The agent:
1. States what changed (files, behavior, patterns)
2. Shows verification results (tsc, tests, audit)
3. Shows screenshots if UI changed
4. Flags anything unexpected or any scope questions for the next task
5. **Waits.** Does not proceed to the next task.

Steven reviews and either:
- Confirms → agent proceeds to next task
- Adjusts → agent incorporates feedback before proceeding
- Redirects → priorities shift, plan may be updated

Checkpoints are non-negotiable regardless of plan size. They're the mechanism that keeps autonomous execution aligned with Steven's standards.

---

## Plan Lifecycle

1. **Create:** Steven and Claude.ai discuss → Claude.ai generates the plan → Steven pastes to Claude Code → Claude Code writes to `docs/plans/active.md`
2. **Execute:** Claude Code reads plan + CLAUDE.md + relevant docs → works through tasks → checkpoints after each
3. **Complete:** Final verification → completion summary appended → moved to `docs/plans/archive/{date}-{name}.md` → `active.md` reset to placeholder
4. **Handoff:** Session summary captures what was done, what's next, and any process learnings