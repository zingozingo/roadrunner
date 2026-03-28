#!/usr/bin/env bash
#
# UI mechanical audit — run after every task.
# Checks src/app/ and src/components/ for design system violations.
#
# Usage: bash scripts/ui-audit.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCAN_DIRS=("$ROOT/src/app" "$ROOT/src/components")
FAILURES=0

# Exclude patterns for file paths (applied via grep -v)
EXCLUDE='globals\.css\|tailwind\|ui-audit'

check() {
  local label="$1"
  local pattern="$2"
  local extra_exclude="${3:-}"

  local cmd="rg -n --no-heading --glob '*.tsx' --glob '*.ts' '$pattern'"
  for dir in "${SCAN_DIRS[@]}"; do
    cmd="$cmd '$dir'"
  done

  local hits
  hits=$(eval "$cmd" 2>/dev/null | grep -v "$EXCLUDE" || true)
  if [[ -n "$extra_exclude" ]]; then
    hits=$(echo "$hits" | grep -v "$extra_exclude" || true)
  fi

  if [[ -z "$hits" ]]; then
    echo "  PASS  $label"
  else
    echo "  FAIL  $label"
    echo "$hits" | sed 's/^/        /'
    FAILURES=$((FAILURES + 1))
  fi
}

echo "UI Audit — $(date '+%H:%M:%S')"
echo "Scanning: src/app/ src/components/"
echo ""

# 1. Hardcoded hex colors (#fff, #1a1a1a, etc.) — exclude Tailwind arbitrary values like bg-[#...]
check "No hardcoded hex colors" '#[0-9a-fA-F]{3,8}' 'bg-\[#\|text-\[#\|border-\[#\|fill-\[#\|stroke-\[#\|ring-\[#\|from-\[#\|to-\[#\|via-\[#\|shadow-\[#\|outline-\[#\|decoration-\[#\|placeholder-\[#\|divide-\[#\|accent-\[#'

# 2. Off-scale spacing (3, 5, 7, 9, 10, 11, 14)
check "No off-scale spacing classes" '\b(gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)-(3|5|7|9|10|11|14)\b'

# 3. Inline styles
check "No inline style attributes" 'style=\{\{'

# 4. Console.log leftovers
check "No console.log statements" 'console\.log\(' 'eslint-disable\|//.*console'

# 5. TODO/FIXME/HACK markers
check "No TODO/FIXME/HACK markers" '\b(TODO|FIXME|HACK)\b'

echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo "All checks passed."
  exit 0
else
  echo "$FAILURES check(s) failed."
  exit 1
fi
