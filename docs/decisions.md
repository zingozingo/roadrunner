# Architectural Decision Records

## ADR-1: Universal contact format Name \<email\> (Title)

- **Decision**: All contact storage uses `Name <email> (Title)` with `<—>` for missing email, `(—)` for missing title. Newline-separated in multi-person fields.
- **Context**: 11 inconsistent contact storage patterns across Partners (9 fields) and AWS Relationships (4 fields) — separate name/email columns, text arrays, raw strings.
- **Rationale**: One format, one parser. Self-documenting placeholders make incomplete data visible at a glance. Newlines are unambiguous delimiters.
- **Impact**: `contact-parser.ts` is the single parse/render path. All sync pull/push, name resolution, and prompt building flows through this format.

---

## ADR-2: Role vs Title separation

- **Decision**: Airtable column name defines role (PSA, Alliance Lead). Parenthetical is job title (Partner Solutions Architect). Both stored but serve different purposes.
- **Context**: Classifier was writing role labels like "stakeholder" into the title column, polluting it with non-title data.
- **Rationale**: Roles are structural (what function someone serves). Titles are identity (what they're called). Classifier needs both for accurate engagement categorization.
- **Impact**: `participant_links.role` holds classifier labels. `participants.title` reserved for real job titles only. No blocklist or heuristic needed.

---

## ADR-3: JSONB dual-column architecture

- **Decision**: Partners get `aws_team` (PSA, AM, PMM) and `partner_contacts` (Alliance Lead, Contacts) as separate JSONB arrays. AWS Relationships get `contacts` JSONB. Meetings get `organizer_name` text.
- **Context**: Contact data was scattered across 13+ scalar columns with no structured querying capability.
- **Rationale**: JSONB arrays of `{name, email, title, role}` objects enable structured queries, role-aware lookups, and clean rendering. Org-boundary separation (AWS staff vs partner staff) reflects real-world distinction.
- **Impact**: Name resolver reads JSONB instead of scanning 8+ scalar columns. Prompts render richer contact context. Foundation for UI contact cards in Phase 3.

---

## ADR-4: Dual-write transition strategy

- **Decision**: Sync pull writes both new JSONB columns and old scalar columns simultaneously. UI reads old columns during transition.
- **Context**: UI pages (partners/[id], relationships/[id]) still reference old column names.
- **Rationale**: Zero-downtime migration. Nothing breaks during transition. Old columns become dead code only when UI switches to JSONB reads.
- **Impact**: Phase 3 scope is clear: update UI to read JSONB, drop old columns, remove dual-write code.

---

## ADR-5: Fetch-all-and-filter for name resolution (not JSONB containment)

- **Decision**: Name resolver continues fetch-all-and-filter-in-memory pattern, just reading from JSONB columns instead of scalar columns.
- **Context**: Postgres JSONB containment queries (`@>`) are more efficient at scale but add SQL complexity.
- **Rationale**: 20 partners + 7 relationships = trivial dataset. JSONB containment is premature optimization. Same proven pattern, new data source.
- **Impact**: Simpler code, easier debugging. Revisit if partner count grows 10x+.

---

## ADR-6: contact-parser.ts as single source of truth

- **Decision**: All `Name <email> (Title)` parsing and rendering goes through one utility file. No ad-hoc regex elsewhere.
- **Context**: Contact format logic was scattered across pull.ts, push.ts, name-resolver.ts with inconsistent parsing.
- **Rationale**: One format = one parser. Future format changes touch one file. 26 tests cover all edge cases.
- **Impact**: `parseContact`, `parseRoleContact`, `parseContactList`, `renderContact`, `renderContactList` are the only contact format functions in the codebase.
