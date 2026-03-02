# Architectural Decisions

> Append-only log of significant design and implementation decisions.

---

### Decision 90: Eliminate Single-Engagement Routing Shortcut

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Removed all logic that treated partners with one engagement differently from multi-engagement partners. The number of existing engagements has zero influence on routing.

**Context:** Spacelift Solution Spotlight emails (marketing campaign) were merged into DevOps/OpenTofu Collaboration (technical integration) because Phase 1 Step 3 said "partner has one engagement + content is consistent → route there." This short-circuited before new-engagement detection.

**Rationale:** The count of existing engagements is a database state fact, not a classification signal. A partner having one engagement means you've tracked one initiative — it says nothing about whether the current email belongs to it. Every email must be evaluated by comparing content against engagement context.

**Impact:** Prevents an entire class of wrong-merge bugs. Every email now goes through content evaluation regardless of engagement count.

---

### Decision 91: Enrich Phase 1 Engagement Index with Semantic Context

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Added current_state (truncated to 150 words), topic, and goal fields to each engagement entry in the Phase 1 engagement index.

**Context:** Phase 1 had participant emails, pillar, entity links, and last subject — but no semantic description of what the engagement is actually about. This was insufficient to distinguish engagements with the same partner but different topics.

**Rationale:** The current_state already exists in the DB from Phase 2 analysis. Adding it to Phase 1 context gives the classifier "smarter folder labels" without duplicating Phase 2's deep analysis role. Token cost is minimal (~150 words per engagement).

**Impact:** Phase 1 can now distinguish "Technical collaboration with AWS IaC team on OpenTofu" from "Marketing webinar campaign with Bridge Partners" for the same partner. Directly addresses multi-engagement disambiguation.

---

### Decision 92: Rewrite Decision Framework — Content Evaluation Required

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Replaced 7-step "stop when confident" framework with 6-step framework requiring content evaluation for every routing decision.

**Context:** The old Step 3 short-circuited on partner match alone, bypassing new-engagement detection entirely.

**Rationale:** Ordered "stop when confident" steps are dangerous when early steps use weak signals (partner match). The new framework flows: identify partner → evaluate against ALL engagements → route/new/review. No early exits.

**Impact:** Confidence now reflects actual content match quality. Partner identification alone can never produce high confidence.

---

### Decision 93: Fallback Meeting Detection from Plain Text

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Built two-tier fallback detector for meeting invites that arrive without VCALENDAR data. Tier 1: Outlook "Original Appointment" blocks. Tier 2: Generic When: + Where: patterns. Source type: "body_parsed".

**Context:** Outlook strips ICS when forwarding meeting invites, converting structured calendar data to plain-text blocks. All three existing ICS detection paths (body-calendar, inline body-plain, file attachment) require BEGIN:VCALENDAR. Forwarded meetings were treated as regular emails.

**Rationale:** Can't control how Outlook forwards. The fallback creates real meeting records so the existing pipeline (Phase 1 Meeting Data hint, engagement linking) works without modification. ICS path still takes priority when available.

**Impact:** Meeting invites forwarded from Outlook now get detected and processed. 39 new tests. Requires real-data validation next session.
