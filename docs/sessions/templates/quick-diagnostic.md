Run a quick session diagnostic for Roadrunner. READ-ONLY — no changes.

1. npx tsc --noEmit (pass/fail only)
2. npx vitest run 2>&1 | tail -5 (pass/fail + count)
3. bash scripts/ui-audit.sh (pass/fail)
4. git log --oneline -10
5. git status (clean/dirty)
6. Count: migrations (ls supabase/migrations | wc -l), components (find src/components -name "*.tsx" | wc -l), pages (find src/app -name "page.tsx" | wc -l), routes (find src/app/api -name "route.ts" | wc -l)
7. Read docs/goal-state.md — report ONLY the "What's Next" section
8. Read docs/plans/active.md — is there an active task plan?
9. Check doc freshness: for each file in docs/, show last git commit date
10. grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx" -l (any hits?)

Output format — compact:
- Health: tsc [pass/fail] | tests [N passing] | audit [pass/fail]
- Stats: [N] migrations · [N] tables · [N] routes · [N] pages · [N] components
- Branch: [name] · [clean/dirty]
- Active Plan: [yes — name / no]
- Recent commits: [last 10 one-line]
- What's Next: [from goal-state.md]
- Doc Freshness: [file: last modified date] for each doc
- Issues: [any TODO/FIXME hits, any drift]