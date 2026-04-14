# Roadrunner — Session Diagnostic

Run this at the start of every session. One diagnostic, always thorough.

## Health Check
```bash
npx tsc --noEmit
npx vitest run 2>&1 | tail -10
bash scripts/ui-audit.sh
```
Report: tsc [PASS/FAIL] | tests [N passing] | audit [PASS/FAIL]

## Project Stats
```bash
echo "Migrations: $(ls supabase/migrations/*.sql | wc -l)"
echo "Components: $(find src/components -name '*.tsx' | wc -l)"
echo "Pages: $(find src/app -name 'page.tsx' | wc -l)"
echo "Routes: $(find src/app/api -name 'route.ts' | wc -l)"
echo "Tables: 17"
```

## Git State
```bash
git branch --show-current
git status --short
git log --oneline -15
```
Report: Branch [name] · [clean/dirty/N uncommitted]

## Recent Migrations (last 5)
```bash
ls -1 supabase/migrations/*.sql | tail -5 | while read f; do echo "--- $(basename $f) ---"; head -5 "$f"; done
```
Report: What each migration changed (one line each).

## Current Status
```bash
# Extract What's Next section only — don't dump the full file
sed -n '/## What'\''s Next/,/^## /p' docs/goal-state.md | head -30
```

## Active Plan
```bash
head -5 docs/plans/active.md
```
Report: Active plan name and phase, or "No active plan."

## Recent Decisions (last 10)
```bash
tail -40 decisions.md
```

## Doc Freshness
```bash
for f in docs/goal-state.md docs/north-star.md docs/entity-model.md docs/ai-call-map.md .claude/roadrunner-frontend/SKILL.md .claude/roadrunner-backend/SKILL.md; do
  echo "$f: $(git log -1 --format='%ai' -- "$f" | cut -d' ' -f1)"
done
```

## Issues Scan
```bash
grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || echo "None found"
```

## Output Format

```
Session Diagnostic — {date}

Health: tsc [PASS/FAIL] | tests [N passing] | audit [PASS/FAIL]
Stats: [N] migrations · 17 tables · [N] routes · [N] pages · [N] components
Branch: [name] · [clean/dirty]
Active Plan: [name or "No"]
Recent commits:
  {last 15 one-line}
Doc Freshness:
  {file: date} for each
What's Next (from goal-state.md):
  {extracted items}
Recent Decisions: #{first}–#{last}
  {last 10 with titles}
Issues: {any TODO/FIXME hits, or "None"}
```