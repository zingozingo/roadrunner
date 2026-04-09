/**
 * Meeting recurrence module.
 * Calculates next dates, finds overdue recurring meetings, and spawns next occurrences.
 */

import type { Meeting, RecurrencePattern } from "./types";
import {
  getOverdueRecurringCandidates,
  getFutureMeetingsInSeries,
  getSeriesRootAnchorDay,
  insertSpawnedMeeting,
  getFutureSeriesMeetingsExcluding,
  updateMeeting,
} from "./db/meetings";
import { getMeetingIdsWithNotes } from "./db/meeting-notes";
import { copyMeetingParticipants } from "./db/participants";
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
  const today = formatDate(new Date());

  // Step 1: Get all recurring meetings that are past due and not ended.
  const candidates = await getOverdueRecurringCandidates(today);
  if (candidates.length === 0) return [];

  // Step 2: For each candidate, check if a future sibling exists in the same series.
  const seriesIds = [...new Set(candidates.map((m) => m.series_id).filter(Boolean))] as string[];
  if (seriesIds.length === 0) return candidates;

  const futureSiblings = await getFutureMeetingsInSeries(seriesIds, today);
  const seriesWithFuture = new Set(futureSiblings.map((m) => m.series_id));

  // Filter out candidates whose series already has a future meeting
  return candidates.filter((m) => !m.series_id || !seriesWithFuture.has(m.series_id));
}

/**
 * Spawn the next occurrence of a recurring meeting.
 * Returns null if the meeting isn't recurring, series is over, or another request already spawned it.
 */
export async function spawnNextOccurrence(meeting: Meeting): Promise<Meeting | null> {
  if (!meeting.recurrence_pattern || !meeting.series_id) return null;

  // Look up anchor_day from the series root meeting
  let anchorDay: number | undefined;
  if (meeting.series_id !== meeting.id) {
    anchorDay = await getSeriesRootAnchorDay(meeting.series_id);
  } else {
    anchorDay = meeting.anchor_day ?? undefined;
  }

  const nextDate = calculateNextDate(meeting.meeting_date!, meeting.recurrence_pattern, anchorDay);

  // Series has ended
  if (meeting.recurrence_end && nextDate > meeting.recurrence_end) return null;

  try {
    // Insert the new occurrence (returns null on unique constraint violation)
    const newMeeting = await insertSpawnedMeeting({
      title: meeting.title,
      partner_id: meeting.partner_id,
      engagement_id: meeting.engagement_id,
      meeting_type: meeting.meeting_type,
      recurrence_pattern: meeting.recurrence_pattern,
      recurrence_end: meeting.recurrence_end,
      series_id: meeting.series_id,
      anchor_day: anchorDay ?? null,
      meeting_date: nextDate,
      notes: meeting.notes,
      location: meeting.location,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
    });

    if (!newMeeting) return null;

    // Copy meeting_participants from source meeting
    await copyMeetingParticipants(meeting.id, newMeeting.id);

    // Push to Airtable
    await pushMeetingToAirtable(newMeeting.id);

    return newMeeting;
  } catch (err) {
    // Re-check for unique constraint in case it surfaces differently
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return null;
    }
    throw err;
  }
}

/**
 * Propagate recurrence pattern/anchor/date changes to future meetings in a series.
 * Skips meetings that already have notes (user has customized them).
 * Called from the meetings PUT route when scope === "this_and_future".
 */
export async function propagateRecurrenceChange(params: {
  meetingId: string;
  seriesId: string;
  existing: Meeting;
  updated: Meeting;
  recurrencePattern?: string;
  anchorDay?: number | null;
  recurrenceEnd?: string;
}): Promise<{ updatedCount: number }> {
  const { meetingId, seriesId, existing, updated, recurrencePattern, anchorDay, recurrenceEnd } = params;
  const today = new Date().toISOString().slice(0, 10);

  // Update series root with new pattern/anchor
  const rootUpdates: Record<string, unknown> = {};
  if (recurrencePattern !== undefined) rootUpdates.recurrence_pattern = recurrencePattern || null;
  if (anchorDay !== undefined) rootUpdates.anchor_day = anchorDay;
  if (recurrenceEnd !== undefined) rootUpdates.recurrence_end = recurrenceEnd || null;
  if (meetingId !== seriesId && Object.keys(rootUpdates).length > 0) {
    await updateMeeting(seriesId, rootUpdates);
  }

  // Find future meetings in the series (excluding current)
  const futureMeetings = await getFutureSeriesMeetingsExcluding(seriesId, today, meetingId);
  if (futureMeetings.length === 0) return { updatedCount: 0 };

  const notedSet = await getMeetingIdsWithNotes(futureMeetings.map((m) => m.id));

  const newPattern = (recurrencePattern ?? existing.recurrence_pattern) as RecurrencePattern;
  const newAnchor = anchorDay ?? existing.anchor_day ?? undefined;

  // Recalculate dates for unattended future meetings
  let updatedCount = 0;
  let prevDate = updated.meeting_date ?? existing.meeting_date ?? today;
  for (const fm of futureMeetings) {
    if (notedSet.has(fm.id)) {
      prevDate = fm.meeting_date;
      continue; // Skip meetings with notes
    }
    if (newPattern) {
      const nextDate = calculateNextDate(prevDate, newPattern, newAnchor);
      await updateMeeting(fm.id, {
        meeting_date: nextDate,
        recurrence_pattern: newPattern,
        anchor_day: newAnchor ?? null,
      });
      prevDate = nextDate;
      updatedCount++;
    }
  }

  return { updatedCount };
}
