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
  ENGAGEMENTS_TABLE, MEETINGS_TABLE,
  ENF, MF, MEETING_TYPE_DISPLAY,
} from "./field-maps";
import { NOTES_MARKER, NOTES_FOOTER } from "./field-maps";
import { hasChanges, STATUS_TO_AIRTABLE } from "./utils";
import { mapMeetingStatus } from "./utils";
import type { SyncResult } from "./pull";
import { renderContact } from "../contact-parser";
import { getContactsByMeeting } from "../db/participants";

export interface PushResult {
  action: "created" | "updated" | "unchanged" | "skipped";
  airtable_record_id?: string;
  reason?: string;
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

/** Build partner DB id → AT record id and DB id → name lookups */
async function fetchPartnerMaps(): Promise<{
  partnerDbToAtId: Map<string, string>;
  partnerDbToName: Map<string, string>;
}> {
  const supabase = getSupabaseClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name, airtable_record_id");

  const partnerDbToAtId = new Map<string, string>();
  const partnerDbToName = new Map<string, string>();
  for (const p of (partners ?? []) as { id: string; name: string; airtable_record_id: string | null }[]) {
    if (p.airtable_record_id) partnerDbToAtId.set(p.id, p.airtable_record_id);
    partnerDbToName.set(p.id, p.name);
  }
  return { partnerDbToAtId, partnerDbToName };
}

// ── Engagement participant helpers ──────────────────────────

interface EngagementParticipant {
  name: string | null;
  email: string | null;
  title: string | null;
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
    .from("engagement_participants")
    .select("participant_id, engagement_id");

  if (engagementIds && engagementIds.length > 0) {
    linkQuery = linkQuery.in("engagement_id", engagementIds);
  }

  const { data: links, error: linkErr } = await linkQuery;
  if (linkErr || !links || links.length === 0) return result;

  const participantIds = [...new Set(
    (links as { participant_id: string; engagement_id: string }[]).map((l) => l.participant_id)
  )];

  const { data: participants, error: pErr } = await supabase
    .from("participants")
    .select("id, name, email, title, organization")
    .in("id", participantIds);

  if (pErr || !participants) return result;

  const pById = new Map<string, EngagementParticipant>();
  for (const p of participants as { id: string; name: string | null; email: string | null; title: string | null; organization: string | null }[]) {
    pById.set(p.id, { name: p.name, email: p.email, title: p.title, organization: p.organization });
  }

  for (const link of links as { participant_id: string; engagement_id: string }[]) {
    const participant = pById.get(link.participant_id);
    if (!participant) continue;
    const existing = result.get(link.engagement_id) ?? [];
    existing.push(participant);
    result.set(link.engagement_id, existing);
  }

  return result;
}

// ── Engagement field builder ────────────────────────────────

interface EngagementLookups {
  partnerDbToAtId: Map<string, string>;
  partnerDbToName: Map<string, string>;
  programDbToAtId: Map<string, string>;
  engagementRelAtIds: Map<string, string[]>;
  engagementEventAtIds: Map<string, string[]>;
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
  if (engagement.topic) fields[ENF.topic] = engagement.topic;
  if (engagement.goal) fields[ENF.goal] = engagement.goal;

  const partnerId = engagement.partner_id as string | null;
  if (partnerId) {
    const atId = lookups.partnerDbToAtId.get(partnerId);
    if (atId) {
      fields[ENF.partner] = [atId];
    } else {
      console.warn(`Partner DB id "${partnerId}" not found in Airtable`);
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

  const eventAtIds = lookups.engagementEventAtIds.get(engagement.id as string);
  if (eventAtIds && eventAtIds.length > 0) {
    fields[ENF.event] = eventAtIds;
  }

  if (participants && participants.length > 0) {
    const awsNames: string[] = [];
    const partnerNames: string[] = [];
    const thirdPartyNames: string[] = [];
    const resolvedPartnerName = partnerId ? lookups.partnerDbToName.get(partnerId) ?? "" : "";
    const partnerNameLower = resolvedPartnerName.toLowerCase();

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
        title: p.title || null,
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
    partnerMaps,
    participantMap,
    { data: programs },
    { data: junctions },
    { data: relationships },
    { data: eventLinks },
    { data: events },
  ] = await Promise.all([
    fetchPartnerMaps(),
    fetchEngagementParticipants([engagementId]),
    supabase.from("programs").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("engagement_relationships").select("engagement_id, relationship_id").eq("engagement_id", engagementId),
    supabase.from("relationships").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("engagement_events").select("engagement_id, event_id").eq("engagement_id", engagementId),
    supabase.from("events").select("id, airtable_record_id").not("airtable_record_id", "is", null),
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
  for (const j of (junctions ?? []) as { engagement_id: string; relationship_id: string }[]) {
    const atId = relDbToAtId.get(j.relationship_id);
    if (atId) {
      const existing = engagementRelAtIds.get(j.engagement_id) ?? [];
      existing.push(atId);
      engagementRelAtIds.set(j.engagement_id, existing);
    }
  }

  const eventDbToAtId = new Map<string, string>();
  for (const e of (events ?? []) as { id: string; airtable_record_id: string }[]) {
    eventDbToAtId.set(e.id, e.airtable_record_id);
  }

  const engagementEventAtIds = new Map<string, string[]>();
  for (const link of (eventLinks ?? []) as { engagement_id: string; event_id: string }[]) {
    const atId = eventDbToAtId.get(link.event_id);
    if (atId) {
      const existing = engagementEventAtIds.get(link.engagement_id) ?? [];
      existing.push(atId);
      engagementEventAtIds.set(link.engagement_id, existing);
    }
  }

  const lookups: EngagementLookups = { partnerDbToAtId: partnerMaps.partnerDbToAtId, partnerDbToName: partnerMaps.partnerDbToName, programDbToAtId, engagementRelAtIds, engagementEventAtIds };
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
    partnerMaps,
    participantMap,
    { data: programs },
    { data: junctions },
    { data: relationships },
    { data: eventLinks },
    { data: events },
  ] = await Promise.all([
      supabase.from("engagements").select("*"),
      fetchAllRecords(ENGAGEMENTS_TABLE),
      fetchPartnerMaps(),
      fetchEngagementParticipants(),
      supabase.from("programs").select("id, airtable_record_id").not("airtable_record_id", "is", null),
      supabase.from("engagement_relationships").select("engagement_id, relationship_id"),
      supabase.from("relationships").select("id, airtable_record_id").not("airtable_record_id", "is", null),
      supabase.from("engagement_events").select("engagement_id, event_id"),
      supabase.from("events").select("id, airtable_record_id").not("airtable_record_id", "is", null),
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
  for (const j of (junctions ?? []) as { engagement_id: string; relationship_id: string }[]) {
    const atId = relDbToAtId.get(j.relationship_id);
    if (atId) {
      const existing = engagementRelAtIds.get(j.engagement_id) ?? [];
      existing.push(atId);
      engagementRelAtIds.set(j.engagement_id, existing);
    }
  }

  const eventDbToAtId = new Map<string, string>();
  for (const e of (events ?? []) as { id: string; airtable_record_id: string }[]) {
    eventDbToAtId.set(e.id, e.airtable_record_id);
  }

  const engagementEventAtIds = new Map<string, string[]>();
  for (const link of (eventLinks ?? []) as { engagement_id: string; event_id: string }[]) {
    const atId = eventDbToAtId.get(link.event_id);
    if (atId) {
      const existing = engagementEventAtIds.get(link.engagement_id) ?? [];
      existing.push(atId);
      engagementEventAtIds.set(link.engagement_id, existing);
    }
  }

  const lookups: EngagementLookups = { partnerDbToAtId: partnerMaps.partnerDbToAtId, partnerDbToName: partnerMaps.partnerDbToName, programDbToAtId, engagementRelAtIds, engagementEventAtIds };

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
  engagementDbToAtId: Map<string, string>;
  partnerDbToName: Map<string, string>;
}

async function buildMeetingLookups(): Promise<MeetingLookups> {
  const supabase = getSupabaseClient();

  const [{ data: engagements }, { data: partners }] = await Promise.all([
    supabase.from("engagements").select("id, airtable_record_id").not("airtable_record_id", "is", null),
    supabase.from("partners").select("id, name"),
  ]);

  const engagementDbToAtId = new Map<string, string>();
  for (const e of (engagements ?? []) as { id: string; airtable_record_id: string }[]) {
    engagementDbToAtId.set(e.id, e.airtable_record_id);
  }

  const partnerDbToName = new Map<string, string>();
  for (const p of (partners ?? []) as { id: string; name: string }[]) {
    partnerDbToName.set(p.id, p.name);
  }

  return { engagementDbToAtId, partnerDbToName };
}

interface MeetingRegistryContact {
  name: string | null;
  email: string;
  title: string | null;
  org_type: string | null;
}

function buildMeetingFields(
  meeting: Record<string, unknown>,
  lookups: MeetingLookups,
  meetingContacts?: MeetingRegistryContact[] | null
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
  if (meeting.meeting_type) {
    const mt = meeting.meeting_type as string;
    fields[MF.meetingType] = MEETING_TYPE_DISPLAY[mt] || mt;
  }
  if (meeting.notes) fields[MF.notes] = meeting.notes;

  // Engagement is THE link — Partner, Program, Event, AWS Relationships
  // are displayed in AT via lookup fields from the Engagement.
  const engagementId = meeting.engagement_id as string | null;
  if (engagementId) {
    const atId = lookups.engagementDbToAtId.get(engagementId);
    if (atId) fields[MF.engagement] = [atId];
  }

  // Attendees → AWS / Partner / Third Party (three-bucket split, matches engagement pattern)
  const awsRendered: string[] = [];
  const partnerRendered: string[] = [];
  const thirdPartyRendered: string[] = [];

  if (meetingContacts && meetingContacts.length > 0) {
    // Registry path: use org_type for bucketing
    for (const c of meetingContacts) {
      const email = c.email.toLowerCase();
      if (
        !email ||
        email.includes("relay.stevenromero.dev") ||
        email.includes("salesforce") ||
        isUserEmail(email)
      ) {
        continue;
      }

      const rendered = renderContact({ name: c.name, email: c.email, title: c.title });

      if (c.org_type === "internal") {
        awsRendered.push(rendered);
      } else if (c.org_type === "partner") {
        partnerRendered.push(rendered);
      } else {
        thirdPartyRendered.push(rendered);
      }
    }
  }

  if (awsRendered.length > 0) fields[MF.awsStakeholders] = awsRendered.join("\n");
  if (partnerRendered.length > 0) fields[MF.partnerStakeholders] = partnerRendered.join("\n");
  if (thirdPartyRendered.length > 0) fields[MF.thirdParties] = thirdPartyRendered.join("\n");

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

  // Engagement gate — ICS-parsed meetings without an engagement don't push yet.
  // They get linked to an engagement later via classification, which re-triggers push.
  // Manual meetings are intentionally partner-level and push without an engagement.
  if (!meeting.engagement_id && meeting.source === "ics_parsed") {
    console.log(`Skipping AT push for meeting "${meeting.title}" — ICS meeting, no engagement linked yet`);
    return { action: "skipped" as const, reason: "no_engagement" };
  }

  if (!meeting.engagement_id && meeting.source === "manual") {
    console.log(`Pushing manual meeting "${meeting.title}" to Airtable (no engagement)`);
  }

  const [lookups, registryContacts] = await Promise.all([
    buildMeetingLookups(),
    getContactsByMeeting(meetingId),
  ]);
  const meetingContacts = registryContacts.map(c => ({
    name: c.name,
    email: c.email,
    title: c.title,
    org_type: c.org_type,
  }));
  const fields = buildMeetingFields(meeting, lookups, meetingContacts);

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
      // Engagement gate — skip meetings without an engagement
      if (!mtg.engagement_id) {
        continue;
      }

      const rc = await getContactsByMeeting(mtg.id);
      const mtgContacts = rc.map(c => ({
        name: c.name,
        email: c.email,
        title: c.title,
        org_type: c.org_type,
      }));
      const fields = buildMeetingFields(mtg, lookups, mtgContacts);

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
