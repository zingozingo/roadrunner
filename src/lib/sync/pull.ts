/**
 * Airtable → Supabase catalog sync.
 * One-way pull: Airtable is source of truth for Programs, Events, AWS Relationships, Partners.
 * Matches by airtable_record_id first, then by name. Deletes orphaned Supabase records.
 */

import {
  fetchAllRecords,
  type AirtableRecord,
} from "../airtable";
import { getSupabaseClient } from "../db";
import {
  syncPartnerContactsToRegistry,
  syncRelationshipContactsToRegistry,
} from "../db/participants";
import {
  PROGRAMS_TABLE, EVENTS_TABLE, RELATIONSHIPS_TABLE, PARTNERS_TABLE,
  PF, EF, RF, PTRF,
} from "./field-maps";
import {
  str, strArr, arr, selectName,
  hasChanges,
  VALID_PROGRAM_TYPES, VALID_EVENT_TYPES, VALID_RELATIONSHIP_TYPES, VALID_LIFECYCLE_TYPES,
} from "./utils";
import { parseRoleContact, parseContactList } from "../contact-parser";
import type { RoleContact } from "../types";
import { syncEngagementsToAirtable, syncMeetingsToAirtable } from "./push";

export interface SyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
  errors: string[];
}

export interface SyncAllResult {
  partners?: SyncResult;
  programs?: SyncResult;
  events?: SyncResult;
  relationships?: SyncResult;
  engagements?: SyncResult;
  meetings?: SyncResult;
  duration_ms: number;
}

// ── Mappers ─────────────────────────────────────────────────

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
    requirements: str(rec.fields[PF.requirements]),
    what_it_unlocks: str(rec.fields[PF.whatItUnlocks]),
    notes: str(rec.fields[PF.notes]),
    lifecycle_type: lifecycle,
    lifecycle_duration: str(rec.fields[PF.lifecycleDuration]),
  };
}

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
    geo: str(rec.fields[EF.geo]),
    sponsor_option: !!rec.fields[EF.sponsorOption],
    partner_day: !!rec.fields[EF.partnerDay],
    partner_day_date: str(rec.fields[EF.partnerDayDate]) || null,
  };
}

function mapRelationship(
  rec: AirtableRecord
): Record<string, unknown> | null {
  const name = str(rec.fields[RF.name]);
  if (!name) return null;

  const rawType = str(rec.fields[RF.type]);
  const relationshipType = rawType && VALID_RELATIONSHIP_TYPES.has(rawType) ? rawType : null;

  // Build contacts JSONB from new unified fields
  const contacts: RoleContact[] = [];
  const leadRaw = str(rec.fields[RF.leadContact]);
  if (leadRaw) contacts.push(parseRoleContact(leadRaw, "Lead Contact"));
  const teamRaw = str(rec.fields[RF.teamContacts]);
  if (teamRaw) contacts.push(...parseContactList(teamRaw, "Team Member"));

  const rawOrgType = str(rec.fields[RF.orgType]);
  const orgType = rawOrgType === "Third Party" ? "third_party" : "internal";

  return {
    name,
    relationship_type: relationshipType,
    org: str(rec.fields[RF.awsOrg]),
    service: str(rec.fields[RF.awsService]),
    contacts,
    notes: str(rec.fields[RF.notes]),
    org_type: orgType,
  };
}

function mapPartner(rec: AirtableRecord): Record<string, unknown> | null {
  const name = str(rec.fields[PTRF.name]);
  if (!name) return null;

  const rawSegment = selectName(rec.fields[PTRF.segment]);
  const segment = rawSegment ? rawSegment.toLowerCase() : null;

  // Build JSONB arrays from new unified fields
  const partnerContacts: RoleContact[] = [];
  const awsTeam: RoleContact[] = [];

  // Alliance Lead → partner_contacts (partner-side role)
  const allianceLeadRaw = str(rec.fields[PTRF.allianceLead]);
  if (allianceLeadRaw) partnerContacts.push(parseRoleContact(allianceLeadRaw, "Alliance Lead"));

  // Contacts (multi-line) → partner_contacts
  const contactsRaw = str(rec.fields[PTRF.contacts]);
  if (contactsRaw) partnerContacts.push(...parseContactList(contactsRaw, "Contact"));

  // PSA → aws_team (AWS-side role)
  const psaRaw = str(rec.fields[PTRF.psa]);
  if (psaRaw) awsTeam.push(parseRoleContact(psaRaw, "PSA"));

  // Account Manager → aws_team
  const amRaw = str(rec.fields[PTRF.accountManager]);
  if (amRaw) awsTeam.push(parseRoleContact(amRaw, "Account Manager"));

  // PMM → aws_team
  const pmmRaw = str(rec.fields[PTRF.pmm]);
  if (pmmRaw) awsTeam.push(parseRoleContact(pmmRaw, "PMM"));

  return {
    name,
    segment,
    focus_area: arr(rec.fields[PTRF.focusArea]),
    aws_team: awsTeam,
    partner_contacts: partnerContacts,
    aws_stickiness: str(rec.fields[PTRF.awsStickiness]),
    key_aws_services: arr(rec.fields[PTRF.keyAwsServices]),
    what_they_do: str(rec.fields[PTRF.whatTheyDo]),
    architecture: str(rec.fields[PTRF.architecture]),
    listing_types: arr(rec.fields[PTRF.listingTypes]),
    pricing_model: arr(rec.fields[PTRF.pricingModel]),
    isva_status: str(rec.fields[PTRF.isvaStatus]),
    deployed_on_aws: str(rec.fields[PTRF.deployedOnAws]),
    prm_status: str(rec.fields[PTRF.prmStatus]),
    crm_status: str(rec.fields[PTRF.crmStatus]),
  };
}

// ── Sync functions ──────────────────────────────────────────

export async function syncPrograms(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [atRecords, { data: dbRows, error: fetchErr }] = await Promise.all([
    fetchAllRecords(PROGRAMS_TABLE),
    supabase.from("programs").select("*"),
  ]);

  if (fetchErr) throw new Error(`Failed to fetch programs: ${fetchErr.message}`);
  const existing = dbRows ?? [];

  const byAtId = new Map(existing.filter((r) => r.airtable_record_id).map((r) => [r.airtable_record_id, r]));
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));

  for (const rec of atRecords) {
    try {
      const mapped = mapProgram(rec);
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

export async function syncRelationships(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [atRecords, { data: dbRows, error: fetchErr }] = await Promise.all([
    fetchAllRecords(RELATIONSHIPS_TABLE),
    supabase.from("relationships").select("*"),
  ]);

  if (fetchErr) throw new Error(`Failed to fetch relationships: ${fetchErr.message}`);
  const existing = dbRows ?? [];

  const byAtId = new Map(existing.filter((r) => r.airtable_record_id).map((r) => [r.airtable_record_id, r]));
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));

  for (const rec of atRecords) {
    try {
      const mapped = mapRelationship(rec);
      if (!mapped) {
        result.errors.push(`Skipped record ${rec.id}: missing name`);
        continue;
      }

      const match = byAtId.get(rec.id) ?? byName.get((mapped.name as string).toLowerCase());

      let relationshipId: string | null = null;

      if (match) {
        const updateFields: Record<string, unknown> = { ...mapped, airtable_record_id: rec.id };

        if (!hasChanges(updateFields, match)) {
          relationshipId = match.id;
          result.unchanged++;
        } else {
          const { error } = await supabase
            .from("relationships")
            .update(updateFields)
            .eq("id", match.id);

          if (error) {
            result.errors.push(`Update relationship "${mapped.name}": ${error.message}`);
          } else {
            relationshipId = match.id;
            result.updated++;
          }
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("relationships")
          .insert({ ...mapped, airtable_record_id: rec.id })
          .select("id")
          .single();

        if (error) {
          result.errors.push(`Insert relationship "${mapped.name}": ${error.message}`);
        } else {
          relationshipId = inserted.id;
          result.inserted++;
        }
      }

      // Sync contacts to registry (additive, non-blocking)
      if (relationshipId) {
        try {
          await syncRelationshipContactsToRegistry(
            relationshipId,
            (mapped.contacts as RoleContact[]) ?? []
          );
        } catch (regErr) {
          console.error(`Registry sync failed for relationship "${mapped.name}":`, regErr);
        }
      }
    } catch (err) {
      result.errors.push(`Record ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  const atIds = new Set(atRecords.map((r) => r.id));
  const orphans = existing.filter(
    (r) => r.airtable_record_id && !atIds.has(r.airtable_record_id)
  );
  for (const orphan of orphans) {
    try {
      const { error } = await supabase.from("relationships").delete().eq("id", orphan.id);
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

      let partnerId: string | null = null;

      if (match) {
        const fieldsToCompare = { ...mapped, airtable_record_id: rec.id };
        if (!hasChanges(fieldsToCompare, match)) {
          // Even if JSONB unchanged, sync contacts to registry (titles/names may differ)
          partnerId = match.id;
          result.unchanged++;
        } else {
          const { error } = await supabase
            .from("partners")
            .update({ ...mapped, airtable_record_id: rec.id })
            .eq("id", match.id);

          if (error) {
            result.errors.push(`Update partner "${mapped.name}": ${error.message}`);
          } else {
            partnerId = match.id;
            result.updated++;
          }
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("partners")
          .insert({ ...mapped, airtable_record_id: rec.id })
          .select("id")
          .single();

        if (error) {
          result.errors.push(`Insert partner "${mapped.name}": ${error.message}`);
        } else {
          partnerId = inserted.id;
          result.inserted++;
        }
      }

      // Sync contacts to registry (additive, non-blocking)
      if (partnerId) {
        try {
          await syncPartnerContactsToRegistry(
            partnerId,
            mapped.name as string,
            (mapped.aws_team as RoleContact[]) ?? [],
            (mapped.partner_contacts as RoleContact[]) ?? []
          );
        } catch (regErr) {
          console.error(`Registry sync failed for partner "${mapped.name}":`, regErr);
        }
      }
    } catch (err) {
      result.errors.push(`Record ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  const atIds = new Set(atRecords.map((r) => r.id));
  const orphans = existing.filter(
    (r) => r.airtable_record_id && !atIds.has(r.airtable_record_id)
  );
  for (const orphan of orphans) {
    try {
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

// ── Orchestration ───────────────────────────────────────────

export async function syncAllCatalogs(): Promise<SyncAllResult> {
  const start = Date.now();

  // Run sequentially to respect Airtable rate limits.
  // Partners sync first — other entities may reference them.
  const partners = await syncPartners();
  const programs = await syncPrograms();
  const events = await syncEvents();
  const relationships = await syncRelationships();

  return {
    partners,
    programs,
    events,
    relationships,
    duration_ms: Date.now() - start,
  };
}

export async function syncEntity(
  entity: "partners" | "programs" | "events" | "relationships" | "engagements" | "meetings"
): Promise<SyncAllResult> {
  const start = Date.now();
  const result: SyncAllResult = { duration_ms: 0 };

  if (entity === "partners") result.partners = await syncPartners();
  else if (entity === "programs") result.programs = await syncPrograms();
  else if (entity === "events") result.events = await syncEvents();
  else if (entity === "relationships") result.relationships = await syncRelationships();
  else if (entity === "engagements") result.engagements = await syncEngagementsToAirtable();
  else if (entity === "meetings") result.meetings = await syncMeetingsToAirtable();

  result.duration_ms = Date.now() - start;
  return result;
}
