/**
 * Supabase → Airtable activity sync.
 * Push engagements and meetings from Roadrunner to Airtable.
 */

import {
  fetchAllRecords,
  fetchRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "../airtable";
import { getSupabaseClient } from "../db";
import { isUserEmail } from "../user-config";
import {
  ENGAGEMENTS_TABLE, MEETINGS_TABLE, PARTNERS_TABLE,
  ENF, MF,
} from "./field-maps";
import { NOTES_MARKER, NOTES_FOOTER } from "./field-maps";
import { hasChanges, STATUS_TO_AIRTABLE } from "./utils";
import { mapMeetingStatus } from "./utils";
import type { SyncResult } from "./pull";
import { renderContact } from "../contact-parser";

export interface PushResult {
  action: "created" | "updated" | "unchanged";
  airtable_record_id: string;
}

// ── Notes helpers ───────────────────────────────────────────

function buildNotesContent(
  currentState: string | null
): string {
  const parts = [NOTES_MARKER, ""];
  if (currentState) parts.push(currentState, "");
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

// ── Partner lookup helpers ──────────────────────────────────

/** Build a recordId → partner name lookup from the Partners table */
async function fetchPartnerLookup(): Promise<Map<string, string>> {
  try {
    const records = await fetchAllRecords(PARTNERS_TABLE);
    const map = new Map<string, string>();
    for (const rec of records) {
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

/** Build name → recordId reverse lookup from the Partners table */
async function fetchPartnerNameToIdMap(): Promise<Map<string, string>> {
  const lookup = await fetchPartnerLookup();
  const reversed = new Map<string, string>();
  for (const [recordId, name] of lookup) {
    reversed.set(name.toLowerCase(), recordId);
  }
  return reversed;
}

// ── Engagement participant helpers ──────────────────────────

interface EngagementParticipant {
  name: string | null;
  email: string | null;
  organization: string | null;
}

/**
 * Batch-fetch all participants linked to engagements.
 * Returns a map of engagement_id → participant[].
 * Used by both single-push and bulk-sync paths.
 */
async function fetchEngagementParticipants(
  engagementIds?: string[]
): Promise<Map<string, EngagementParticipant[]>> {
  const supabase = getSupabaseClient();
  const result = new Map<string, EngagementParticipant[]>();

  let linkQuery = supabase
    .from("participant_links")
    .select("participant_id, entity_id")
    .eq("entity_type", "engagement");

  if (engagementIds && engagementIds.length > 0) {
    linkQuery = linkQuery.in("entity_id", engagementIds);
  }

  const { data: links, error: linkErr } = await linkQuery;
  if (linkErr || !links || links.length === 0) return result;

  const participantIds = [...new Set(
    (links as { participant_id: string; entity_id: string }[]).map((l) => l.participant_id)
  )];

  const { data: participants, error: pErr } = await supabase
    .from("participants")
    .select("id, name, email, organization")
    .in("id", participantIds);

  if (pErr || !participants) return result;

  const pById = new Map<string, EngagementParticipant>();
  for (const p of participants as { id: string; name: string | null; email: string | null; organization: string | null }[]) {
    pById.set(p.id, { name: p.name, email: p.email, organization: p.organization });
  }

  for (const link of links as { participant_id: string; entity_id: string }[]) {
    const participant = pById.get(link.participant_id);
    if (!participant) continue;
    const existing = result.get(link.entity_id) ?? [];
    existing.push(participant);
    result.set(link.entity_id, existing);
  }

  return result;
}

// ── Engagement field builder ────────────────────────────────

interface EngagementLookups {
  partnerNameToId: Map<string, string>;
  programDbToAtId: Map<string, string>;
  engagementRelAtIds: Map<string, string[]>;
}

function buildEngagementFields(
  engagement: Record<string, unknown>,
  lookups: EngagementLookups,
  participants?: EngagementParticipant[]
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    [ENF.name]: engagement.name,
    [ENF.roadrunnerId]: engagement.id,
    [ENF.status]: STATUS_TO_AIRTABLE[engagement.status as string] ?? "Active",
  };

  if (engagement.pillar) fields[ENF.pillar] = engagement.pillar;

  const partnerName = engagement.partner_name as string | null;
  if (partnerName) {
    const partnerId = lookups.partnerNameToId.get(partnerName.toLowerCase());
    if (partnerId) {
      fields[ENF.partner] = [partnerId];
    } else {
      console.warn(`Partner "${partnerName}" not found in Airtable Partners table`);
    }
  }

  const programId = engagement.program_id as string | null;
  if (programId) {
    const atId = lookups.programDbToAtId.get(programId);
    if (atId) fields[ENF.program] = [atId];
  }

  const relAtIds = lookups.engagementRelAtIds.get(engagement.id as string);
  if (relAtIds && relAtIds.length > 0) {
    fields[ENF.awsRelationships] = relAtIds;
  }

  if (participants && participants.length > 0) {
    const awsNames: string[] = [];
    const partnerNames: string[] = [];
    const thirdPartyNames: string[] = [];
    const partnerNameLower = partnerName?.toLowerCase() ?? "";

    for (const p of participants) {
      const email = (p.email ?? "").toLowerCase();
      const org = (p.organization ?? "").toLowerCase();
      if (
        !email && !p.name ||
        email.includes("relay.stevenromero.dev") ||
        email.includes("salesforce") ||
        (email && isUserEmail(email))
      ) {
        continue;
      }

      const rendered = renderContact({
        name: p.name || null,
        email: p.email || null,
        title: null,
      });

      const isAws =
        email.includes("@amazon.com") ||
        org.includes("aws") ||
        org.includes("amazon");

      const isPartner =
        !isAws &&
        partnerNameLower &&
        org.includes(partnerNameLower);

      if (isAws) {
        awsNames.push(rendered);
      } else if (isPartner) {
        partnerNames.push(rendered);
      } else {
        thirdPartyNames.push(rendered);
      }
    }

    if (awsNames.length > 0) fields[ENF.awsStakeholders] = awsNames.join("\n");
    if (partnerNames.length > 0) fields[ENF.partnerStakeholders] = partnerNames.join("\n");
    if (thirdPartyNames.length > 0) fields[ENF.thirdParties] = thirdPartyNames.join("\n");
  }

  return fields;
}

// ── Engagement push ─────────────────────────────────────────

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

  const [
    partnerNameToId,
    participantMap,
    { data: programs },
    { data: junctions },
    { data: relationships },
  ] = await Promise.all([
    fetchPartnerNameToIdMap(),
    fetchEngagementParticipants([engagementId]),
    supabase.from("programs").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("engagement_aws_relationships").select("engagement_id, aws_relationship_id").eq("engagement_id", engagementId),
    supabase.from("aws_relationships").select("id, airtable_record_id").not("airtable_record_id", "is", null),
  ]);

  const programDbToAtId = new Map<string, string>();
  for (const p of (programs ?? []) as { id: string; airtable_record_id: string }[]) {
    programDbToAtId.set(p.id, p.airtable_record_id);
  }

  const relDbToAtId = new Map<string, string>();
  for (const r of (relationships ?? []) as { id: string; airtable_record_id: string }[]) {
    relDbToAtId.set(r.id, r.airtable_record_id);
  }

  const engagementRelAtIds = new Map<string, string[]>();
  for (const j of (junctions ?? []) as { engagement_id: string; aws_relationship_id: string }[]) {
    const atId = relDbToAtId.get(j.aws_relationship_id);
    if (atId) {
      const existing = engagementRelAtIds.get(j.engagement_id) ?? [];
      existing.push(atId);
      engagementRelAtIds.set(j.engagement_id, existing);
    }
  }

  const lookups: EngagementLookups = { partnerNameToId, programDbToAtId, engagementRelAtIds };
  const fields = buildEngagementFields(
    engagement, lookups, participantMap.get(engagementId)
  );
  const roadrunnerNotes = buildNotesContent(
    engagement.current_state
  );

  let atRecordId: string | null = engagement.airtable_record_id;
  let existingNotes: string | null = null;

  if (atRecordId) {
    try {
      const existing = await fetchRecord(ENGAGEMENTS_TABLE, atRecordId);
      existingNotes = (existing.fields[ENF.notes] as string) ?? null;
    } catch {
      atRecordId = null;
    }
  }

  if (!atRecordId) {
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

  const [
    { data: engagements, error: fetchErr },
    atRecords,
    partnerNameToId,
    participantMap,
    { data: programs },
    { data: junctions },
    { data: relationships },
  ] = await Promise.all([
      supabase.from("engagements").select("*"),
      fetchAllRecords(ENGAGEMENTS_TABLE),
      fetchPartnerNameToIdMap(),
      fetchEngagementParticipants(),
      supabase.from("programs").select("id, airtable_record_id").not("airtable_record_id", "is", null),
      supabase.from("engagement_aws_relationships").select("engagement_id, aws_relationship_id"),
      supabase.from("aws_relationships").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    ]);

  if (fetchErr) throw new Error(`Failed to fetch engagements: ${fetchErr.message}`);

  const programDbToAtId = new Map<string, string>();
  for (const p of (programs ?? []) as { id: string; airtable_record_id: string }[]) {
    programDbToAtId.set(p.id, p.airtable_record_id);
  }

  const relDbToAtId = new Map<string, string>();
  for (const r of (relationships ?? []) as { id: string; airtable_record_id: string }[]) {
    relDbToAtId.set(r.id, r.airtable_record_id);
  }

  const engagementRelAtIds = new Map<string, string[]>();
  for (const j of (junctions ?? []) as { engagement_id: string; aws_relationship_id: string }[]) {
    const atId = relDbToAtId.get(j.aws_relationship_id);
    if (atId) {
      const existing = engagementRelAtIds.get(j.engagement_id) ?? [];
      existing.push(atId);
      engagementRelAtIds.set(j.engagement_id, existing);
    }
  }

  const lookups: EngagementLookups = { partnerNameToId, programDbToAtId, engagementRelAtIds };

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
      const fields = buildEngagementFields(eng, lookups, participantMap.get(eng.id));
      const roadrunnerNotes = buildNotesContent(eng.current_state);

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
        fields[ENF.notes] = roadrunnerNotes;
        const created = await createRecord(ENGAGEMENTS_TABLE, fields);

        await supabase
          .from("engagements")
          .update({ airtable_record_id: created.id })
          .eq("id", eng.id);

        result.inserted++;
      }

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      result.errors.push(
        `Engagement "${eng.name}": ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return result;
}

// ── Meeting push ────────────────────────────────────────────

interface MeetingLookups {
  partnerNameToAtId: Map<string, string>;
  partnerDbToAtId: Map<string, string>;
  eventDbToAtId: Map<string, string>;
  programDbToAtId: Map<string, string>;
  engagementDbToAtId: Map<string, string>;
  meetingRelAtIds: Map<string, string[]>;
}

async function buildMeetingLookups(): Promise<MeetingLookups> {
  const supabase = getSupabaseClient();

  const [
    partnerNameToAtId,
    { data: partners },
    { data: events },
    { data: programs },
    { data: engagements },
    { data: junctions },
    { data: relationships },
  ] = await Promise.all([
    fetchPartnerNameToIdMap(),
    supabase.from("partners").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("events").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("programs").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("engagements").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("meeting_aws_relationships").select("meeting_id, aws_relationship_id"),
    supabase.from("aws_relationships").select("id, airtable_record_id").not("airtable_record_id", "is", null),
  ]);

  const partnerDbToAtId = new Map<string, string>();
  for (const p of (partners ?? []) as { id: string; airtable_record_id: string }[]) {
    partnerDbToAtId.set(p.id, p.airtable_record_id);
  }

  const eventDbToAtId = new Map<string, string>();
  for (const e of (events ?? []) as { id: string; airtable_record_id: string }[]) {
    eventDbToAtId.set(e.id, e.airtable_record_id);
  }

  const programDbToAtId = new Map<string, string>();
  for (const p of (programs ?? []) as { id: string; airtable_record_id: string }[]) {
    programDbToAtId.set(p.id, p.airtable_record_id);
  }

  const engagementDbToAtId = new Map<string, string>();
  for (const e of (engagements ?? []) as { id: string; airtable_record_id: string }[]) {
    engagementDbToAtId.set(e.id, e.airtable_record_id);
  }

  const relDbToAtId = new Map<string, string>();
  for (const r of (relationships ?? []) as { id: string; airtable_record_id: string }[]) {
    relDbToAtId.set(r.id, r.airtable_record_id);
  }

  const meetingRelAtIds = new Map<string, string[]>();
  for (const j of (junctions ?? []) as { meeting_id: string; aws_relationship_id: string }[]) {
    const atId = relDbToAtId.get(j.aws_relationship_id);
    if (atId) {
      const existing = meetingRelAtIds.get(j.meeting_id) ?? [];
      existing.push(atId);
      meetingRelAtIds.set(j.meeting_id, existing);
    }
  }

  return {
    partnerNameToAtId,
    partnerDbToAtId,
    eventDbToAtId,
    programDbToAtId,
    engagementDbToAtId,
    meetingRelAtIds,
  };
}

function buildMeetingFields(
  meeting: Record<string, unknown>,
  lookups: MeetingLookups
): Record<string, unknown> {
  const rawStatus = (meeting.status as string) || "scheduled";
  const fields: Record<string, unknown> = {
    [MF.meetingName]: meeting.title,
    [MF.roadrunnerId]: meeting.id,
    [MF.status]: mapMeetingStatus(rawStatus),
  };

  if (meeting.meeting_date) fields[MF.meetingDate] = meeting.meeting_date;
  if (meeting.start_time) fields[MF.startTime] = meeting.start_time;
  if (meeting.end_time) fields[MF.endTime] = meeting.end_time;
  if (meeting.location) fields[MF.location] = meeting.location;
  if (meeting.source) fields[MF.source] = meeting.source;
  if (meeting.ics_uid) fields[MF.icsUid] = meeting.ics_uid;

  const partnerId = meeting.partner_id as string | null;
  const partnerName = meeting.partner_name as string | null;
  if (partnerId) {
    const atId = lookups.partnerDbToAtId.get(partnerId);
    if (atId) fields[MF.partner] = [atId];
  }
  if (!fields[MF.partner] && partnerName) {
    const atId = lookups.partnerNameToAtId.get(partnerName.toLowerCase());
    if (atId) fields[MF.partner] = [atId];
  }

  const eventId = meeting.event_id as string | null;
  if (eventId) {
    const atId = lookups.eventDbToAtId.get(eventId);
    if (atId) fields[MF.event] = [atId];
  }

  const programId = meeting.program_id as string | null;
  if (programId) {
    const atId = lookups.programDbToAtId.get(programId);
    if (atId) fields[MF.program] = [atId];
  }

  const engagementId = meeting.engagement_id as string | null;
  if (engagementId) {
    const atId = lookups.engagementDbToAtId.get(engagementId);
    if (atId) fields[MF.engagement] = [atId];
  }

  const relAtIds = lookups.meetingRelAtIds.get(meeting.id as string);
  if (relAtIds && relAtIds.length > 0) {
    fields[MF.awsRelationships] = relAtIds;
  }

  const attendees = (meeting.attendees ?? []) as Record<string, unknown>[];
  const awsRendered: string[] = [];
  const partnerRendered: string[] = [];

  for (const a of attendees) {
    const email = ((a.email as string) || "").toLowerCase();
    const org = ((a.organization as string) || "").toLowerCase();

    if (
      !email ||
      email.includes("relay.stevenromero.dev") ||
      email.includes("salesforce") ||
      isUserEmail(email)
    ) {
      continue;
    }

    const rendered = renderContact({
      name: (a.name as string) || null,
      email: (a.email as string) || null,
      title: null,
    });

    const isAws =
      email.includes("@amazon.com") ||
      org.includes("aws") ||
      org.includes("amazon");

    if (isAws) {
      awsRendered.push(rendered);
    } else {
      partnerRendered.push(rendered);
    }
  }

  if (awsRendered.length > 0) fields[MF.awsContacts] = awsRendered.join("\n");
  if (partnerRendered.length > 0) fields[MF.partnerContacts] = partnerRendered.join("\n");

  return fields;
}

/**
 * Push a single meeting to Airtable.
 * Creates or updates the Airtable record, stores airtable_record_id in Supabase.
 */
export async function pushMeetingToAirtable(
  meetingId: string
): Promise<PushResult> {
  const supabase = getSupabaseClient();

  const { data: meeting, error: fetchErr } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (fetchErr || !meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  const lookups = await buildMeetingLookups();
  const fields = buildMeetingFields(meeting, lookups);

  let atRecordId: string | null = meeting.airtable_record_id;

  if (atRecordId) {
    try {
      await fetchRecord(MEETINGS_TABLE, atRecordId);
    } catch {
      atRecordId = null;
    }
  }

  if (!atRecordId) {
    const atRecords = await fetchAllRecords(MEETINGS_TABLE);

    let match = atRecords.find(
      (r) => r.fields[MF.roadrunnerId] === meetingId
    );

    if (!match) {
      match = atRecords.find((r) => {
        const atTitle = r.fields[MF.meetingName];
        const atDate = r.fields[MF.meetingDate];
        return (
          typeof atTitle === "string" &&
          atTitle.toLowerCase() === (meeting.title as string).toLowerCase() &&
          atDate === meeting.meeting_date
        );
      });
    }

    if (match) {
      atRecordId = match.id;
    }
  }

  if (atRecordId) {
    await updateRecord(MEETINGS_TABLE, atRecordId, fields);

    if (!meeting.airtable_record_id) {
      await supabase
        .from("meetings")
        .update({ airtable_record_id: atRecordId })
        .eq("id", meetingId);
    }

    return { action: "updated", airtable_record_id: atRecordId };
  } else {
    const created = await createRecord(MEETINGS_TABLE, fields);

    await supabase
      .from("meetings")
      .update({ airtable_record_id: created.id })
      .eq("id", meetingId);

    return { action: "created", airtable_record_id: created.id };
  }
}

/**
 * Delete a meeting's Airtable record by its airtable_record_id.
 * Fire-and-forget — caller should not await or depend on success.
 */
export async function deleteMeetingFromAirtable(
  airtableRecordId: string
): Promise<void> {
  await deleteRecord(MEETINGS_TABLE, airtableRecordId);
  console.log(`Deleted Airtable meeting record: ${airtableRecordId}`);
}

/**
 * Bulk sync all Roadrunner meetings to Airtable.
 * Fetches all records from both sides, matches, and creates/updates as needed.
 */
export async function syncMeetingsToAirtable(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, errors: [] };
  const supabase = getSupabaseClient();

  const [{ data: meetings, error: fetchErr }, atRecords, lookups] =
    await Promise.all([
      supabase.from("meetings").select("*"),
      fetchAllRecords(MEETINGS_TABLE),
      buildMeetingLookups(),
    ]);

  if (fetchErr) throw new Error(`Failed to fetch meetings: ${fetchErr.message}`);

  const atByRoadrunnerId = new Map<string, AirtableRecord>();
  const atByTitleDate = new Map<string, AirtableRecord>();
  for (const rec of atRecords) {
    const rrId = rec.fields[MF.roadrunnerId];
    if (typeof rrId === "string" && rrId) atByRoadrunnerId.set(rrId, rec);
    const title = rec.fields[MF.meetingName];
    const date = rec.fields[MF.meetingDate];
    if (typeof title === "string" && typeof date === "string") {
      atByTitleDate.set(`${title.toLowerCase()}|${date}`, rec);
    }
  }

  for (const mtg of meetings ?? []) {
    try {
      const fields = buildMeetingFields(mtg, lookups);

      let atRecord: AirtableRecord | undefined;
      if (mtg.airtable_record_id) {
        atRecord = atRecords.find((r) => r.id === mtg.airtable_record_id);
      }
      if (!atRecord) {
        atRecord =
          atByRoadrunnerId.get(mtg.id) ??
          atByTitleDate.get(`${(mtg.title as string).toLowerCase()}|${mtg.meeting_date}`);
      }

      if (atRecord) {
        const fieldsForCompare = { ...fields };
        const atFieldsForCompare: Record<string, unknown> = {};
        for (const key of Object.keys(fieldsForCompare)) {
          atFieldsForCompare[key] = atRecord.fields[key] ?? null;
        }
        const dataChanged = hasChanges(fieldsForCompare, atFieldsForCompare);

        if (!dataChanged) {
          result.unchanged++;
          if (!mtg.airtable_record_id) {
            await supabase
              .from("meetings")
              .update({ airtable_record_id: atRecord.id })
              .eq("id", mtg.id);
          }
          continue;
        }

        await updateRecord(MEETINGS_TABLE, atRecord.id, fields);

        if (!mtg.airtable_record_id) {
          await supabase
            .from("meetings")
            .update({ airtable_record_id: atRecord.id })
            .eq("id", mtg.id);
        }

        result.updated++;
      } else {
        const created = await createRecord(MEETINGS_TABLE, fields);

        await supabase
          .from("meetings")
          .update({ airtable_record_id: created.id })
          .eq("id", mtg.id);

        result.inserted++;
      }

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      result.errors.push(
        `Meeting "${mtg.title}": ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return result;
}
