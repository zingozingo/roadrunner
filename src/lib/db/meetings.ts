import { getSupabaseClient } from "./client";
import { Meeting, MeetingAttendee, ParsedMeeting, Partner } from "../types";

export async function getMeetingsWithEngagements(): Promise<
  (Meeting & { engagement_name: string | null; event_name: string | null })[]
> {
  const db = getSupabaseClient();
  const { data: meetings, error } = await db
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);

  // Resolve engagement names
  const engagementIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const m of (meetings ?? []) as Meeting[]) {
    if (m.engagement_id) engagementIds.add(m.engagement_id);
    if (m.event_id) eventIds.add(m.event_id);
  }

  const engagementNames = new Map<string, string>();
  if (engagementIds.size > 0) {
    const { data: engagements } = await db
      .from("engagements")
      .select("id, name")
      .in("id", [...engagementIds]);

    for (const e of engagements ?? []) {
      const row = e as { id: string; name: string };
      engagementNames.set(row.id, row.name);
    }
  }

  // Resolve event names
  const eventNames = new Map<string, string>();
  if (eventIds.size > 0) {
    const { data: events } = await db
      .from("events")
      .select("id, name")
      .in("id", [...eventIds]);

    for (const e of events ?? []) {
      const row = e as { id: string; name: string };
      eventNames.set(row.id, row.name);
    }
  }

  return ((meetings ?? []) as Meeting[]).map((m) => ({
    ...m,
    engagement_name: m.engagement_id ? engagementNames.get(m.engagement_id) ?? null : null,
    event_name: m.event_id ? eventNames.get(m.event_id) ?? null : null,
  }));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch meeting: ${error.message}`);
  return data as Meeting | null;
}

export async function getMeetingsByEngagement(engagementId: string): Promise<Meeting[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);
  return (data ?? []) as Meeting[];
}

export async function getMeetingsByAwsRelationship(relationshipId: string): Promise<Meeting[]> {
  const db = getSupabaseClient();

  const { data: junctionRows, error: junctionErr } = await db
    .from("meeting_aws_relationships")
    .select("meeting_id")
    .eq("aws_relationship_id", relationshipId);

  if (junctionErr) throw new Error(`Failed to fetch meeting junctions: ${junctionErr.message}`);

  const ids = (junctionRows ?? []).map((r: { meeting_id: string }) => r.meeting_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("meetings")
    .select("*")
    .in("id", ids)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);
  return (data ?? []) as Meeting[];
}

export async function getMeetingsByEvent(eventId: string): Promise<Meeting[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("*")
    .eq("event_id", eventId)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);
  return (data ?? []) as Meeting[];
}

export async function getMeetingsByProgram(programId: string): Promise<Meeting[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("*")
    .eq("program_id", programId)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);
  return (data ?? []) as Meeting[];
}

export async function createMeeting(data: {
  title: string;
  engagement_id?: string | null;
  event_id?: string | null;
  program_id?: string | null;
  partner_name?: string | null;
  status?: string;
  meeting_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  organizer_email?: string | null;
  attendees?: MeetingAttendee[];
  notes?: string | null;
  source?: Meeting["source"];
}): Promise<Meeting> {
  const db = getSupabaseClient();

  // Resolve partner_id from partner_name (inline to avoid cross-module dep)
  let partnerId: string | null = null;
  if (data.partner_name) {
    const { data: partnerRows } = await db
      .from("partners")
      .select("id")
      .ilike("name", data.partner_name)
      .limit(1);
    if (partnerRows && partnerRows.length > 0) {
      partnerId = (partnerRows[0] as { id: string }).id;
    }
  }

  const { data: meeting, error } = await db
    .from("meetings")
    .insert({
      title: data.title,
      engagement_id: data.engagement_id ?? null,
      event_id: data.event_id ?? null,
      program_id: data.program_id ?? null,
      partner_name: data.partner_name ?? null,
      partner_id: partnerId,
      status: data.status ?? "scheduled",
      meeting_date: data.meeting_date ?? null,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      location: data.location ?? null,
      organizer_email: data.organizer_email ?? null,
      attendees: data.attendees ?? [],
      notes: data.notes ?? null,
      source: data.source ?? "manual",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create meeting: ${error.message}`);

  // Fire-and-forget: push to Airtable
  const mtgResult = meeting as Meeting;
  import("../sync")
    .then(({ pushMeetingToAirtable }) => pushMeetingToAirtable(mtgResult.id))
    .catch((err) => console.error(`Airtable push failed for meeting ${mtgResult.id}:`, err));

  return mtgResult;
}

export async function updateMeeting(
  id: string,
  updates: {
    title?: string;
    engagement_id?: string | null;
    event_id?: string | null;
    program_id?: string | null;
    partner_name?: string | null;
    status?: string;
    meeting_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    organizer_email?: string | null;
    attendees?: MeetingAttendee[];
    notes?: string | null;
  }
): Promise<Meeting> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update meeting: ${error.message}`);
  return data as Meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const db = getSupabaseClient();

  // Fire-and-forget: delete from Airtable if synced
  const { data: mtg } = await db
    .from("meetings")
    .select("airtable_record_id")
    .eq("id", id)
    .maybeSingle();

  if (mtg?.airtable_record_id) {
    import("../sync")
      .then(({ deleteMeetingFromAirtable }) =>
        deleteMeetingFromAirtable(mtg.airtable_record_id)
      )
      .catch((err) =>
        console.error(`Airtable delete failed for meeting ${id}:`, err)
      );
  }

  // 1. Delete junction records
  const { error: junctionErr } = await db
    .from("meeting_aws_relationships")
    .delete()
    .eq("meeting_id", id);
  if (junctionErr) throw new Error(`Failed to delete meeting relationships: ${junctionErr.message}`);

  // 2. Delete the meeting
  const { error } = await db
    .from("meetings")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete meeting: ${error.message}`);
}

export async function linkMeetingAwsRelationship(
  meetingId: string,
  relationshipId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("meeting_aws_relationships")
    .insert({ meeting_id: meetingId, aws_relationship_id: relationshipId });

  if (error) throw new Error(`Failed to link relationship: ${error.message}`);
}

export async function linkEngagementAwsRelationship(
  engagementId: string,
  relationshipId: string
): Promise<void> {
  const db = getSupabaseClient();

  // Check for existing to avoid duplicates
  const { data: existing } = await db
    .from("engagement_aws_relationships")
    .select("engagement_id")
    .eq("engagement_id", engagementId)
    .eq("aws_relationship_id", relationshipId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { error } = await db
    .from("engagement_aws_relationships")
    .insert({ engagement_id: engagementId, aws_relationship_id: relationshipId });

  if (error) throw new Error(`Failed to link engagement to relationship: ${error.message}`);
}

/**
 * Match a partner from meeting attendee email domains.
 * Scans non-Amazon attendee domains against partner contact emails.
 * Returns the partner if exactly one matches; null if zero or ambiguous.
 */
export async function matchPartnerFromAttendees(
  attendees: MeetingAttendee[]
): Promise<{ partner_id: string | null; partner_name: string | null }> {
  const none = { partner_id: null, partner_name: null };
  if (attendees.length === 0) return none;

  // Collect unique non-Amazon domains from attendees
  const attendeeDomains = new Set<string>();
  for (const a of attendees) {
    if (!a.email) continue;
    const email = a.email.toLowerCase();
    if (email.endsWith("@amazon.com") || email.endsWith("@amazon.co.uk")) continue;
    const domain = email.split("@")[1];
    if (domain) attendeeDomains.add(domain);
  }
  if (attendeeDomains.size === 0) return none;

  // Inline partner query to avoid cross-module dep
  const { data: partnerData, error } = await getSupabaseClient()
    .from("partners")
    .select("*")
    .order("name", { ascending: true });

  if (error || !partnerData) return none;

  const partners = partnerData as Partner[];
  const matchedPartnerIds = new Set<string>();
  const matchedPartnerMap = new Map<string, string>(); // id → name

  for (const partner of partners) {
    const partnerDomains = new Set<string>();
    // Collect domains from partner contact emails
    for (const emailField of [
      partner.alliance_lead_email,
      partner.psa_email,
      partner.account_manager_email,
      partner.pmm_email,
    ]) {
      if (emailField) {
        const d = emailField.toLowerCase().split("@")[1];
        // Skip amazon.com — PSA/AM/PMM are AWS staff, not partner domains
        if (d && !d.endsWith("amazon.com") && !d.endsWith("amazon.co.uk")) {
          partnerDomains.add(d);
        }
      }
    }
    for (const email of partner.partner_contact_emails ?? []) {
      const d = email.toLowerCase().split("@")[1];
      if (d) partnerDomains.add(d);
    }

    // Check if any attendee domain matches this partner
    for (const ad of attendeeDomains) {
      if (partnerDomains.has(ad)) {
        matchedPartnerIds.add(partner.id);
        matchedPartnerMap.set(partner.id, partner.name);
        break;
      }
    }
  }

  if (matchedPartnerIds.size === 1) {
    const id = [...matchedPartnerIds][0];
    return { partner_id: id, partner_name: matchedPartnerMap.get(id) ?? null };
  }

  return none; // zero or ambiguous
}

/**
 * Create or update a meeting record from parsed ICS data.
 * Handles three scenarios:
 *   (a) NEW meeting — insert with partner matching from attendees
 *   (b) CANCELLATION — update existing meeting status to 'cancelled'
 *   (c) UPDATE — sequence-aware update of existing meeting fields
 * Never throws — logs errors and returns null.
 */
export async function createMeetingFromICS(
  parsed: ParsedMeeting,
  messageId: string
): Promise<string | null> {
  try {
    const db = getSupabaseClient();

    // Check for existing meeting by ics_uid
    const { data: existing } = await db
      .from("meetings")
      .select("id, sequence")
      .eq("ics_uid", parsed.ics_uid)
      .maybeSingle();

    // --- Scenario (b): Cancellation of existing meeting ---
    if (existing && parsed.is_cancellation) {
      const updates: Record<string, unknown> = { status: "cancelled" };
      if (parsed.title !== undefined) updates.title = parsed.title;

      const { error } = await db
        .from("meetings")
        .update(updates)
        .eq("id", existing.id);

      if (error) {
        console.error(`Failed to cancel meeting: ${error.message}`);
        return null;
      }
      console.log(`Cancelled meeting: ${parsed.title} (${existing.id})`);

      // Fire-and-forget: push updated status to Airtable
      import("../sync")
        .then(({ pushMeetingToAirtable }) => pushMeetingToAirtable(existing.id))
        .catch((err) => console.error(`Airtable push failed for meeting ${existing.id}:`, err));

      return existing.id;
    }

    // --- Scenario (c): Update existing meeting ---
    if (existing) {
      // Sequence check: only update if incoming >= stored (or stored is null)
      const storedSeq = existing.sequence as number | null;
      const incomingSeq = parsed.sequence;
      if (storedSeq !== null && incomingSeq !== null && incomingSeq < storedSeq) {
        console.log(`Skipping stale ICS update: sequence ${incomingSeq} < stored ${storedSeq}`);
        return existing.id;
      }

      const partner = await matchPartnerFromAttendees(parsed.attendees);

      const updates: Record<string, unknown> = {
        title: parsed.title,
        meeting_date: parsed.meeting_date,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        location: parsed.location,
        organizer_email: parsed.organizer_email,
        attendees: parsed.attendees,
        sequence: parsed.sequence,
        is_recurring: parsed.is_recurring,
      };
      if (partner.partner_id) {
        updates.partner_id = partner.partner_id;
        updates.partner_name = partner.partner_name;
      }

      const { error } = await db
        .from("meetings")
        .update(updates)
        .eq("id", existing.id);

      if (error) {
        console.error(`Failed to update meeting: ${error.message}`);
        return null;
      }
      console.log(`Updated meeting from ICS: ${parsed.title} (${existing.id})`);

      // Fire-and-forget: push to Airtable
      import("../sync")
        .then(({ pushMeetingToAirtable }) => pushMeetingToAirtable(existing.id))
        .catch((err) => console.error(`Airtable push failed for meeting ${existing.id}:`, err));

      return existing.id;
    }

    // --- Scenario (a): New meeting ---
    const partner = await matchPartnerFromAttendees(parsed.attendees);

    const { data, error } = await db
      .from("meetings")
      .insert({
        title: parsed.title,
        meeting_date: parsed.meeting_date,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        location: parsed.location,
        organizer_email: parsed.organizer_email,
        attendees: parsed.attendees,
        ics_uid: parsed.ics_uid,
        sequence: parsed.sequence,
        is_recurring: parsed.is_recurring,
        source: "ics_parsed",
        status: parsed.is_cancellation ? "cancelled" : "scheduled",
        message_id: messageId,
        partner_id: partner.partner_id,
        partner_name: partner.partner_name,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to create meeting from ICS: ${error.message}`);
      return null;
    }

    console.log(`Created meeting from ICS: ${parsed.title} (${parsed.meeting_date})`);

    // Fire-and-forget: push to Airtable
    import("../sync")
      .then(({ pushMeetingToAirtable }) => pushMeetingToAirtable(data.id))
      .catch((err) => console.error(`Airtable push failed for meeting ${data.id}:`, err));

    return data.id;
  } catch (err) {
    console.error("createMeetingFromICS error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Link a meeting to an engagement after classification.
 * Finds the meeting by message_id and sets engagement_id + partner_name.
 * The IS NULL guard prevents overwriting manually linked meetings.
 * Never throws — logs errors silently.
 */
export async function linkMeetingToEngagement(
  messageId: string,
  engagementId: string
): Promise<void> {
  try {
    const db = getSupabaseClient();

    // Look up partner_name and partner_id from the engagement
    const { data: engagement } = await db
      .from("engagements")
      .select("partner_name, partner_id")
      .eq("id", engagementId)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      engagement_id: engagementId,
    };
    if (engagement?.partner_name) {
      updates.partner_name = engagement.partner_name;
    }
    if (engagement?.partner_id) {
      updates.partner_id = engagement.partner_id;
    }

    const { data, error } = await db
      .from("meetings")
      .update(updates)
      .eq("message_id", messageId)
      .is("engagement_id", null)
      .select("id");

    if (error) {
      console.error(`Failed to link meeting to engagement: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      console.log(`Linked meeting to engagement: ${engagementId}`);

      // Fire-and-forget: push updated meeting(s) to Airtable
      for (const row of data as { id: string }[]) {
        import("../sync")
          .then(({ pushMeetingToAirtable }) => pushMeetingToAirtable(row.id))
          .catch((err) => console.error(`Airtable push failed for meeting ${row.id}:`, err));
      }
    }
  } catch (err) {
    console.error("linkMeetingToEngagement error:", err instanceof Error ? err.message : err);
  }
}
