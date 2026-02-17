/**
 * Airtable → Supabase catalog sync.
 * One-way pull: Airtable is source of truth for Programs, Events, AWS Relationships.
 * Matches by airtable_record_id first, then by name. Never deletes Supabase records.
 */

import {
  fetchAllRecords,
  fetchRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "./airtable";
import { getSupabaseClient } from "./supabase";
import type { OpenItem } from "./types";

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

const PTRF = {
  name: "fldlE5L12oES6IQSO",
  category: "fldSoIAhWfmPgHzuc",
  subCategory: "fldeW5BvDgSp1bLNX",
  allianceLead: "fldN2yZtjwetyHJwI",
  psa: "fldNRDPljDlJZkbds",
  spmsId: "fld9gzD2CRM9NApUH",
  allianceLeadEmail: "fldgoSc6QMl6l1303",
  partnerContactEmails: "fldAEQSbi448tEjff",
} as const;

export interface SyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
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
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
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

  // Delete orphans: Supabase records with an airtable_record_id not in Airtable
  const atIds = new Set(atRecords.map((r) => r.id));
  const orphans = existing.filter(
    (r) => r.airtable_record_id && !atIds.has(r.airtable_record_id)
  );
  for (const orphan of orphans) {
    try {
      const { error } = await supabase.from("programs").delete().eq("id", orphan.id);
      if (error) {
        result.errors.push(`Delete orphaned program "${orphan.name}": ${error.message}`);
      } else {
        console.log(`Deleted orphaned program: ${orphan.name} (airtable_record_id: ${orphan.airtable_record_id})`);
        result.deleted++;
      }
    } catch (err) {
      result.errors.push(`Delete orphaned program "${orphan.name}": ${err instanceof Error ? err.message : "Unknown error"}`);
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
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
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

  // Delete orphans: Supabase records with an airtable_record_id not in Airtable
  const atIds = new Set(atRecords.map((r) => r.id));
  const orphans = existing.filter(
    (r) => r.airtable_record_id && !atIds.has(r.airtable_record_id)
  );
  for (const orphan of orphans) {
    try {
      const { error } = await supabase.from("events").delete().eq("id", orphan.id);
      if (error) {
        result.errors.push(`Delete orphaned event "${orphan.name}": ${error.message}`);
      } else {
        console.log(`Deleted orphaned event: ${orphan.name} (airtable_record_id: ${orphan.airtable_record_id})`);
        result.deleted++;
      }
    } catch (err) {
      result.errors.push(`Delete orphaned event "${orphan.name}": ${err instanceof Error ? err.message : "Unknown error"}`);
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
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
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
        const updateFields: Record<string, unknown> = { ...mapped, airtable_record_id: rec.id };
        if (!mapped.partner_name && match.partner_name) {
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

  // Delete orphans: Supabase records with an airtable_record_id not in Airtable
  const atIds = new Set(atRecords.map((r) => r.id));
  const orphans = existing.filter(
    (r) => r.airtable_record_id && !atIds.has(r.airtable_record_id)
  );
  for (const orphan of orphans) {
    try {
      // CASCADE FKs on engagement_aws_relationships and meeting_aws_relationships
      // will automatically clean up junction rows
      const { error } = await supabase.from("aws_relationships").delete().eq("id", orphan.id);
      if (error) {
        result.errors.push(`Delete orphaned relationship "${orphan.name}": ${error.message}`);
      } else {
        console.log(`Deleted orphaned relationship: ${orphan.name} (airtable_record_id: ${orphan.airtable_record_id})`);
        result.deleted++;
      }
    } catch (err) {
      result.errors.push(`Delete orphaned relationship "${orphan.name}": ${err instanceof Error ? err.message : "Unknown error"}`);
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

// ── Partners sync ───────────────────────────────────────────

/** Extract .name from Airtable single-select object, or return string as-is */
function selectName(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "object" && val !== null && "name" in val) {
    const name = (val as { name: unknown }).name;
    return typeof name === "string" ? name.trim() || null : null;
  }
  return null;
}

function mapPartner(rec: AirtableRecord): Record<string, unknown> | null {
  const name = str(rec.fields[PTRF.name]);
  if (!name) return null;

  const rawCategory = selectName(rec.fields[PTRF.category]);
  const category = rawCategory ? rawCategory.toLowerCase() : null;

  // Split semicolon-delimited contact emails into string[]
  const rawEmails = str(rec.fields[PTRF.partnerContactEmails]);
  const partnerContactEmails = rawEmails
    ? rawEmails.split(";").map((s) => s.trim()).filter(Boolean)
    : null;

  const rawSpmsId = rec.fields[PTRF.spmsId];
  const spmsId = typeof rawSpmsId === "number" ? rawSpmsId : null;

  return {
    name,
    category,
    sub_category: str(rec.fields[PTRF.subCategory]),
    alliance_lead: str(rec.fields[PTRF.allianceLead]),
    alliance_lead_email: str(rec.fields[PTRF.allianceLeadEmail]),
    psa: selectName(rec.fields[PTRF.psa]),
    spms_id: spmsId,
    partner_contact_emails: partnerContactEmails,
  };
}

export async function syncPartners(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [atRecords, { data: dbRows, error: fetchErr }] = await Promise.all([
    fetchAllRecords(PARTNERS_TABLE),
    supabase.from("partners").select("*"),
  ]);

  if (fetchErr) throw new Error(`Failed to fetch partners: ${fetchErr.message}`);
  const existing = dbRows ?? [];

  const byAtId = new Map(existing.filter((r) => r.airtable_record_id).map((r) => [r.airtable_record_id, r]));
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));

  for (const rec of atRecords) {
    try {
      const mapped = mapPartner(rec);
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
          .from("partners")
          .update({ ...mapped, airtable_record_id: rec.id })
          .eq("id", match.id);

        if (error) {
          result.errors.push(`Update partner "${mapped.name}": ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        const { error } = await supabase
          .from("partners")
          .insert({ ...mapped, airtable_record_id: rec.id });

        if (error) {
          result.errors.push(`Insert partner "${mapped.name}": ${error.message}`);
        } else {
          result.inserted++;
        }
      }
    } catch (err) {
      result.errors.push(`Record ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Delete orphans: Supabase records with an airtable_record_id not in Airtable
  const atIds = new Set(atRecords.map((r) => r.id));
  const orphans = existing.filter(
    (r) => r.airtable_record_id && !atIds.has(r.airtable_record_id)
  );
  for (const orphan of orphans) {
    try {
      // partner_id FKs on engagements and meetings use ON DELETE SET NULL
      const { error } = await supabase.from("partners").delete().eq("id", orphan.id);
      if (error) {
        result.errors.push(`Delete orphaned partner "${orphan.name}": ${error.message}`);
      } else {
        console.log(`Deleted orphaned partner: ${orphan.name} (airtable_record_id: ${orphan.airtable_record_id})`);
        result.deleted++;
      }
    } catch (err) {
      result.errors.push(`Delete orphaned partner "${orphan.name}": ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return result;
}

// ── Engagement push (Roadrunner → Airtable) ────────────────

const ENGAGEMENTS_TABLE = "tblTC491AUVcrKvq2";

const ENF = {
  name: "fldxq7bsx8PuRvodp",
  pillar: "fldvxfxhOPDGr5jBA",
  priority: "fld4N2kKPFJEqwYtN",
  status: "fldUAOu4GG1Wme5OJ",
  tags: "fldkgcbEZZSJv0cbN",
  notes: "flduVQ9wp3XXVUiwo",
  roadrunnerId: "fldJJ8ZlwhePawiEl",
  partner: "fld8MJU06GPUU0iy6",
} as const;

const STATUS_TO_AIRTABLE: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  paused: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

const NOTES_MARKER = "=== Roadrunner Activity Summary ===";
const NOTES_FOOTER = "(Auto-synced from Roadrunner)";

function buildNotesContent(
  currentState: string | null,
  openItems: OpenItem[]
): string {
  const parts = [NOTES_MARKER, ""];
  if (currentState) parts.push(currentState, "");

  const unresolvedItems = openItems.filter((i) => !i.resolved);
  if (unresolvedItems.length > 0) {
    parts.push("Open Items:");
    for (const item of unresolvedItems) {
      let line = `- ${item.description}`;
      if (item.assignee) line += ` (${item.assignee})`;
      if (item.due_date) line += ` [due: ${item.due_date}]`;
      parts.push(line);
    }
    parts.push("");
  }

  parts.push(NOTES_FOOTER);
  return parts.join("\n");
}

/** Extract the Roadrunner section from existing Notes (marker → footer inclusive) */
function extractRoadrunnerSection(notes: string | null): string | null {
  if (!notes) return null;
  const markerIdx = notes.indexOf(NOTES_MARKER);
  if (markerIdx < 0) return null;
  const footerIdx = notes.indexOf(NOTES_FOOTER, markerIdx);
  if (footerIdx < 0) return null;
  return notes.substring(markerIdx, footerIdx + NOTES_FOOTER.length);
}

/** Merge Roadrunner notes into existing Airtable notes, preserving manual content */
function mergeNotes(existingNotes: string | null, roadrunnerSection: string): string {
  if (!existingNotes || existingNotes.trim() === "") {
    return roadrunnerSection;
  }

  const markerIdx = existingNotes.indexOf(NOTES_MARKER);
  if (markerIdx >= 0) {
    // Replace existing Roadrunner section
    const footerIdx = existingNotes.indexOf(NOTES_FOOTER, markerIdx);
    const endIdx = footerIdx >= 0 ? footerIdx + NOTES_FOOTER.length : existingNotes.length;
    const before = existingNotes.substring(0, markerIdx).trimEnd();
    const after = existingNotes.substring(endIdx).trimStart();

    const parts: string[] = [];
    if (before) parts.push(before);
    parts.push(roadrunnerSection);
    if (after) parts.push(after);
    return parts.join("\n\n");
  }

  // Manual notes without marker — append Roadrunner section below
  return existingNotes.trimEnd() + "\n\n" + roadrunnerSection;
}

/** Build name → recordId reverse lookup from the Partners table */
async function fetchPartnerNameToIdMap(): Promise<Map<string, string>> {
  const lookup = await fetchPartnerLookup();
  const reversed = new Map<string, string>();
  for (const [recordId, name] of lookup) {
    reversed.set(name.toLowerCase(), recordId);
  }
  return reversed;
}

function buildEngagementFields(
  engagement: Record<string, unknown>,
  partnerNameToId: Map<string, string>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    [ENF.name]: engagement.name,
    [ENF.roadrunnerId]: engagement.id,
    [ENF.status]: STATUS_TO_AIRTABLE[engagement.status as string] ?? "Active",
  };

  // Pillar and priority: only set if present (Airtable singleSelect, case-sensitive)
  if (engagement.pillar) fields[ENF.pillar] = engagement.pillar;
  if (engagement.priority) fields[ENF.priority] = engagement.priority;

  // Tags: join array into comma-separated text
  const tags = engagement.tags as string[] | undefined;
  if (tags && tags.length > 0) fields[ENF.tags] = tags.join(", ");

  // Resolve partner name to Airtable record ID
  const partnerName = engagement.partner_name as string | null;
  if (partnerName) {
    const partnerId = partnerNameToId.get(partnerName.toLowerCase());
    if (partnerId) {
      fields[ENF.partner] = [partnerId];
    } else {
      console.warn(`Partner "${partnerName}" not found in Airtable Partners table`);
    }
  }

  return fields;
}

export interface PushResult {
  action: "created" | "updated" | "unchanged";
  airtable_record_id: string;
}

/**
 * Push a single engagement to Airtable.
 * Creates or updates the Airtable record, stores airtable_record_id in Supabase.
 */
export async function pushEngagementToAirtable(
  engagementId: string
): Promise<PushResult> {
  const supabase = getSupabaseClient();

  const { data: engagement, error: fetchErr } = await supabase
    .from("engagements")
    .select("*")
    .eq("id", engagementId)
    .single();

  if (fetchErr || !engagement) {
    throw new Error(`Engagement ${engagementId} not found`);
  }

  const partnerNameToId = await fetchPartnerNameToIdMap();
  const fields = buildEngagementFields(engagement, partnerNameToId);
  const roadrunnerNotes = buildNotesContent(
    engagement.current_state,
    engagement.open_items ?? []
  );

  // Try to find existing Airtable record
  let atRecordId: string | null = engagement.airtable_record_id;
  let existingNotes: string | null = null;

  if (atRecordId) {
    // Fetch existing record for Notes merge
    try {
      const existing = await fetchRecord(ENGAGEMENTS_TABLE, atRecordId);
      existingNotes = (existing.fields[ENF.notes] as string) ?? null;
    } catch {
      // Record may have been deleted in Airtable — treat as new
      atRecordId = null;
    }
  }

  if (!atRecordId) {
    // Search Airtable by Roadrunner ID, then by name
    const atRecords = await fetchAllRecords(ENGAGEMENTS_TABLE);

    let match = atRecords.find(
      (r) => r.fields[ENF.roadrunnerId] === engagementId
    );

    if (!match) {
      match = atRecords.find((r) => {
        const name = r.fields[ENF.name];
        return (
          typeof name === "string" &&
          name.toLowerCase() === (engagement.name as string).toLowerCase()
        );
      });
    }

    if (match) {
      atRecordId = match.id;
      existingNotes = (match.fields[ENF.notes] as string) ?? null;
    }
  }

  if (atRecordId) {
    fields[ENF.notes] = mergeNotes(existingNotes, roadrunnerNotes);
    await updateRecord(ENGAGEMENTS_TABLE, atRecordId, fields);

    if (!engagement.airtable_record_id) {
      await supabase
        .from("engagements")
        .update({ airtable_record_id: atRecordId })
        .eq("id", engagementId);
    }

    return { action: "updated", airtable_record_id: atRecordId };
  } else {
    fields[ENF.notes] = roadrunnerNotes;
    const created = await createRecord(ENGAGEMENTS_TABLE, fields);

    await supabase
      .from("engagements")
      .update({ airtable_record_id: created.id })
      .eq("id", engagementId);

    return { action: "created", airtable_record_id: created.id };
  }
}

/**
 * Delete an engagement's Airtable record by its airtable_record_id.
 * Fire-and-forget — caller should not await or depend on success.
 */
export async function deleteEngagementFromAirtable(
  airtableRecordId: string
): Promise<void> {
  await deleteRecord(ENGAGEMENTS_TABLE, airtableRecordId);
  console.log(`Deleted Airtable engagement record: ${airtableRecordId}`);
}

/**
 * Bulk sync all Roadrunner engagements to Airtable.
 * Fetches all records from both sides, matches, and creates/updates as needed.
 */
export async function syncEngagementsToAirtable(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [{ data: engagements, error: fetchErr }, atRecords, partnerNameToId] =
    await Promise.all([
      supabase.from("engagements").select("*"),
      fetchAllRecords(ENGAGEMENTS_TABLE),
      fetchPartnerNameToIdMap(),
    ]);

  if (fetchErr) throw new Error(`Failed to fetch engagements: ${fetchErr.message}`);

  // Build Airtable lookup maps
  const atByRoadrunnerId = new Map<string, AirtableRecord>();
  const atByName = new Map<string, AirtableRecord>();
  for (const rec of atRecords) {
    const rrId = rec.fields[ENF.roadrunnerId];
    if (typeof rrId === "string" && rrId) atByRoadrunnerId.set(rrId, rec);
    const name = rec.fields[ENF.name];
    if (typeof name === "string") atByName.set(name.toLowerCase(), rec);
  }

  for (const eng of engagements ?? []) {
    try {
      const fields = buildEngagementFields(eng, partnerNameToId);
      const roadrunnerNotes = buildNotesContent(eng.current_state, eng.open_items ?? []);

      // Find existing Airtable record
      let atRecord: AirtableRecord | undefined;
      if (eng.airtable_record_id) {
        atRecord = atRecords.find((r) => r.id === eng.airtable_record_id);
      }
      if (!atRecord) {
        atRecord =
          atByRoadrunnerId.get(eng.id) ??
          atByName.get((eng.name as string).toLowerCase());
      }

      if (atRecord) {
        // Change detection: compare non-Notes fields + Roadrunner notes section
        const existingNotes = (atRecord.fields[ENF.notes] as string) ?? null;
        const existingSection = extractRoadrunnerSection(existingNotes);
        const notesChanged = roadrunnerNotes !== existingSection;

        const fieldsForCompare = { ...fields };
        const atFieldsForCompare: Record<string, unknown> = {};
        for (const key of Object.keys(fieldsForCompare)) {
          atFieldsForCompare[key] = atRecord.fields[key] ?? null;
        }
        const dataChanged = hasChanges(fieldsForCompare, atFieldsForCompare);

        if (!dataChanged && !notesChanged) {
          result.unchanged++;
          // Still store airtable_record_id if not set
          if (!eng.airtable_record_id) {
            await supabase
              .from("engagements")
              .update({ airtable_record_id: atRecord.id })
              .eq("id", eng.id);
          }
          continue;
        }

        fields[ENF.notes] = mergeNotes(existingNotes, roadrunnerNotes);
        await updateRecord(ENGAGEMENTS_TABLE, atRecord.id, fields);

        if (!eng.airtable_record_id) {
          await supabase
            .from("engagements")
            .update({ airtable_record_id: atRecord.id })
            .eq("id", eng.id);
        }

        result.updated++;
      } else {
        // Create new Airtable record
        fields[ENF.notes] = roadrunnerNotes;
        const created = await createRecord(ENGAGEMENTS_TABLE, fields);

        await supabase
          .from("engagements")
          .update({ airtable_record_id: created.id })
          .eq("id", eng.id);

        result.inserted++;
      }

      // Rate limiting between writes
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      result.errors.push(
        `Engagement "${eng.name}": ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return result;
}

// ── Sync all catalogs ───────────────────────────────────────

export interface SyncAllResult {
  partners?: SyncResult;
  programs?: SyncResult;
  events?: SyncResult;
  relationships?: SyncResult;
  engagements?: SyncResult;
  duration_ms: number;
}

export async function syncAllCatalogs(): Promise<SyncAllResult> {
  const start = Date.now();

  // Run sequentially to respect Airtable rate limits.
  // Partners sync first — other entities may reference them.
  const partners = await syncPartners();
  const programs = await syncPrograms();
  const events = await syncEvents();
  const relationships = await syncAwsRelationships();

  return {
    partners,
    programs,
    events,
    relationships,
    duration_ms: Date.now() - start,
  };
}

export async function syncEntity(
  entity: "partners" | "programs" | "events" | "relationships" | "engagements"
): Promise<SyncAllResult> {
  const start = Date.now();
  const result: SyncAllResult = { duration_ms: 0 };

  if (entity === "partners") result.partners = await syncPartners();
  else if (entity === "programs") result.programs = await syncPrograms();
  else if (entity === "events") result.events = await syncEvents();
  else if (entity === "relationships") result.relationships = await syncAwsRelationships();
  else if (entity === "engagements") result.engagements = await syncEngagementsToAirtable();

  result.duration_ms = Date.now() - start;
  return result;
}
