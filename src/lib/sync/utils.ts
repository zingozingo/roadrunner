// ── Coercion helpers ────────────────────────────────────────

export function str(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val).trim();
}

export function strArr(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  return [];
}

/** Coerce Airtable multipleSelects (string[]) to string[]; wraps a single string; defaults to [] */
export function arr(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  if (typeof val === "string" && val.trim()) return [val.trim()];
  return [];
}

/** Extract .name from Airtable single-select object, or return string as-is */
export function selectName(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "object" && val !== null && "name" in val) {
    const name = (val as { name: unknown }).name;
    return typeof name === "string" ? name.trim() || null : null;
  }
  return null;
}

// ── Comparison helpers ──────────────────────────────────────

/** Compare two values for equality (handles null, arrays, strings) */
export function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

/** Check if any mapped field differs from the existing record */
export function hasChanges(
  mapped: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  for (const [key, val] of Object.entries(mapped)) {
    if (!eq(val, existing[key])) return true;
  }
  return false;
}

// ── Valid value sets (must match DB CHECK constraints) ───────

export const VALID_PROGRAM_CATEGORIES = new Set([
  "Specialization", "Funding", "Agreement", "Operational", "Enablement",
]);

export const VALID_PROGRAM_SUBTYPES = new Set([
  "Competency", "Service Ready", "MSP", "Sub-Category", "MDF", "Credit Program",
  "Hybrid", "SCA", "Co-Sell", "Channel", "Migration", "Workshop", "Certification",
]);

export const VALID_EVENT_TYPES = new Set([
  "conference", "summit", "workshop", "kickoff", "trade_show",
  "deadline", "review_cycle", "training",
]);

export const VALID_RELATIONSHIP_TYPES = new Set([
  "Exec/Leader", "Product Team", "Program Team", "Seller",
]);

export const VALID_LIFECYCLE_TYPES = new Set([
  "indefinite", "recurring", "expiring",
]);

// ── Status maps ─────────────────────────────────────────────

export const STATUS_TO_AIRTABLE: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

export const MEETING_STATUS_MAP: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  did_not_occur: "Did Not Occur",
};

/** Map DB lowercase status to Airtable title-case */
export function mapMeetingStatus(dbStatus: string): string {
  const mapped = MEETING_STATUS_MAP[dbStatus];
  if (!mapped) {
    console.warn(`Unknown meeting status "${dbStatus}" — passing through unmapped`);
    return dbStatus;
  }
  return mapped;
}
