# Plan Completion Template

Paste everything below the `---` line directly into Claude Code after a plan is finished. No editing needed.

**Prerequisites:** All plan tasks are done and committed on the plan branch. You've created the draft PR yourself.

---

```
Finalize the completed plan. Do all of the following in order, without stopping to ask me anything:

1. Detect current state:
   - Read docs/plans/active.md to identify the plan number, name, and scope
   - Run `git branch --show-current` to identify the plan branch
   - Run `git log main..HEAD --oneline` to see all commits on this branch
   - Read decisions.md to find the last decision number
   - Read docs/goal-state.md for current stats and "What's Next" items
   - Read CLAUDE.md for structural context (no stats — those are in goal-state.md)

2. Derive decisions from the plan work:
   Review the plan and git log. Identify architectural decisions worth logging — new patterns established, new conventions, structural changes. Skip routine extractions and minor cleanup. Append them to decisions.md continuing from the last number.

3. Update docs/goal-state.md:
   - Move completed items from "What's Next" to "Completed" with decision references
   - Update stats if changed (check git log for migration/component/route/file count changes)
   - Add new "What's Next" items based on what the plan's completion summary or next session priorities suggest

4. Update CLAUDE.md — ONLY if structural changes occurred:
   - New directory in key layout list
   - New gotcha or "What NOT to Do" entry
   - New behavioral pattern or procedural checklist
   - Do NOT update for stats — all stats live in `docs/goal-state.md` only

5. Archive the plan:
   - Append a "## Completion Summary" section to docs/plans/active.md with: what was accomplished, stats change table, decisions logged
   - Copy active.md to docs/plans/archive/{today's date}-{plan-kebab-name}.md
   - Replace active.md contents with: "# Active Task Plan\n\nNo active task plan. Working in interactive mode."

6. Write session summary:
   Write to docs/sessions/summaries/{today's date}-plan-{N}-{plan-kebab-name}.md
   Include: what was done (thorough narrative), stats change table, key changes (bullets), decisions logged (table), docs updated, current state, next session priorities, open questions, pre-existing issues, process learnings. Use the milestone session summary format since this is a plan completion.

7. Commit all doc updates:
   git add -A && git commit -m "docs: session end — Plan {N} completion, decisions #{first}-#{last}, archive plan"

8. Merge to main and clean up:
   git checkout main
   git pull origin main
   git merge {the plan branch}
   git push origin main
   git branch -d {the plan branch}
   git push origin --delete {the plan branch}
   If merge conflicts occur: STOP and report them. Do not auto-resolve.

9. Verify final state:
   - Confirm on main branch with clean working tree
   - Confirm plan branch deleted locally and remotely
   - npx tsc --noEmit
   - npx vitest run
   - Report: decisions added, docs updated, branch state, tsc/test results

Constraints:
- Append only to decisions.md — never modify existing entries
- Read actual current values before updating any stats
- Never touch north-star.md or ai-call-map.md unless AI pipeline changed
- Never touch entity-model.md unless schema changed
- The merge target is always main
```