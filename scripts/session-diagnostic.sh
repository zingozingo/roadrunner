#!/usr/bin/env bash
# session-diagnostic.sh — Read-only project health check for session start.
# Usage: bash scripts/session-diagnostic.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "============================================"
echo "  ROADRUNNER SESSION DIAGNOSTIC"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "============================================"
echo ""

# 1. Test Results
echo "── 1. TEST RESULTS ──────────────────────────"
npx vitest run --reporter=verbose 2>&1 | tail -10 || true
echo ""

# 2. Project Stats
echo "── 2. PROJECT STATS ────────────────────────"
MIGRATIONS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
TABLES=$(grep -c "CREATE TABLE" supabase/migrations/*.sql 2>/dev/null || echo 0)
ROUTES=$(find src/app/api -name "route.ts" 2>/dev/null | wc -l | tr -d ' ')
PAGES=$(find src/app -name "page.tsx" -not -path "*/api/*" 2>/dev/null | wc -l | tr -d ' ')
COMPONENTS=$(find src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "  Migrations:  $MIGRATIONS"
echo "  API Routes:  $ROUTES"
echo "  UI Pages:    $PAGES"
echo "  Components:  $COMPONENTS"
echo ""

# 3. Directory Structure (2 levels)
echo "── 3. DIRECTORY STRUCTURE (src/) ────────────"
find src -maxdepth 2 -type d | sort
echo ""

# 4. API Routes
echo "── 4. API ROUTES ───────────────────────────"
find src/app/api -name "route.ts" | sort | sed 's|src/app/api/||;s|/route.ts||'
echo ""

# 5. Recent Decisions (last 5)
echo "── 5. RECENT DECISIONS ─────────────────────"
grep "^### Decision" decisions.md | tail -5
echo ""

# 6. Current Status (goal-state.md — What's Next section)
echo "── 6. CURRENT STATUS ─────────────────────────"
echo "From docs/goal-state.md:"
sed -n '/^## What'\''s Next/,/^## /p' docs/goal-state.md | head -20
echo ""

# 7. Git Status
echo "── 7. GIT STATUS ───────────────────────────"
echo "  Branch: $(git branch --show-current)"
echo "  Last commit: $(git log --oneline -1)"
AHEAD=$(git rev-list --count @{upstream}..HEAD 2>/dev/null || echo "?")
echo "  Ahead of origin: $AHEAD"
git status --short 2>/dev/null || true
echo ""

echo "============================================"
echo "  DIAGNOSTIC COMPLETE"
echo "============================================"
