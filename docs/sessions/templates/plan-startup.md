# Roadrunner — Plan Execution Startup

Paste this into a fresh Claude Code session to kick off plan execution.

---

We're starting a plan execution session for Roadrunner.

**Step 1: Run the diagnostic.**
Read and execute `docs/sessions/templates/diagnostic.md`. Show me the compact output.

**Step 2: Read these docs IN THIS ORDER** (each one builds on the previous):
1. `CLAUDE.md` — project bible, architecture, working rules, verification protocol
2. `docs/plans/active.md` — the task plan you'll be executing
3. `docs/sessions/templates/plan-template.md` — the plan structure standard (understand what pre-flight, verification, and Steven checkpoints mean)
4. `docs/north-star.md` — vision spec, especially sections relevant to the current plan
5. `docs/goal-state.md` — current status, what's done, what's next
6. `.claude/roadrunner-frontend/SKILL.md` — design system authority (three layers: visual, interaction, data visualization). Pay special attention to the Mutation Lifecycle Framework if the plan involves any interactive behavior.
7. `docs/entity-model.md` — schema reference (only if the plan involves data/schema work)
8. `docs/ai-call-map.md` — AI call breakdown (only if plan involves AI brain work)

**Step 3: Orient me.**
After reading everything, give me:
- A 2-3 sentence summary of the plan's scope and what it delivers
- The total task count and phase structure
- Any concerns, contradictions, or ambiguities you spotted between the plan and the current codebase state
- Which SKILL.md patterns are relevant to this plan's first phase
- Your proposed approach for Task 1: what you'll do in the pre-flight step, what you'll read, what you'll check BEFORE writing any code

**Step 4: Wait for my go.**
Do NOT start implementing until I confirm. I may have context from the planning session that adjusts priorities.

---

## WORKING RULES FOR THIS SESSION

**Task execution flow (every task, no exceptions):**
1. **Pre-flight:** Read the SKILL.md sections listed in the task. Run the diagnostic specified. Check adjacent surfaces. Report what you found BEFORE coding.
2. **Implement:** Make the changes specified in the task.
3. **Verify:** Run the plan-level verification protocol (tsc, tests, audit, screenshots if UI, SKILL.md conformance). Run any task-specific verification checks.
4. **Adjacent check:** Verify the specific adjacent surfaces listed in the task weren't broken.
5. **Commit:** One commit per task with descriptive message.
6. **Checkpoint:** Report what changed, show verification results, show screenshots if applicable. **STOP and wait for confirmation.**

**Quality standards:**
- Check in after EVERY task. Show what changed, verify results, wait for confirmation before next task.
- Playwright screenshots for ANY visual changes — before and after, at 1280px minimum.
- Update SKILL.md when you establish new patterns (slot into the appropriate layer).
- If something doesn't match what the plan describes, STOP and tell me. Don't improvise around contradictions.
- Read actual file contents before modifying. Never assume you know what a file contains.
- Think universally — any pattern you establish on one page should be evaluated for system-wide consistency.
- No silent failures — every error catch must surface to the user (per Mutation Lifecycle Framework).

**After the first task:**
Commit and push. Report to me: "First task committed and pushed to `{branch}`. Ready for you to create the draft PR on GitHub." Wait for confirmation before continuing.