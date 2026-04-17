# Roadrunner — Session End

I'm wrapping up this session. Follow this protocol to close it out properly.

## Step 1: Review & Identify Decisions

Look back through EVERYTHING we discussed and decided this session. Identify architectural decisions worth documenting.

**Document these:**
- Architectural choices that affect how the system works
- "Why X not Y" reasoning that future sessions need to know
- Data flow changes, storage changes, system behavior changes
- New patterns established (UI patterns, code patterns, workflow patterns)
- Schema changes and their rationale
- New conventions that should be followed going forward

**Skip these:**
- Bug fixes without architectural impact
- Minor UI tweaks (spacing adjustments, color changes)
- Refactors that don't change behavior

**Format:** Sequential numbers continuing from the last entry in decisions.md. Present them to me as a numbered list with title and brief impact statement BEFORE generating the command. I may want to adjust wording or add/remove entries.

## Step 2: Write Session Summary

Write the session summary as a downloadable markdown artifact. Use the default format below (or milestone format for big sessions). Steven reviews and approves before it gets embedded in the command.

**Why Claude.ai writes it:** Claude.ai has the full conversation context — every diagnosis, decision, and course correction. Claude Code only knows what's in the command. Content comes from where the context lives.

## Step 3: Generate ONE Claude Code Command

After I approve both the decisions list AND the session summary, generate a single implementation command that does ALL of the following. The session summary content from Step 2 should be embedded directly in the command — Claude Code places the file, it doesn't write the content.

The command must:

**Read first:**
- `decisions.md` — check current last decision number and format
- `docs/goal-state.md` — check current status descriptions and stats
- `CLAUDE.md` — check current stats in header banner, directory tree, and test matrix

**Then update:**

1. **decisions.md** — Append new decisions matching the existing format (sequential numbers). Update any previously "Planned" decisions to "Implemented" if they were built this session.

2. **docs/goal-state.md:**
   - Move completed items from "What's Next" to "Completed" with decision references
   - Add new "What's Next" items based on what we identified during the session
   - Update stats if they changed: migration count, table count, test count, component count, page count, route count
   - Update the current state description to reflect what was built

3. **CLAUDE.md** — Only if stats changed:
   - Header banner (migrations, tables, routes, pages, tests)
   - Directory structure tree (if files added/deleted)
   - Component listings (if components added/deleted)
   - Decision count in documentation map
   - Session management section (if template files changed — e.g., diagnostic.md replacing quick/deep)
   - Any other references to specific counts

4. **Conditional updates (only if relevant work was done):**
   - `docs/entity-model.md` — ONLY if schema changed (new table, new field, new FK, dropped table)
   - `docs/ai-call-map.md` — ONLY if AI pipeline changed (prompt rewrite, new context, new call)
   - `.claude/roadrunner-frontend/SKILL.md` — ONLY if UI patterns were established or evolved
   - `.claude/roadrunner-backend/SKILL.md` — ONLY if backend patterns were established or evolved (new service patterns, route conventions, db layer rules)
   - `docs/plans/active.md` — If a plan was completed: append "## Completion Summary" (what was accomplished across all phases, total stats change before/after, total decisions logged, pre-existing issues noted for future work), then move to `docs/plans/archive/{date}-{name}.md`, then replace `active.md` with placeholder content: "# Active Task Plan\n\nNo active task plan. Working in interactive mode."

5. **Create empty session summary file** at `docs/sessions/summaries/{YYYY-MM-DD}-{session-name}.md` — the file should be empty so Steven can paste the approved content from Claude.ai

6. **Update session end template** (`docs/sessions/templates/session-end.md`) — if the template doesn't already include a step to create an empty session summary file, add one

Use this command structure:
```
[CONTEXT]
Project: Roadrunner
End of session. {1-2 sentence summary of what was done}

[REQUIREMENTS]
Read current decisions.md — note last number and format
Append these decisions:

#{N} — {Title}: {Details}
#{N+1} — {Title}: {Details}
{list all decisions}


Update docs/goal-state.md:
- Completed: {items to move}
- New What's Next: {items to add}
- Stats: {specific changes}


Update CLAUDE.md stats: {specific changes, or "no changes needed"}

{Conditional: entity-model.md changes}
{Conditional: ai-call-map.md changes}
{Conditional: SKILL.md changes}
{Conditional: plan archiving}

Write session summary to docs/sessions/summaries/{date}-{name}.md:

Session Summary: {date} — {name}

What was done:
{Thorough summary — not just what files changed, but what was accomplished and why it matters. Include the key technical details someone picking up next session needs to know. 5-10 sentences for a normal session, more for milestones.}

Key changes:
{Bullet list of the most important things that changed — new features, schema changes, deleted code, new patterns established, workflow changes. Be specific: "Added anchor_day column to meetings table" not just "updated meetings."}

Decisions logged: #{first} through #{last}
{One-line summary of each decision}

Docs updated: {list every doc that was modified and what changed in each}

Current state:
{2-3 sentences on the overall project state. Stats, health, what's working, any known issues.}

Next session priorities:
1. {Most important thing to do next — with enough context to start working}
2. {Second priority}
3. {Third priority}

Open questions:
- {Anything unresolved that needs future discussion}

Pre-existing issues:
- {Bugs or quality issues spotted but not fixed this session}

Process learnings:
- {What worked well this session that should be repeated?}
- {What didn't work that should be done differently?}
- {Any workflow improvements, template changes, or tool gaps identified?}
- {Did the SKILL.md need patterns that weren't there? Did plan execution miss checkpoints?}


[CONSTRAINTS]
- Append only to decisions.md — don't modify existing entries
- Only update docs where state actually changed
- Never touch north-star.md (vision doc — Steven updates manually)
- Never touch entity-model.md unless schema actually changed this session
- Read actual current values before updating any stats — don't assume

[VERIFICATION]
- List decisions added with numbers
- List docs updated and what changed in each
- List docs checked but not changed
- Confirm session summary written to docs/sessions/summaries/
- Show the session summary content
```

## For Milestone Sessions (big features, plan completions, overhauls)

Use this expanded summary format instead of the default:

```
Session Summary: {YYYY-MM-DD} — {Session Name}

What was done:
{Detailed narrative: 10-15 sentences covering the full scope of work, the reasoning behind key decisions, what challenges were encountered, and how they were resolved.}

Stats change:
| Metric | Before | After |
|--------|--------|-------|
| Migrations | {N} | {N} |
| Tables | {N} | {N} |
| Tests | {N} | {N} |
| Components | {N} | {N} |
| Pages | {N} | {N} |
| Decisions | #{N} | #{N} |

Key changes:
{Detailed bullet list}

Decisions logged:
| # | Title | Impact |
|---|-------|--------|
| {N} | {title} | {one-line impact} |

Key insights:
{What did we learn? What patterns emerged? What should we do differently next time? 2-4 paragraphs.}

Docs updated: {detailed list}

Current state: {thorough description}

Next session priorities:
1. Immediate: {task with full context}
2. Soon: {task with context}
3. Later: {task with context}

Open questions:
- {detailed questions}

Pre-existing issues:
- {detailed issues with context}

Process learnings:
- {What worked? What didn't? What changes to make?}
```

---

*Present the decisions list first (Step 1). Then write the session summary artifact (Step 2). I'll approve both, then you generate the command (Step 3).*