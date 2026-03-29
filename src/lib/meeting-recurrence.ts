/**
 * Meeting recurrence module.
 * Calculates next dates, finds overdue recurring meetings, and spawns next occurrences.
 */

import type { Meeting, RecurrencePattern } from "./types";
import { getSupabaseClient } from "./db/client";
import { pushMeetingToAirtable } from "./sync/push";

/**
 * Calculate the next occurrence date for a recurring meeting.
 * If multiple occurrences are overdue, advances repeatedly until the result >= today.
 * If anchorDay is provided, snaps the result to the correct day of week (weekly/biweekly)
 * or day of month (monthly/quarterly) to prevent drift from rescheduled occurrences.
 */
export function calculateNextDate(
  currentDate: string,
  pattern: RecurrencePattern,
  anchorDay?: number
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = advanceOnce(currentDate, pattern);

  // Advance past today if multiple occurrences were missed
  while (new Date(next + "T00:00:00") < today) {
    next = advanceOnce(next, pattern);
  }

  // Snap to anchor day if provided
  if (anchorDay !== undefined && anchorDay !== null) {
    next = snapToAnchor(next, pattern, anchorDay);

    // After snapping, if we landed before today, advance one more interval and re-snap
    while (new Date(next + "T00:00:00") < today) {
      next = advanceOnce(next, pattern);
      next = snapToAnchor(next, pattern, anchorDay);
    }
  }

  return next;
}

/**
 * Snap a date to the anchor day for the given pattern.
 * Weekly/biweekly: adjust to the correct day of week within the same week.
 * Monthly/quarterly: adjust to the correct day of month (clamped to month length).
 */
function snapToAnchor(dateStr: string, pattern: RecurrencePattern, anchorDay: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (pattern === "weekly" || pattern === "biweekly") {
    // anchorDay is day-of-week (0=Sun..6=Sat)
    const currentDow = date.getDay();
    const diff = anchorDay - currentDow;
    date.setDate(date.getDate() + diff);
    return formatDate(date);
  }

  if (pattern === "monthly" || pattern === "quarterly") {
    // anchorDay is day-of-month (1-31)
    const daysInMonth = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(anchorDay, daysInMonth);
    return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  }

  return dateStr;
}

/** Advance a date by one interval of the given pattern. */
function advanceOnce(dateStr: string, pattern: RecurrencePattern): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  switch (pattern) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      return addMonths(year, month - 1, day, 1);
    case "quarterly":
      return addMonths(year, month - 1, day, 3);
  }

  return formatDate(date);
}

/** Add N months, clamping to last day of target month if needed. */
function addMonths(year: number, monthIdx: number, day: number, count: number): string {
  const targetMonth = monthIdx + count;
  const targetYear = year + Math.floor(targetMonth / 12);
  const targetMonthIdx = targetMonth % 12;

  // Days in target month
  const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);

  return formatDate(new Date(targetYear, targetMonthIdx, clampedDay));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Find recurring meetings that are overdue (meeting_date < today)
 * and have no future sibling in the same series.
 */
export async function getOverdueRecurringMeetings(): Promise<Meeting[]> {
  const supabase = getSupabaseClient();
  const today = formatDate(new Date());

  // PostgREST can't do NOT EXISTS subqueries, so we use rpc or a two-step approach.
  // Step 1: Get all recurring meetings that are past due and not ended.
  const { data: candidates, error } = await supabase
    .from("meetings")
    .select("*")
    .not("recurrence_pattern", "is", null)
    .lt("meeting_date", today)
    .or(`recurrence_end.is.null,recurrence_end.gte.${today}`);

  if (error) {
    throw new Error(`Failed to query overdue recurring meetings: ${error.message}`);
  }

  if (!candidates || candidates.length === 0) return [];

  // Step 2: For each candidate, check if a future sibling exists in the same series.
  // Collect all series_ids, then find any meetings with future dates in those series.
  const seriesIds = [...new Set(candidates.map((m: Meeting) => m.series_id).filter(Boolean))];

  if (seriesIds.length === 0) return candidates as Meeting[];

  const { data: futureSiblings, error: futureErr } = await supabase
    .from("meetings")
    .select("series_id, meeting_date")
    .in("series_id", seriesIds)
    .gte("meeting_date", today);

  if (futureErr) {
    throw new Error(`Failed to query future siblings: ${futureErr.message}`);
  }

  const seriesWithFuture = new Set(
    (futureSiblings || []).map((m: { series_id: string }) => m.series_id)
  );

  // Filter out candidates whose series already has a future meeting
  return candidates.filter(
    (m: Meeting) => !m.series_id || !seriesWithFuture.has(m.series_id)
  ) as Meeting[];
}

/**
 * Spawn the next occurrence of a recurring meeting.
 * Returns null if the meeting isn't recurring, series is over, or another request already spawned it.
 */
export async function spawnNextOccurrence(meeting: Meeting): Promise<Meeting | null> {
  if (!meeting.recurrence_pattern || !meeting.series_id) return null;

  const nextDate = calculateNextDate(meeting.meeting_date!, meeting.recurrence_pattern);

  // Series has ended
  if (meeting.recurrence_end && nextDate > meeting.recurrence_end) return null;

  const supabase = getSupabaseClient();

  try {
    // Insert the new occurrence
    const { data: newMeeting, error: insertErr } = await supabase
      .from("meetings")
      .insert({
        title: meeting.title,
        partner_id: meeting.partner_id,
        engagement_id: meeting.engagement_id,
        meeting_type: meeting.meeting_type,
        recurrence_pattern: meeting.recurrence_pattern,
        recurrence_end: meeting.recurrence_end,
        series_id: meeting.series_id,
        meeting_date: nextDate,
        status: "scheduled",
        source: "auto",
        notes: meeting.notes,
        location: meeting.location,
        start_time: meeting.start_time,
        end_time: meeting.end_time,
      })
      .select()
      .single();

    if (insertErr) {
      // Unique constraint violation (series_id, meeting_date) — another request already spawned it
      if (insertErr.code === "23505") return null;
      throw insertErr;
    }

    // Copy meeting_participants from source meeting
    const { data: participants } = await supabase
      .from("meeting_participants")
      .select("participant_id, role")
      .eq("meeting_id", meeting.id);

    if (participants && participants.length > 0) {
      await supabase.from("meeting_participants").insert(
        participants.map((p: { participant_id: string; role: string | null }) => ({
          meeting_id: newMeeting.id,
          participant_id: p.participant_id,
          role: p.role,
        }))
      );
    }

    // Push to Airtable
    await pushMeetingToAirtable(newMeeting.id);

    return newMeeting as Meeting;
  } catch (err) {
    // Re-check for unique constraint in case it surfaces differently
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return null;
    }
    throw err;
  }
}
