/**
 * Airtable → Supabase catalog sync.
 * One-way pull: Airtable is source of truth for Programs, Events, AWS Relationships.
 * Matches by airtable_record_id first, then by name. Never deletes Supabase records.
 */

import { fetchAllRecords, fetchRecordMap, type AirtableRecord } from "./airtable";
import { getSupabaseClient } from "./supabase";

// ── Airtable table IDs ──────────────────────────────────────
const PROGRAMS_TABLE = "tblpnW8ibVmkWi5Dt";
const EVENTS_TABLE = "tblPDGUSqSvn8mflJ";
const RELATIONSHIPS_TABLE = "tblqVBssFsUeAt9bj";
const PARTNERS_TABLE = "tbl9zC6nxfLEp8xUx";

// ── Airtable field IDs ──────────────────────────────────────

const PF = {
  name: "fldlJgX0tVWwA516E",
  type: "fldCd7TnUOgxnWmNt",
  description: "fldHN5mCWH6lXmoY1",
  requirements: "fldxxsFFMc649nZft",
  lifecycle: "fldo04XmU7rQhwOVT",
  lifecycleDuration: "fldeExdR8irrzC5GV",
  url: "fldj2uk4rf4ifqGLH",
} as const;

const EF = {
  name: "fld1hURggkL0DTHnC",
  date: "fld62hHfwpOJw7nyZ",
  endDate: "fldTUy6jHj4KpR6SZ",
  location: "fldwjmRq0saFpFHao",
  format: "fldpuxeQ5DRhMwizr",
  host: "fldaDlidcRmUCvxFK",
  description: "fldTMiRJ7mqMzGqXY",
} as const;

const RF = {
  name: "fldeiFljVC5L61c3v",
  partners: "fldJHZfq28s58iuwX",
  awsOrg: "fldKSmvO7Lhr5v9Fy",
  awsService: "fldiieBBkkAFYDOJC",
  type: "fld2cjVCECNIPGw2d",
  primaryContact: "fldhCrECNQ0uBA2tD",
  primaryContactEmail: "fldoWXiosjUJBPDqF",
  awsContactEmails: "fldEu6kRhcn1929CA",
  strength: "fld5nwBVIb7rKBUhj",
  notes: "fldOcbNUrtfxjqiW5",
} as const;

// Partners table — "Partner Name" field ID
const PARTNER_NAME_FIELD = "fldxxx"; // We'll fetch by name field; see fetchRecordMap usage

export interface SyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────

function str(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val).trim();
}

function strArr(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  return [];
}

/** Compare two values for equality (handles null, arrays, strings) */
function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

/** Check if any mapped field differs from the existing record */
function hasChanges(
  mapped: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  for (const [key, val] of Object.entries(mapped)) {
    if (!eq(val, existing[key])) return true;
  }
  return false;
}

// ── Valid value sets (must match DB CHECK constraints) ───────

const VALID_PROGRAM_TYPES = new Set([
  "Competency", "Service Ready", "SCA", "Program", "Credit Program",
]);

const VALID_EVENT_TYPES = new Set([
  "conference", "summit", "workshop", "kickoff", "trade_show",
  "deadline", "review_cycle", "training",
]);

const VALID_RELATIONSHIP_TYPES = new Set([
  "Exec/Leader", "Product Team", "Program Team", "Seller",
]);

const VALID_STRENGTHS = new Set([
  "Strong", "Building", "New", "Deferred",
]);

const VALID_LIFECYCLE_TYPES = new Set([
  "indefinite", "recurring", "expiring",
]);

// ── Programs sync ───────────────────────────────────────────

function mapProgram(rec: AirtableRecord): Record<string, unknown> | null {
  const name = str(rec.fields[PF.name]);
  if (!name) return null;

  const rawType = str(rec.fields[PF.type]);
  const type = rawType && VALID_PROGRAM_TYPES.has(rawType) ? rawType : null;

  const rawLifecycle = str(rec.fields[PF.lifecycle]);
  const lifecycle = rawLifecycle && VALID_LIFECYCLE_TYPES.has(rawLifecycle)
    ? rawLifecycle
    : "indefinite";

  return {
    name,
    type,
    description: str(rec.fields[PF.description]),
    eligibility: str(rec.fields[PF.requirements]),
    url: str(rec.fields[PF.url]),
    lifecycle_type: lifecycle,
    lifecycle_duration: str(rec.fields[PF.lifecycleDuration]),
  };
}

export async function syncPrograms(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [atRecords, { data: dbRows, error: fetchErr }] = await Promise.all([
    fetchAllRecords(PROGRAMS_TABLE),
    supabase.from("programs").select("*"),
  ]);

  if (fetchErr) throw new Error(`Failed to fetch programs: ${fetchErr.message}`);
  const existing = dbRows ?? [];

  // Build lookup maps
  const byAtId = new Map(existing.filter((r) => r.airtable_record_id).map((r) => [r.airtable_record_id, r]));
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));

  for (const rec of atRecords) {
    try {
      const mapped = mapProgram(rec);
      if (!mapped) {
        result.errors.push(`Skipped record ${rec.id}: missing name`);
        continue;
      }

      // Find existing match
      const match = byAtId.get(rec.id) ?? byName.get((mapped.name as string).toLowerCase());

      if (match) {
        // Check if anything changed
        const fieldsToCompare = { ...mapped, airtable_record_id: rec.id };
        if (!hasChanges(fieldsToCompare, match)) {
          result.unchanged++;
          continue;
        }

        const { error } = await supabase
          .from("programs")
          .update({ ...mapped, airtable_record_id: rec.id })
          .eq("id", match.id);

        if (error) {
          result.errors.push(`Update program "${mapped.name}": ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        const { error } = await supabase
          .from("programs")
          .insert({ ...mapped, airtable_record_id: rec.id, status: "active" });

        if (error) {
          result.errors.push(`Insert program "${mapped.name}": ${error.message}`);
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      result.errors.push(`Record ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return result;
}

// ── Events sync ─────────────────────────────────────────────

function mapEvent(rec: AirtableRecord): Record<string, unknown> | null {
  const name = str(rec.fields[EF.name]);
  if (!name) return null;

  const rawType = str(rec.fields[EF.format]);
  const type = rawType && VALID_EVENT_TYPES.has(rawType) ? rawType : "conference";

  return {
    name,
    type,
    start_date: str(rec.fields[EF.date]),
    end_date: str(rec.fields[EF.endDate]),
    location: str(rec.fields[EF.location]),
    host: str(rec.fields[EF.host]),
    description: str(rec.fields[EF.description]),
  };
}

export async function syncEvents(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [atRecords, { data: dbRows, error: fetchErr }] = await Promise.all([
    fetchAllRecords(EVENTS_TABLE),
    supabase.from("events").select("*"),
  ]);

  if (fetchErr) throw new Error(`Failed to fetch events: ${fetchErr.message}`);
  const existing = dbRows ?? [];

  const byAtId = new Map(existing.filter((r) => r.airtable_record_id).map((r) => [r.airtable_record_id, r]));
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));

  for (const rec of atRecords) {
    try {
      const mapped = mapEvent(rec);
      if (!mapped) {
        result.errors.push(`Skipped record ${rec.id}: missing name`);
        continue;
      }

      const match = byAtId.get(rec.id) ?? byName.get((mapped.name as string).toLowerCase());

      if (match) {
        const fieldsToCompare = { ...mapped, airtable_record_id: rec.id };
        if (!hasChanges(fieldsToCompare, match)) {
          result.unchanged++;
          continue;
        }

        const { error } = await supabase
          .from("events")
          .update({ ...mapped, airtable_record_id: rec.id })
          .eq("id", match.id);

        if (error) {
          result.errors.push(`Update event "${mapped.name}": ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        const { error } = await supabase
          .from("events")
          .insert({
            ...mapped,
            airtable_record_id: rec.id,
            source: "seed",
            verified: true,
          });

        if (error) {
          result.errors.push(`Insert event "${mapped.name}": ${error.message}`);
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      result.errors.push(`Record ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return result;
}

// ── AWS Relationships sync ──────────────────────────────────

function mapRelationship(
  rec: AirtableRecord,
  partnerMap: Map<string, string>
): Record<string, unknown> | null {
  const name = str(rec.fields[RF.name]);
  if (!name) return null;

  const rawType = str(rec.fields[RF.type]);
  const relationshipType = rawType && VALID_RELATIONSHIP_TYPES.has(rawType) ? rawType : null;

  const rawStrength = str(rec.fields[RF.strength]);
  const strength = rawStrength && VALID_STRENGTHS.has(rawStrength) ? rawStrength : null;

  // Resolve partner linked record IDs to names
  const partnerIds = rec.fields[RF.partners];
  let partnerName: string | null = null;
  if (Array.isArray(partnerIds) && partnerIds.length > 0) {
    partnerName = partnerMap.get(partnerIds[0]) ?? null;
  }

  // Parse comma-separated AWS contact emails
  const awsContactEmails = strArr(rec.fields[RF.awsContactEmails]);

  return {
    name,
    relationship_type: relationshipType,
    strength,
    aws_org: str(rec.fields[RF.awsOrg]),
    aws_service: str(rec.fields[RF.awsService]),
    primary_contact_name: str(rec.fields[RF.primaryContact]),
    primary_contact_email: str(rec.fields[RF.primaryContactEmail]),
    aws_contact_emails: awsContactEmails,
    notes: str(rec.fields[RF.notes]),
    ...(partnerName ? { partner_name: partnerName } : {}),
  };
}

export async function syncAwsRelationships(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, errors: [] };
  const supabase = getSupabaseClient();

  // Fetch partner lookup map and all relationship records in parallel
  // For the partners table, we need the "Partner Name" field.
  // We'll fetch all partner records and use the first text field as the name.
  const [atRecords, partnerMap, { data: dbRows, error: fetchErr }] = await Promise.all([
    fetchAllRecords(RELATIONSHIPS_TABLE),
    fetchPartnerLookup(),
    supabase.from("aws_relationships").select("*"),
  ]);

  if (fetchErr) throw new Error(`Failed to fetch aws_relationships: ${fetchErr.message}`);
  const existing = dbRows ?? [];

  const byAtId = new Map(existing.filter((r) => r.airtable_record_id).map((r) => [r.airtable_record_id, r]));
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));

  for (const rec of atRecords) {
    try {
      const mapped = mapRelationship(rec, partnerMap);
      if (!mapped) {
        result.errors.push(`Skipped record ${rec.id}: missing name`);
        continue;
      }

      const match = byAtId.get(rec.id) ?? byName.get((mapped.name as string).toLowerCase());

      if (match) {
        // For existing records, don't overwrite partner_name if we didn't resolve one
        const updateFields = { ...mapped, airtable_record_id: rec.id };
        if (!updateFields.partner_name && match.partner_name) {
          updateFields.partner_name = match.partner_name;
        }

        if (!hasChanges(updateFields, match)) {
          result.unchanged++;
          continue;
        }

        const { error } = await supabase
          .from("aws_relationships")
          .update(updateFields)
          .eq("id", match.id);

        if (error) {
          result.errors.push(`Update relationship "${mapped.name}": ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        const { error } = await supabase
          .from("aws_relationships")
          .insert({ ...mapped, airtable_record_id: rec.id });

        if (error) {
          result.errors.push(`Insert relationship "${mapped.name}": ${error.message}`);
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      result.errors.push(`Record ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return result;
}

/** Build a recordId → partner name lookup from the Partners table */
async function fetchPartnerLookup(): Promise<Map<string, string>> {
  try {
    const records = await fetchAllRecords(PARTNERS_TABLE);
    const map = new Map<string, string>();
    for (const rec of records) {
      // The first non-null string field is likely the name.
      // Airtable primary field is always first when using returnFieldsByFieldId.
      const values = Object.values(rec.fields);
      for (const val of values) {
        if (typeof val === "string" && val.trim()) {
          map.set(rec.id, val.trim());
          break;
        }
      }
    }
    return map;
  } catch (err) {
    console.warn("Failed to fetch partner lookup:", err);
    return new Map();
  }
}

// ── Sync all catalogs ───────────────────────────────────────

export interface SyncAllResult {
  programs?: SyncResult;
  events?: SyncResult;
  relationships?: SyncResult;
  duration_ms: number;
}

export async function syncAllCatalogs(): Promise<SyncAllResult> {
  const start = Date.now();

  // Run sequentially to respect Airtable rate limits
  const programs = await syncPrograms();
  const events = await syncEvents();
  const relationships = await syncAwsRelationships();

  return {
    programs,
    events,
    relationships,
    duration_ms: Date.now() - start,
  };
}

export async function syncEntity(
  entity: "programs" | "events" | "relationships"
): Promise<SyncAllResult> {
  const start = Date.now();
  const result: SyncAllResult = { duration_ms: 0 };

  if (entity === "programs") result.programs = await syncPrograms();
  else if (entity === "events") result.events = await syncEvents();
  else if (entity === "relationships") result.relationships = await syncAwsRelationships();

  result.duration_ms = Date.now() - start;
  return result;
}
