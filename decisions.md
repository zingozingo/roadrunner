# Architectural Decisions

---

## 2026-03-01 - Compiler-Driven Refactoring Pattern

**Decision:** When removing fields from shared TypeScript interfaces, strip them from types FIRST, then use `tsc --noEmit` errors as an exhaustive task list for all consumers.

**Context:** Phase 3 required removing 12 scalar contact columns referenced across 19 files and 75 locations. Manual search would miss edge cases.

**Rationale:** The compiler catches 100% of typed references. Tests use runtime data so they keep passing during refactor, giving a stable baseline. Fix compile errors file by file, run tests after each chunk.

**Impact:** Reusable pattern for any future cross-cutting interface change. Applied successfully: 72 errors → 0 across 4 chunks with zero regressions.

---

## 2026-03-01 - Phase 3 Complete — Single JSONB Contact Data Path

**Decision:** All contact consumers (UI, API, lib, prompts, sync) now read exclusively from JSONB columns (aws_team, partner_contacts, contacts). Dual-write removed from pull.ts. Migration 048 drops 12 legacy scalar columns.

**Context:** Phase 1 created JSONB columns + parser, Phase 2 populated them with dual-write for backward compatibility, Phase 3 cuts over all consumers and removes the bridge.

**Rationale:** Dual-write was always transitional. Maintaining two data paths creates divergence risk and doubles the bug surface area. With all 19 consumer files migrated and verified, the old path is pure liability.

**Impact:** contact-parser.ts is the universal format handler. One data path from Airtable through classification through display. Enables richer contact context in classifier prompts.

---

## 2026-03-01 - FIELD-MAPPING.md as Verified Sync Contract

**Decision:** FIELD-MAPPING.md fully rewritten from live Airtable schema (via MCP connector) cross-referenced against code (field-maps.ts audit). Must be updated whenever field-maps.ts changes.

**Context:** Previous version had 9 deleted field IDs still listed, 13 undocumented field IDs, and 1 ghost URL field. The doc was actively misleading.

**Rationale:** The field mapping doc serves two audiences — Steven (reference) and Claude Code (session context). Accuracy is non-negotiable for the latter. MCP connector makes live verification trivial.

**Impact:** Every field ID in the doc is now verified against both live Airtable and running code. Changelog section added to track future updates.

---

## 2026-03-01 - Chunked Refactoring Sequence

**Decision:** Large cross-cutting refactors follow the sequence: Types → Lib → UI → API/Tests → Migration. Each chunk verified independently with measurable error-count targets before proceeding.

**Context:** Phase 3 touched 19 files across every layer. Doing it all at once would make failures impossible to diagnose.

**Rationale:** Types first creates the compiler safety net. Lib before UI because UI depends on lib. API and tests last because they're leaf nodes. Migration absolutely last because it's irreversible. Error count targets (72 → 66 → 23 → 0) make progress visible.

**Impact:** Establishes the standard refactoring pattern for Roadrunner. Each chunk is independently committable and verifiable.
