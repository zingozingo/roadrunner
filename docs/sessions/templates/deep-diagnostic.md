Run a deep session diagnostic for Roadrunner. READ-ONLY — no changes.

1. npx tsc --noEmit
2. npx vitest run --reporter=verbose 2>&1 | tail -40
3. bash scripts/ui-audit.sh
4. git log --oneline -15
5. git status
6. Count: migrations, tables (from latest migration files), components, pages, routes
7. Read the 5 most recent migration files — report what each changed
8. List all API routes in src/app/api/ — methods and one-line purpose
9. List all pages in src/app/ outside api/
10. Read docs/goal-state.md in full
11. Read docs/plans/active.md in full
12. Read CLAUDE.md — flag anything that doesn't match the codebase
13. Read decisions.md — last 10 entries with numbers, titles, status
14. grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx" -l
15. Check for dead imports: tsc --noEmit output

Report in sections:
- Health (tsc, tests, audit)
- Project Stats
- Recent Migrations (last 5)
- API Surface (every route)
- UI Pages (every page)
- Current Status (from goal-state.md)
- Active Plan (from plans/active.md)
- Recent Decisions (last 10)
- Recent Git History (last 15)
- Issues Found (dead code, stale refs, drift, anything wrong)