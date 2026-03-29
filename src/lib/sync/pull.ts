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
} from "../db/participants";
import {
  PROGRAMS_TABLE, EVENTS_TABLE, PARTNERS_TABLE,
  PF, EF, PTRF,
  RING3_TABLES,
  PARTNER_GOALS_FIELDS, PARTNER_PROGRAMS_FIELDS, PARTNER_EVENTS_FIELDS,
  MPOPP_FIELDS, MDF_FIELDS,
} from "./field-maps";
import {
  str, strArr, arr, selectName,
  hasChanges,
  VALID_PROGRAM_TYPES, VALID_EVENT_TYPES, VALID_LIFECYCLE_TYPES,
} from "./utils";
import { parseRoleContact, parseContactList } from "../contact-parser";
import type { RoleContact } from "../types";
import { syncEngagementsToAirtable, syncMeetingsToAirtable } from "./push";
import {
  upsertPartnerGoal,
  upsertPartnerProgramEnrollment,
  upsertPartnerEventParticipation,
  upsertMpoppFunding,
  upsertMdfFunding,
} from "../db/ring3";

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
  engagements?: SyncResult;
  meetings?: SyncResult;
  partnerGoals?: SyncResult;
  partnerProgramEnrollments?: SyncResult;
  partnerEventParticipations?: SyncResult;
  mpoppFunding?: SyncResult;
  mdfFunding?: SyncResult;
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

/** Coerce Airtable number/formula field to number | null */
function num(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function mapPartner(rec: AirtableRecord): Record<string, unknown> | null {
  const name = str(rec.fields[PTRF.name]);
  if (!name) return null;

  const rawSegment = selectName(rec.fields[PTRF.segment]);
  const segment = rawSegment ? rawSegment.toLowerCase() : null;

  // Parse contacts from AT fields (used for registry sync only — no JSONB columns)
  const partnerContacts: RoleContact[] = [];
  const awsTeam: RoleContact[] = [];
  const thirdPartyContacts: RoleContact[] = [];

  // Alliance Lead → partner contacts (partner-side role)
  const allianceLeadRaw = str(rec.fields[PTRF.allianceLead]);
  if (allianceLeadRaw) partnerContacts.push(parseRoleContact(allianceLeadRaw, "Alliance Lead"));

  // Contacts (multi-line) → partner contacts
  const contactsRaw = str(rec.fields[PTRF.contacts]);
  if (contactsRaw) partnerContacts.push(...parseContactList(contactsRaw, "Contact"));

  // PSA → AWS team (AWS-side role)
  const psaRaw = str(rec.fields[PTRF.psa]);
  if (psaRaw) awsTeam.push(parseRoleContact(psaRaw, "PSA"));

  // Account Manager → AWS team
  const amRaw = str(rec.fields[PTRF.accountManager]);
  if (amRaw) awsTeam.push(parseRoleContact(amRaw, "Account Manager"));

  // PMM → AWS team
  const pmmRaw = str(rec.fields[PTRF.pmm]);
  if (pmmRaw) awsTeam.push(parseRoleContact(pmmRaw, "PMM"));

  // AWS Contacts (multi-person) → AWS team
  const awsContactsRaw = str(rec.fields[PTRF.awsContacts]);
  if (awsContactsRaw) awsTeam.push(...parseContactList(awsContactsRaw, "AWS Contact"));

  // CRM Contact → third party
  const crmContactRaw = str(rec.fields[PTRF.crmContact]);
  if (crmContactRaw) thirdPartyContacts.push(parseRoleContact(crmContactRaw, "CRM Contact"));

  // Third Party Contacts (multi-person) → third party
  const thirdPartyRaw = str(rec.fields[PTRF.thirdPartyContacts]);
  if (thirdPartyRaw) thirdPartyContacts.push(...parseContactList(thirdPartyRaw, "Third Party"));

  return {
    name,
    segment,
    focus_area: arr(rec.fields[PTRF.focusArea]),
    _awsTeam: awsTeam, // transient — used for registry sync, not written to DB
    _partnerContacts: partnerContacts, // transient — used for registry sync, not written to DB
    _thirdPartyContacts: thirdPartyContacts, // transient — used for registry sync, not written to DB
    aws_stickiness: str(rec.fields[PTRF.awsStickiness]),
    key_aws_services: arr(rec.fields[PTRF.keyAwsServices]),
    what_they_do: str(rec.fields[PTRF.whatTheyDo]),
    architecture: str(rec.fields[PTRF.architecture]),
    listing_types: arr(rec.fields[PTRF.listingTypes]),
    pricing_model: arr(rec.fields[PTRF.pricingModel]),
    isva_status: str(rec.fields[PTRF.isvaStatus]),
    deployed_on_aws: str(rec.fields[PTRF.deployedOnAws]),
    prm_status: str(rec.fields[PTRF.prmStatus]),
    crm_platform: (() => {
      const raw = selectName(rec.fields[PTRF.crmPlatform]);
      return raw ? raw.toLowerCase() : null;
    })(),
    crm_notes: str(rec.fields[PTRF.crmNotes]),
    joint_value_proposition: str(rec.fields[PTRF.jointValueProposition]),
    mp_tcv_goal: num(rec.fields[PTRF.mpTcvGoal]),
    larr_goal: num(rec.fields[PTRF.larrGoal]),
    mp_tcv_ytd: num(rec.fields[PTRF.mpTcvYtd]),
    larr_ytd: num(rec.fields[PTRF.larrYtd]),
    mp_tcv_2024: num(rec.fields[PTRF.mpTcv2024]),
    larr_2024: num(rec.fields[PTRF.larr2024]),
    mp_tcv_2025: num(rec.fields[PTRF.mpTcv2025]),
    larr_2025: num(rec.fields[PTRF.larr2025]),
    mp_tcv_target_2025: num(rec.fields[PTRF.mpTcvTarget2025]),
    mp_tcv_projected_annual: num(rec.fields[PTRF.mpTcvProjectedAnnual]),
    larr_projected_annual: num(rec.fields[PTRF.larrProjectedAnnual]),
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

      // Extract transient contacts before DB write
      const awsTeam = (mapped._awsTeam as RoleContact[]) ?? [];
      const partnerContacts = (mapped._partnerContacts as RoleContact[]) ?? [];
      const thirdPartyContacts = (mapped._thirdPartyContacts as RoleContact[]) ?? [];
      delete mapped._awsTeam;
      delete mapped._partnerContacts;
      delete mapped._thirdPartyContacts;

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
            awsTeam,
            partnerContacts,
            thirdPartyContacts
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

// ── Ring 3 helpers ──────────────────────────────────────────

/** Resolve AT linked record field (array of record IDs) to a Supabase UUID via lookup map */
function resolveLinkedRecord(
  val: unknown,
  lookupMap: Map<string, string>
): string | null {
  if (!Array.isArray(val) || val.length === 0) return null;
  return lookupMap.get(val[0] as string) ?? null;
}

/** Convert AT select display name to snake_case DB value (e.g. "Co-Sell" → "co_sell", "NEEDS ACTION" → "needs_action") */
function toSnake(val: unknown): string | null {
  const raw = selectName(val);
  if (!raw) return null;
  return raw.toLowerCase().replace(/[\s-]+/g, "_").replace(/\//g, "_");
}

/** Build partner lookup: Map<airtable_record_id, supabase_uuid> */
async function buildPartnerLookup(): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from("partners").select("id, airtable_record_id");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.airtable_record_id) map.set(row.airtable_record_id, row.id);
  }
  return map;
}

/** Build program lookup: Map<airtable_record_id, supabase_uuid> */
async function buildProgramLookup(): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from("programs").select("id, airtable_record_id");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.airtable_record_id) map.set(row.airtable_record_id, row.id);
  }
  return map;
}

/** Build event lookup: Map<airtable_record_id, supabase_uuid> */
async function buildEventLookup(): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from("events").select("id, airtable_record_id");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.airtable_record_id) map.set(row.airtable_record_id, row.id);
  }
  return map;
}

// ── Ring 3 sync functions ───────────────────────────────────

export async function syncPartnerGoals(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const [atRecords, partnerMap, programMap] = await Promise.all([
    fetchAllRecords(RING3_TABLES.partnerGoals),
    buildPartnerLookup(),
    buildProgramLookup(),
  ]);

  for (const rec of atRecords) {
    try {
      const partnerId = resolveLinkedRecord(rec.fields[PARTNER_GOALS_FIELDS.partner], partnerMap);
      if (!partnerId) {
        result.errors.push(`Skipped goal ${rec.id}: no partner resolved`);
        continue;
      }

      const goal = str(rec.fields[PARTNER_GOALS_FIELDS.goal]);
      if (!goal) {
        result.errors.push(`Skipped goal ${rec.id}: missing goal text`);
        continue;
      }

      const category = toSnake(rec.fields[PARTNER_GOALS_FIELDS.category]);
      if (!category) {
        result.errors.push(`Skipped goal ${rec.id}: missing category`);
        continue;
      }

      const yearRaw = selectName(rec.fields[PARTNER_GOALS_FIELDS.year]);
      const year = yearRaw ? parseInt(yearRaw, 10) || null : null;

      await upsertPartnerGoal({
        partner_id: partnerId,
        goal,
        category: category as "co_sell" | "co_build" | "co_market" | "compliance" | "program" | "vertical" | "operational",
        year,
        target_date: str(rec.fields[PARTNER_GOALS_FIELDS.targetDate]),
        status: (toSnake(rec.fields[PARTNER_GOALS_FIELDS.status]) ?? "not_started") as "not_started" | "in_progress" | "completed" | "deferred",
        linked_program_id: resolveLinkedRecord(rec.fields[PARTNER_GOALS_FIELDS.linkedProgram], programMap),
        engagement_id: null,
        notes: str(rec.fields[PARTNER_GOALS_FIELDS.notes]),
        airtable_id: rec.id,
      });
      result.inserted++;
    } catch (err) {
      result.errors.push(`Goal ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  console.log(`syncPartnerGoals: ${result.inserted} upserted, ${result.errors.length} errors`);
  return result;
}

export async function syncPartnerProgramEnrollments(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const [atRecords, partnerMap, programMap] = await Promise.all([
    fetchAllRecords(RING3_TABLES.partnerPrograms),
    buildPartnerLookup(),
    buildProgramLookup(),
  ]);

  for (const rec of atRecords) {
    try {
      const partnerId = resolveLinkedRecord(rec.fields[PARTNER_PROGRAMS_FIELDS.partner], partnerMap);
      if (!partnerId) {
        result.errors.push(`Skipped enrollment ${rec.id}: no partner resolved`);
        continue;
      }

      // Resolve program via linked record field (preferred)
      const programId = resolveLinkedRecord(rec.fields[PARTNER_PROGRAMS_FIELDS.program], programMap);

      const programName = str(rec.fields[PARTNER_PROGRAMS_FIELDS.programId]);
      const notes = str(rec.fields[PARTNER_PROGRAMS_FIELDS.notes]);

      await upsertPartnerProgramEnrollment({
        partner_id: partnerId,
        program_id: programId,
        program_name: programName,
        type: toSnake(rec.fields[PARTNER_PROGRAMS_FIELDS.type]),
        status: toSnake(rec.fields[PARTNER_PROGRAMS_FIELDS.status]),
        date_achieved: str(rec.fields[PARTNER_PROGRAMS_FIELDS.dateAchieved]),
        aws_stakeholder: str(rec.fields[PARTNER_PROGRAMS_FIELDS.awsStakeholder]),
        notes,
        airtable_id: rec.id,
      });
      result.inserted++;
    } catch (err) {
      result.errors.push(`Enrollment ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  console.log(`syncPartnerProgramEnrollments: ${result.inserted} upserted, ${result.errors.length} errors`);
  return result;
}

export async function syncPartnerEventParticipations(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const [atRecords, partnerMap, eventMap] = await Promise.all([
    fetchAllRecords(RING3_TABLES.partnerEvents),
    buildPartnerLookup(),
    buildEventLookup(),
  ]);

  for (const rec of atRecords) {
    try {
      const partnerId = resolveLinkedRecord(rec.fields[PARTNER_EVENTS_FIELDS.partner], partnerMap);
      if (!partnerId) {
        result.errors.push(`Skipped event participation ${rec.id}: no partner resolved`);
        continue;
      }

      const eventId = resolveLinkedRecord(rec.fields[PARTNER_EVENTS_FIELDS.events], eventMap);
      if (!eventId) {
        result.errors.push(`Skipped event participation ${rec.id}: no event resolved`);
        continue;
      }

      await upsertPartnerEventParticipation({
        partner_id: partnerId,
        event_id: eventId,
        status: toSnake(rec.fields[PARTNER_EVENTS_FIELDS.status]),
        contacts_attending: str(rec.fields[PARTNER_EVENTS_FIELDS.contactsAttending]),
        notes: str(rec.fields[PARTNER_EVENTS_FIELDS.notes]),
        airtable_id: rec.id,
      });
      result.inserted++;
    } catch (err) {
      result.errors.push(`Event participation ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  console.log(`syncPartnerEventParticipations: ${result.inserted} upserted, ${result.errors.length} errors`);
  return result;
}

export async function syncMpoppFunding(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const [atRecords, partnerMap] = await Promise.all([
    fetchAllRecords(RING3_TABLES.mpoppFunding),
    buildPartnerLookup(),
  ]);

  for (const rec of atRecords) {
    try {
      const partnerId = resolveLinkedRecord(rec.fields[MPOPP_FIELDS.partner], partnerMap);
      if (!partnerId) {
        result.errors.push(`Skipped MPOPP ${rec.id}: no partner resolved`);
        continue;
      }

      await upsertMpoppFunding({
        partner_id: partnerId,
        status: toSnake(rec.fields[MPOPP_FIELDS.status]),
        half: toSnake(rec.fields[MPOPP_FIELDS.half]),
        track: toSnake(rec.fields[MPOPP_FIELDS.track]),
        allocated: num(rec.fields[MPOPP_FIELDS.allocated]),
        spent: num(rec.fields[MPOPP_FIELDS.spent]),
        notes: str(rec.fields[MPOPP_FIELDS.notes]),
        airtable_id: rec.id,
      });
      result.inserted++;
    } catch (err) {
      result.errors.push(`MPOPP ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  console.log(`syncMpoppFunding: ${result.inserted} upserted, ${result.errors.length} errors`);
  return result;
}

export async function syncMdfFunding(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const [atRecords, partnerMap] = await Promise.all([
    fetchAllRecords(RING3_TABLES.mdfFunding),
    buildPartnerLookup(),
  ]);

  for (const rec of atRecords) {
    try {
      const partnerId = resolveLinkedRecord(rec.fields[MDF_FIELDS.partners], partnerMap);
      if (!partnerId) {
        result.errors.push(`Skipped MDF ${rec.id}: no partner resolved`);
        continue;
      }

      await upsertMdfFunding({
        partner_id: partnerId,
        record_name: str(rec.fields[MDF_FIELDS.recordName]),
        allocated: num(rec.fields[MDF_FIELDS.allocated]),
        utilized: num(rec.fields[MDF_FIELDS.utilized]),
        date_allocated: str(rec.fields[MDF_FIELDS.dateAllocated]),
        source: toSnake(rec.fields[MDF_FIELDS.source]),
        recurrence: toSnake(rec.fields[MDF_FIELDS.recurrence]),
        notes: str(rec.fields[MDF_FIELDS.notes]),
        airtable_id: rec.id,
      });
      result.inserted++;
    } catch (err) {
      result.errors.push(`MDF ${rec.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  console.log(`syncMdfFunding: ${result.inserted} upserted, ${result.errors.length} errors`);
  return result;
}

// ── Orchestration ───────────────────────────────────────────

export async function syncAllCatalogs(): Promise<SyncAllResult> {
  const start = Date.now();

  // Run sequentially to respect Airtable rate limits.
  // Partners sync first — other entities may reference them.
  // Ring 1+2: catalog entities (partners first — others reference them)
  const partners = await syncPartners();
  const programs = await syncPrograms();
  const events = await syncEvents();

  // Ring 3: posture data (depends on partners, programs, events being synced)
  const partnerGoals = await syncPartnerGoals();
  const partnerProgramEnrollments = await syncPartnerProgramEnrollments();
  const partnerEventParticipations = await syncPartnerEventParticipations();
  const mpoppFunding = await syncMpoppFunding();
  const mdfFunding = await syncMdfFunding();

  return {
    partners,
    programs,
    events,
    partnerGoals,
    partnerProgramEnrollments,
    partnerEventParticipations,
    mpoppFunding,
    mdfFunding,
    duration_ms: Date.now() - start,
  };
}

export async function syncEntity(
  entity: "partners" | "programs" | "events" | "engagements" | "meetings"
): Promise<SyncAllResult> {
  const start = Date.now();
  const result: SyncAllResult = { duration_ms: 0 };

  if (entity === "partners") result.partners = await syncPartners();
  else if (entity === "programs") result.programs = await syncPrograms();
  else if (entity === "events") result.events = await syncEvents();
  else if (entity === "engagements") result.engagements = await syncEngagementsToAirtable();
  else if (entity === "meetings") result.meetings = await syncMeetingsToAirtable();

  result.duration_ms = Date.now() - start;
  return result;
}
