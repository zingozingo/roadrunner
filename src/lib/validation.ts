// Canonical validation constants — single source of truth for all enum validation.
// Route files and sync/ import from here. Never define VALID_* constants locally.

import type { Pillar, ProgramCategory, ProgramSubtype, RecurrencePattern } from "./types";
import type { Event } from "./types";

// ── Engagement ──────────────────────────────────────────────

export const VALID_ENGAGEMENT_STATUSES = new Set([
  "active", "blocked", "completed", "archived",
] as const);

export const VALID_ENGAGEMENT_PILLARS = new Set<Pillar>([
  "Co-Sell", "Co-Market", "Co-Build",
]);

// ── Meeting ─────────────────────────────────────────────────

export const VALID_MEETING_STATUSES = new Set([
  "scheduled", "completed", "cancelled", "did_not_occur",
] as const);

export const VALID_RECURRENCE_PATTERNS = new Set<RecurrencePattern>([
  "weekly", "biweekly", "monthly", "quarterly",
]);

// ── Program ─────────────────────────────────────────────────

export const VALID_PROGRAM_CATEGORIES = new Set<ProgramCategory>([
  "Specialization", "Funding", "Agreement", "Operational", "Enablement",
]);

export const VALID_PROGRAM_SUBTYPES = new Set<ProgramSubtype>([
  "Competency", "Service Ready", "MSP", "Sub-Category", "MDF", "Credit Program",
  "Hybrid", "SCA", "Co-Sell", "Channel", "Migration", "Workshop", "Certification",
]);

// ── Event ───────────────────────────────────────────────────

export const VALID_EVENT_TYPES = new Set<Event["type"]>([
  "conference", "summit", "workshop", "trade_show",
  "training", "webinar", "roundtable",
]);

export const VALID_LIFECYCLE_TYPES = new Set([
  "indefinite", "recurring", "expiring",
] as const);

// ── Enrollment & Event Participation ────────────────────────

export const VALID_ENROLLMENT_STATUSES = new Set([
  "not_started", "in_progress", "submitted", "approved",
  "interested", "denied", "expired",
] as const);

export const VALID_EVENT_PARTICIPATION_STATUSES = new Set([
  "interested", "invited", "registered", "attended", "declined",
] as const);

// ── Task ────────────────────────────────────────────────────

export const VALID_TASK_OWNERS = new Set([
  "me", "internal", "partner", "third_party",
] as const);

// ── Sync ────────────────────────────────────────────────────

export const VALID_SYNC_ENTITIES = new Set([
  "partners", "programs", "events", "engagements", "meetings",
] as const);

// ── Validation helper ───────────────────────────────────────

/**
 * Validate a value against a Set of allowed values.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateEnum(
  field: string,
  value: string,
  validSet: ReadonlySet<string>,
): string | null {
  if (!validSet.has(value)) {
    return `${field} must be one of: ${[...validSet].join(", ")}`;
  }
  return null;
}
