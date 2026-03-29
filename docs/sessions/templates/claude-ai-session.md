Roadrunner Development Session

I'm Steven, PDM at AWS, building Roadrunner — a partner intelligence platform (Next.js + Supabase + Claude API + Airtable sync).

How we work:
- This chat = planning + strategy. You analyze, plan, generate commands.
- Claude Code CLI = execution. I paste commands, report results.
- Me = bridge. I run commands, steer priorities, make judgment calls.

Principles: Diagnose before building. Plan before implementing. One chunk at a time. Measure twice, cut once.

Two modes:
- Interactive: I direct work, we go chunk by chunk.
- Task mode: We create a structured plan (docs/plans/active.md), Claude Code executes it with more autonomy.

Project docs (Claude Code reads these, you don't need them pasted unless relevant):
- CLAUDE.md — project bible, architecture, working rules
- docs/north-star.md — UI/UX vision
- docs/entity-model.md — schema (23 tables, all FKs, AT field IDs)
- docs/goal-state.md — living status + what's next
- docs/ai-call-map.md — AI pipeline reference
- docs/plans/active.md — current task plan (if any)
- decisions.md — architectural decision log
- .claude/roadrunner-ui/SKILL.md — design system
- .claude/references/ — screenshots + best practices

Airtable MCP is available for direct queries.

Session start: I paste the diagnostic output. You absorb it, flag issues, confirm ready.
Session end: We identify decisions, update goal-state.md, create handoff notes for next session.

Here's the diagnostic:
Then paste the diagnostic output right after.
Template D: Session End Protocol
At the end of every session, three things happen. In this order.
Step 1: Identify Decisions
Review the session and list architectural decisions worth documenting. Use this filter:
Document: Architectural choices, "why X not Y" reasoning, data flow changes, new patterns, schema changes, new conventions.
Skip: Bug fixes, minor UI tweaks, refactors without architectural impact.
Format: Sequential numbers continuing from the last entry in decisions.md.
Step 2: Generate Update Command
One Claude Code command that updates the docs that actually changed. Only update what changed — don't touch docs where nothing is different.
[CONTEXT]
Project: Roadrunner
End of session. {1-sentence summary of what was done}

[REQUIREMENTS]
1. Append these decisions to decisions.md (matching existing format):
   {list decisions with numbers}

2. Update docs/goal-state.md:
   - Move completed items from "What's Next" to "Completed"
   - Add new "What's Next" items: {list}
   - Update stats if changed: {specific stats}

3. Update CLAUDE.md stats if changed:
   - Test count: {N} (was {N})
   - Migration count: {N} (was {N})
   - Decision count: through #{N}
   - {any other stat changes}
   - {any file additions/deletions to directory tree}

4. {ONLY if schema changed}: Update docs/entity-model.md — {specific changes}
5. {ONLY if AI pipeline changed}: Update docs/ai-call-map.md — {specific changes}
6. {ONLY if UI patterns established}: Update .claude/roadrunner-ui/SKILL.md — {specific patterns}
7. {ONLY if task plan completed}: Move docs/plans/active.md to docs/plans/archive/{date}-{name}.md, replace active.md with placeholder

[CONSTRAINTS]
- Append only to decisions.md
- Don't update docs where nothing changed
- Don't touch north-star.md (vision doc — updated separately by Steven)
- Don't touch entity-model.md unless schema actually changed

[VERIFICATION]
- List decisions added
- List docs updated and what changed
- List docs checked but not changed
Step 3: Session Handoff
Brief notes for the next session — not a massive artifact. Just enough to pick up where you left off.
## Session Handoff — {date}

**What was done:** {2-3 sentences}

**Decisions logged:** #{first} through #{last}

**Docs updated:** {list which docs were touched}

**State now:** {1-2 sentences on current state}

**Next session:** {what to work on, any specific plan docs needed}

**Open questions:** {anything unresolved}
For major milestone sessions (completing a big feature, finishing an overhaul), use the comprehensive summary format. But for regular sessions, the handoff above is sufficient.
Comprehensive Summary (use for milestone sessions only)
# Session Summary: {YYYY-MM-DD} — {Session Name}

## What Was Done
{3-5 sentences covering the session's work}

## Stats Change
| Metric | Before | After |
|--------|--------|-------|
| Migrations | {N} | {N} |
| Tests | {N} | {N} |
| Decisions | #{N} | #{N} |

## Decisions Logged
| # | Title | Impact |
|---|-------|--------|
| {N} | {title} | {one-line} |

## Key Insights
{What did we learn? What patterns emerged?}

## Next Steps
1. {Immediate}
2. {Soon}
3. {Later}

## Open Questions
- {Anything unresolved}