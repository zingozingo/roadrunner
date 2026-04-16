import { getSupabaseClient } from "./client";
import { Meeting, MeetingAttendee, ParsedMeeting } from "../types";
import { syncMeetingAttendeesToRegistry, replaceMeetingParticipants, getPartnerContactDomains } from "./participants";

export async function getMeetingsWithEngagements(): Promise<
  (Meeting & { engagement_name: string | null; partner_name: string | null })[]
> {
  const db = getSupabaseClient();
  const { data: meetings, error } = await db
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);

  const typedMeetings = (meetings ?? []) as Meeting[];

  // Resolve engagement names
  const engagementIds = new Set<string>();
  for (const m of typedMeetings) {
    if (m.engagement_id) engagementIds.add(m.engagement_id);
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

  // Resolve partner names
  const partnerIds = new Set<string>();
  for (const m of typedMeetings) {
    if (m.partner_id) partnerIds.add(m.partner_id);
  }

  const partnerNames = new Map<string, string>();
  if (partnerIds.size > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);

    for (const p of partners ?? []) {
      const row = p as { id: string; name: string };
      partnerNames.set(row.id, row.name);
    }
  }

  return typedMeetings.map((m) => ({
    ...m,
    engagement_name: m.engagement_id ? engagementNames.get(m.engagement_id) ?? null : null,
    partner_name: m.partner_id ? partnerNames.get(m.partner_id) ?? null : null,
  }));
}

export async function getUpcomingMeetings(
  days: number = 7
): Promise<(Meeting & { engagement_name: string | null; partner_name: string | null; note_status: "draft" | "complete" | null })[]> {
  const db = getSupabaseClient();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const end = new Date(today);
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);

  // Fetch meetings in date range, excluding cancelled/no_show
  const { data: meetings, error } = await db
    .from("meetings")
    .select("*")
    .gte("meeting_date", todayStr)
    .lte("meeting_date", endStr)
    .not("status", "in", "(cancelled,no_show)")
    .order("meeting_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch upcoming meetings: ${error.message}`);

  const typedMeetings = (meetings ?? []) as Meeting[];
  if (typedMeetings.length === 0) return [];

  const meetingIds = typedMeetings.map((m) => m.id);

  // Fetch note statuses for these meetings (one note per meeting, unique index)
  const { data: notes } = await db
    .from("meeting_notes")
    .select("meeting_id, status")
    .in("meeting_id", meetingIds);

  const noteStatusMap = new Map<string, string>();
  for (const n of notes ?? []) {
    const row = n as { meeting_id: string; status: string };
    noteStatusMap.set(row.meeting_id, row.status);
  }

  // Filter out completed meetings with complete notes
  const filtered = typedMeetings.filter((m) => {
    if (m.status === "completed" && noteStatusMap.get(m.id) === "complete") return false;
    return true;
  });

  // Resolve engagement names
  const engagementIds = new Set<string>();
  for (const m of filtered) {
    if (m.engagement_id) engagementIds.add(m.engagement_id);
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

  // Resolve partner names
  const partnerIds = new Set<string>();
  for (const m of filtered) {
    if (m.partner_id) partnerIds.add(m.partner_id);
  }

  const partnerNames = new Map<string, string>();
  if (partnerIds.size > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);

    for (const p of partners ?? []) {
      const row = p as { id: string; name: string };
      partnerNames.set(row.id, row.name);
    }
  }

  return filtered.map((m) => ({
    ...m,
    engagement_name: m.engagement_id ? engagementNames.get(m.engagement_id) ?? null : null,
    partner_name: m.partner_id ? partnerNames.get(m.partner_id) ?? null : null,
    note_status: (noteStatusMap.get(m.id) as "draft" | "complete") ?? null,
  }));
}

export async function getRecentMeetingsByPartner(
  partnerId: string,
  limit: number = 5
): Promise<Pick<Meeting, "id" | "title" | "meeting_date" | "status">[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, title, meeting_date, status")
    .eq("partner_id", partnerId)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch recent meetings: ${error.message}`);
  return (data ?? []) as Pick<Meeting, "id" | "title" | "meeting_date" | "status">[];
}

export async function getMeetingDatesByPartner(
  partnerId: string,
  limit: number = 50
): Promise<{ id: string; meeting_date: string | null }[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, meeting_date")
    .eq("partner_id", partnerId)
    .order("meeting_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch meeting dates: ${error.message}`);
  return (data ?? []) as { id: string; meeting_date: string | null }[];
}

export async function getMeetingsByPartner(partnerId: string): Promise<Meeting[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("*")
    .eq("partner_id", partnerId)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch meetings by partner: ${error.message}`);
  return (data ?? []) as Meeting[];
}

/**
 * Stamp partner on meetings matched by message_id (for ICS backfill).
 * Only updates meetings that have no partner_id yet.
 */
export async function stampPartnerOnMeetingsByMessageIds(
  messageIds: string[],
  partnerId: string
): Promise<void> {
  if (messageIds.length === 0) return;

  const { error } = await getSupabaseClient()
    .from("meetings")
    .update({ partner_id: partnerId })
    .in("message_id", messageIds)
    .is("partner_id", null);

  if (error) throw new Error(`Failed to stamp partner on meetings: ${error.message}`);
}

/**
 * Get meeting titles for a set of meeting IDs. Returns a Map of id → title.
 */
export async function getMeetingTitlesById(
  meetingIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (meetingIds.length === 0) return result;

  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, title")
    .in("id", meetingIds);

  if (error) throw new Error(`Failed to fetch meeting titles: ${error.message}`);
  for (const m of (data ?? []) as { id: string; title: string | null }[]) {
    result.set(m.id, m.title ?? "Untitled");
  }
  return result;
}

/**
 * Get anchor_days for a set of meeting IDs (series roots).
 * Returns a Map of id → anchor_day.
 */
export async function getAnchorDaysByMeetingIds(
  meetingIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (meetingIds.length === 0) return result;

  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, anchor_day")
    .in("id", meetingIds);

  if (error) throw new Error(`Failed to fetch anchor days: ${error.message}`);
  for (const r of (data ?? []) as { id: string; anchor_day: number | null }[]) {
    if (r.anchor_day !== null) result.set(r.id, r.anchor_day);
  }
  return result;
}

/**
 * Get meetings linked to specific messages via message_id FK.
 * Returns meeting id and message_id for cascade tracking.
 */
export async function getMeetingsByMessageIds(
  messageIds: string[]
): Promise<{ id: string; message_id: string }[]> {
  if (messageIds.length === 0) return [];

  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, message_id")
    .in("message_id", messageIds);

  if (error) throw new Error(`Failed to fetch meetings by message IDs: ${error.message}`);
  return (data ?? []) as { id: string; message_id: string }[];
}

/**
 * Update engagement_id on specific meetings by ID.
 * Pass null to unlink meetings from any engagement.
 */
export async function updateMeetingsEngagement(
  meetingIds: string[],
  engagementId: string | null
): Promise<number> {
  if (meetingIds.length === 0) return 0;

  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .update({ engagement_id: engagementId })
    .in("id", meetingIds)
    .select("id");

  if (error) throw new Error(`Failed to update meetings engagement: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Delete meetings by IDs. Used by discard cascade.
 */
export async function deleteMeetingsByIds(meetingIds: string[]): Promise<number> {
  if (meetingIds.length === 0) return 0;

  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .delete()
    .in("id", meetingIds)
    .select("id");

  if (error) throw new Error(`Failed to delete meetings: ${error.message}`);
  return data?.length ?? 0;
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

export async function getSeriesSiblings(seriesId: string): Promise<Pick<Meeting, "id" | "title" | "meeting_date" | "status" | "anchor_day">[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, title, meeting_date, status, anchor_day")
    .eq("series_id", seriesId)
    .order("meeting_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch series siblings: ${error.message}`);
  return (data ?? []) as Pick<Meeting, "id" | "title" | "meeting_date" | "status" | "anchor_day">[];
}

/**
 * Find recurring meetings that are past due and not ended.
 * Used as candidates for spawn checking — caller filters by future siblings.
 */
export async function getOverdueRecurringCandidates(
  todayStr: string
): Promise<Meeting[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("*")
    .not("recurrence_pattern", "is", null)
    .lt("meeting_date", todayStr)
    .or(`recurrence_end.is.null,recurrence_end.gte.${todayStr}`);

  if (error) throw new Error(`Failed to query overdue recurring meetings: ${error.message}`);
  return (data ?? []) as Meeting[];
}

/**
 * Find future meetings in given series (meeting_date >= today).
 * Returns series_id + meeting_date for each.
 */
export async function getFutureMeetingsInSeries(
  seriesIds: string[],
  todayStr: string
): Promise<{ series_id: string; meeting_date: string }[]> {
  if (seriesIds.length === 0) return [];

  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("series_id, meeting_date")
    .in("series_id", seriesIds)
    .gte("meeting_date", todayStr);

  if (error) throw new Error(`Failed to query future siblings: ${error.message}`);
  return (data ?? []) as { series_id: string; meeting_date: string }[];
}

/**
 * Get the anchor_day from a series root meeting.
 */
export async function getSeriesRootAnchorDay(
  seriesId: string
): Promise<number | undefined> {
  const { data } = await getSupabaseClient()
    .from("meetings")
    .select("anchor_day")
    .eq("id", seriesId)
    .maybeSingle();

  return data?.anchor_day ?? undefined;
}

/**
 * Insert a spawned recurring meeting occurrence.
 * Returns null on unique constraint violation (series_id, meeting_date) — another request already spawned it.
 */
export async function insertSpawnedMeeting(
  data: {
    title: string;
    partner_id: string | null;
    engagement_id: string | null;
    meeting_type: string | null;
    recurrence_pattern: string;
    recurrence_end: string | null;
    series_id: string;
    anchor_day: number | null;
    meeting_date: string;
    notes: string | null;
    location: string | null;
    start_time: string | null;
    end_time: string | null;
  }
): Promise<Meeting | null> {
  const { data: meeting, error } = await getSupabaseClient()
    .from("meetings")
    .insert({
      ...data,
      status: "scheduled",
      source: "auto",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`Failed to insert spawned meeting: ${error.message}`);
  }

  return meeting as Meeting;
}

/**
 * Get future meetings in a series, excluding a specific meeting.
 * Used by scope-aware editing to find meetings that need date recalculation.
 */
export async function getFutureSeriesMeetingsExcluding(
  seriesId: string,
  afterDate: string,
  excludeId: string
): Promise<{ id: string; meeting_date: string }[]> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .select("id, meeting_date")
    .eq("series_id", seriesId)
    .gte("meeting_date", afterDate)
    .neq("id", excludeId)
    .order("meeting_date", { ascending: true });

  if (error) throw new Error(`Failed to fetch future series meetings: ${error.message}`);
  return (data ?? []) as { id: string; meeting_date: string }[];
}

/**
 * Stamp a partner_id on a meeting.
 */
export async function stampPartnerOnMeeting(
  meetingId: string,
  partnerId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("meetings")
    .update({ partner_id: partnerId })
    .eq("id", meetingId);

  if (error) throw new Error(`Failed to stamp partner on meeting: ${error.message}`);
}

/**
 * Move all meetings from one engagement to another.
 * Returns the number of meetings moved.
 */
export async function reparentMeetingsToEngagement(
  fromEngagementId: string,
  toEngagementId: string
): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from("meetings")
    .update({ engagement_id: toEngagementId })
    .eq("engagement_id", fromEngagementId)
    .select("id");

  if (error) throw new Error(`Failed to reparent meetings: ${error.message}`);
  return data?.length ?? 0;
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

export async function createMeeting(data: {
  title: string;
  engagement_id?: string | null;
  partner_id?: string | null;
  status?: string;
  meeting_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  organizer_email?: string | null;
  attendees?: MeetingAttendee[];
  meeting_type?: string | null;
  notes?: string | null;
  source?: Meeting["source"];
  recurrence_pattern?: string | null;
  recurrence_end?: string | null;
  anchor_day?: number | null;
}): Promise<Meeting> {
  const db = getSupabaseClient();

  const { data: meeting, error } = await db
    .from("meetings")
    .insert({
      title: data.title,
      engagement_id: data.engagement_id ?? null,
      partner_id: data.partner_id ?? null,
      status: data.status ?? "scheduled",
      meeting_date: data.meeting_date ?? null,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      location: data.location ?? null,
      organizer_email: data.organizer_email ?? null,
      meeting_type: data.meeting_type ?? null,
      notes: data.notes ?? null,
      source: data.source ?? "manual",
      recurrence_pattern: data.recurrence_pattern ?? null,
      recurrence_end: data.recurrence_end ?? null,
      anchor_day: data.anchor_day ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create meeting: ${error.message}`);

  let mtgResult = meeting as Meeting;

  // Self-referencing series root: set series_id = own ID after insert
  if (data.recurrence_pattern) {
    const { data: updated, error: updateError } = await db
      .from("meetings")
      .update({ series_id: mtgResult.id })
      .eq("id", mtgResult.id)
      .select()
      .single();
    if (updateError) {
      console.error(`Failed to set series_id on meeting ${mtgResult.id}:`, updateError);
    } else {
      mtgResult = updated as Meeting;
    }
  }

  // Push to Airtable (awaited to prevent serverless termination)
  try {
    const { pushMeetingToAirtable } = await import("../sync");
    await pushMeetingToAirtable(mtgResult.id);
  } catch (err) {
    console.error(`Airtable push failed for meeting ${mtgResult.id}:`, err);
  }

  // Sync attendees to contact registry + meeting_participants join table
  if (data.attendees && data.attendees.length > 0) {
    await syncMeetingAttendeesToRegistry(mtgResult.id, data.attendees, null, null);
  }

  return mtgResult;
}

export async function updateMeeting(
  id: string,
  updates: {
    title?: string;
    engagement_id?: string | null;
    partner_id?: string | null;
    status?: string;
    meeting_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    organizer_email?: string | null;
    meeting_type?: string | null;
    notes?: string | null;
    recurrence_pattern?: string | null;
    recurrence_end?: string | null;
    series_id?: string | null;
    anchor_day?: number | null;
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

  // Delete from Airtable if synced (awaited to prevent serverless termination)
  const { data: mtg } = await db
    .from("meetings")
    .select("airtable_record_id")
    .eq("id", id)
    .maybeSingle();

  if (mtg?.airtable_record_id) {
    try {
      const { deleteMeetingFromAirtable } = await import("../sync");
      await deleteMeetingFromAirtable(mtg.airtable_record_id);
    } catch (err) {
      console.error(`Airtable delete failed for meeting ${id}:`, err);
    }
  }

  const { error } = await db
    .from("meetings")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete meeting: ${error.message}`);
}

/**
 * Match a partner from meeting attendee email domains.
 * Scans non-Amazon attendee domains against partner contact domains
 * from the contact registry. Returns the partner if exactly one matches;
 * null if zero or ambiguous.
 */
export async function matchPartnerFromAttendees(
  attendees: MeetingAttendee[]
): Promise<{ partner_id: string | null }> {
  const none = { partner_id: null };
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

  // Get partner domains from the contact registry
  const domainMap = await getPartnerContactDomains();
  const matchedPartnerIds = new Set<string>();

  for (const ad of attendeeDomains) {
    const match = domainMap.get(ad);
    if (match) {
      matchedPartnerIds.add(match.partnerId);
    }
  }

  if (matchedPartnerIds.size === 1) {
    const id = [...matchedPartnerIds][0];
    return { partner_id: id };
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
      if (parsed.organizer_name) updates.organizer_name = parsed.organizer_name;

      const { error } = await db
        .from("meetings")
        .update(updates)
        .eq("id", existing.id);

      if (error) {
        console.error(`Failed to cancel meeting: ${error.message}`);
        return null;
      }
      console.log(`Cancelled meeting: ${parsed.title} (${existing.id})`);

      // Push to Airtable (awaited to prevent serverless termination)
      try {
        const { pushMeetingToAirtable } = await import("../sync");
        await pushMeetingToAirtable(existing.id);
      } catch (err) {
        console.error(`Airtable push failed for meeting ${existing.id}:`, err);
      }

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
        organizer_name: parsed.organizer_name,
        sequence: parsed.sequence,
      };
      if (partner.partner_id) {
        updates.partner_id = partner.partner_id;
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

      // Push to Airtable (awaited to prevent serverless termination)
      try {
        const { pushMeetingToAirtable } = await import("../sync");
        await pushMeetingToAirtable(existing.id);
      } catch (err) {
        console.error(`Airtable push failed for meeting ${existing.id}:`, err);
      }

      // Re-sync attendees to contact registry (clear + re-insert for ICS updates)
      await replaceMeetingParticipants(existing.id);
      await syncMeetingAttendeesToRegistry(existing.id, parsed.attendees, parsed.organizer_email, parsed.organizer_name);

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
        organizer_name: parsed.organizer_name,
        ics_uid: parsed.ics_uid,
        sequence: parsed.sequence,
        source: "ics_parsed",
        status: parsed.is_cancellation ? "cancelled" : "scheduled",
        message_id: messageId,
        partner_id: partner.partner_id,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to create meeting from ICS: ${error.message}`);
      return null;
    }

    console.log(`Created meeting from ICS: ${parsed.title} (${parsed.meeting_date})`);

    // Push to Airtable (awaited to prevent serverless termination)
    try {
      const { pushMeetingToAirtable } = await import("../sync");
      await pushMeetingToAirtable(data.id);
    } catch (err) {
      console.error(`Airtable push failed for meeting ${data.id}:`, err);
    }

    // Sync attendees to contact registry + meeting_participants join table
    await syncMeetingAttendeesToRegistry(data.id, parsed.attendees, parsed.organizer_email, parsed.organizer_name);

    return data.id;
  } catch (err) {
    console.error("createMeetingFromICS error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Link a meeting to an engagement after classification.
 * Finds the meeting by message_id and sets engagement_id + partner_id.
 * The IS NULL guard prevents overwriting manually linked meetings.
 * Never throws — logs errors silently.
 */
export async function linkMeetingToEngagement(
  messageId: string,
  engagementId: string
): Promise<void> {
  try {
    const db = getSupabaseClient();

    // Look up partner_id from the engagement
    const { data: engagement } = await db
      .from("engagements")
      .select("partner_id")
      .eq("id", engagementId)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      engagement_id: engagementId,
    };
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

      // Push updated meeting(s) to Airtable (awaited to prevent serverless termination)
      try {
        const { pushMeetingToAirtable } = await import("../sync");
        for (const row of data as { id: string }[]) {
          await pushMeetingToAirtable(row.id);
        }
      } catch (err) {
        console.error(`Airtable push failed for linked meetings:`, err);
      }
    }
  } catch (err) {
    console.error("linkMeetingToEngagement error:", err instanceof Error ? err.message : err);
  }
}

/**
 * Cascade engagement_id to tasks belonging to a meeting's notes.
 *
 * Link (newEngagementId is set):
 *   Sets engagement_id on tasks whose engagement_id IS NULL.
 *   Respects manual overrides — never overwrites an existing engagement_id.
 *
 * Unlink (newEngagementId is null, oldEngagementId provided):
 *   Clears engagement_id only on tasks whose engagement_id matches the old value.
 *   Doesn't touch tasks with a different (manually set) engagement_id.
 */
export async function cascadeEngagementToTasks(
  meetingId: string,
  newEngagementId: string | null,
  oldEngagementId?: string | null
): Promise<number> {
  const db = getSupabaseClient();

  // Find the meeting_note for this meeting
  const { data: note } = await db
    .from("meeting_notes")
    .select("id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!note) return 0;

  if (newEngagementId) {
    // Link: fill in tasks that don't already have an engagement
    const { data, error } = await db
      .from("tasks")
      .update({ engagement_id: newEngagementId })
      .eq("meeting_note_id", note.id)
      .is("engagement_id", null)
      .select("id");

    if (error) {
      console.error(`Failed to cascade engagement to tasks: ${error.message}`);
      return 0;
    }
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`Cascaded engagement ${newEngagementId} to ${count} task(s) for meeting ${meetingId}`);
    }
    return count;
  }

  if (oldEngagementId) {
    // Unlink: only clear tasks that got their engagement from this link
    const { data, error } = await db
      .from("tasks")
      .update({ engagement_id: null })
      .eq("meeting_note_id", note.id)
      .eq("engagement_id", oldEngagementId)
      .select("id");

    if (error) {
      console.error(`Failed to clear engagement on tasks: ${error.message}`);
      return 0;
    }
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`Cleared engagement from ${count} task(s) for meeting ${meetingId}`);
    }
    return count;
  }

  return 0;
}
