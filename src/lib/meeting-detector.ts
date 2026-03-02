/**
 * Fallback meeting detection from plain-text email bodies.
 *
 * When Outlook forwards a meeting invite, it strips the ICS and delivers a
 * plain-text "Original Appointment" block with When:/Where:/From:/To: structure.
 * This module detects those blocks and extracts meeting data so the pipeline
 * can still create meeting records without actual VCALENDAR data.
 *
 * Two detection tiers:
 *   Tier 1: Outlook "-----Original Appointment-----" header block
 *   Tier 2: Generic When: + Where: lines (both required to prevent false positives)
 */

import { ParsedMeeting, MeetingAttendee } from "./types";

// --- Public API ---

/**
 * Detect a meeting from a plain-text email body.
 * Returns a ParsedMeeting if a meeting block is found, null otherwise.
 */
export function detectMeetingFromBody(
  bodyPlain: string,
  subject: string
): ParsedMeeting | null {
  if (!bodyPlain) return null;

  // Tier 1: Outlook "Original Appointment" block
  const tier1 = detectOutlookAppointment(bodyPlain, subject);
  if (tier1) return tier1;

  // Tier 2: Generic When: + Where: lines
  const tier2 = detectGenericMeetingBlock(bodyPlain, subject);
  if (tier2) return tier2;

  return null;
}

// --- Tier 1: Outlook Original Appointment ---

const ORIGINAL_APPOINTMENT_MARKER = /-----\s*Original Appointment\s*-----/i;

function detectOutlookAppointment(
  body: string,
  subject: string
): ParsedMeeting | null {
  const markerMatch = ORIGINAL_APPOINTMENT_MARKER.exec(body);
  if (!markerMatch) return null;

  // Extract the block after the marker
  const blockStart = markerMatch.index + markerMatch[0].length;
  const block = body.substring(blockStart);

  // Extract structured fields from the block
  const whenLine = extractField(block, "When");
  const whereLine = extractField(block, "Where");
  const fromLine = extractField(block, "From");
  const toLinesRaw = extractField(block, "To");
  const subjectLine = extractField(block, "Subject");

  // When: is required for a valid meeting
  if (!whenLine) return null;

  const parsed = parseWhenLine(whenLine);
  if (!parsed) return null;

  const title = subjectLine
    ? cleanSubjectPrefix(subjectLine)
    : cleanSubjectPrefix(subject);

  const organizer = fromLine ? parseOrganizerLine(fromLine) : null;
  const attendees = toLinesRaw ? parseAttendeeList(toLinesRaw) : [];

  const isCancellation = detectCancellation(title);

  return {
    title,
    meeting_date: parsed.date,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
    location: whereLine || null,
    organizer_email: organizer?.email ?? null,
    organizer_name: organizer?.name ?? null,
    attendees,
    ics_uid: generateSyntheticUid(title, parsed.date),
    notes: null,
    method: null,
    status: null,
    sequence: null,
    is_recurring: false,
    is_cancellation: isCancellation,
  };
}

// --- Tier 2: Generic When: + Where: lines ---

function detectGenericMeetingBlock(
  body: string,
  subject: string
): ParsedMeeting | null {
  // Require BOTH When: and Where: to prevent false positives
  const whenLine = extractField(body, "When");
  const whereLine = extractField(body, "Where");

  if (!whenLine || !whereLine) return null;

  const parsed = parseWhenLine(whenLine);
  if (!parsed) return null;

  const title = cleanSubjectPrefix(subject);
  const isCancellation = detectCancellation(title);

  return {
    title,
    meeting_date: parsed.date,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
    location: whereLine || null,
    organizer_email: null,
    organizer_name: null,
    attendees: [],
    ics_uid: generateSyntheticUid(title, parsed.date),
    notes: null,
    method: null,
    status: null,
    sequence: null,
    is_recurring: false,
    is_cancellation: isCancellation,
  };
}

// --- Field Extraction ---

/**
 * Extract a "Key: value" field from a text block.
 * Handles multiline values (continuation lines that don't start a new field).
 */
function extractField(block: string, fieldName: string): string | null {
  const regex = new RegExp(`^${fieldName}:\\s*(.*)`, "im");
  const match = regex.exec(block);
  if (!match) return null;

  let value = match[1].trim();

  // Check for continuation lines (indented or no new field marker)
  const lines = block.substring(match.index + match[0].length).split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Stop at empty line or next field header
    if (!trimmed || /^\w+:\s/.test(trimmed)) break;
    value += " " + trimmed;
  }

  return value || null;
}

// --- When: Line Parsing ---

/**
 * Parse Outlook When: line formats:
 *   "Thursday, February 27, 2026 10:00 AM-11:00 AM (UTC-08:00)"
 *   "Thursday, February 27, 2026 10:00 AM-11:00 AM"
 *   "February 27, 2026 10:00 AM-11:00 AM (UTC-08:00)"
 *   "27 February 2026 10:00-11:00 (UTC+01:00)"
 */
export function parseWhenLine(
  line: string
): { date: string; startTime: string; endTime: string } | null {
  // Strip timezone suffix for parsing — we'll use it if needed
  const tzMatch = line.match(/\(UTC([+-]\d{2}:\d{2})\)\s*$/);
  const cleanLine = tzMatch ? line.replace(/\s*\(UTC[+-]\d{2}:\d{2}\)\s*$/, "").trim() : line.trim();

  // Try to extract date and time range
  // Pattern: optional day-of-week, month day year, time-time
  // US format: "Thursday, February 27, 2026 10:00 AM-11:00 AM"
  const usPattern =
    /(?:\w+,\s+)?(\w+ \d{1,2},\s*\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*[-–]\s*(\d{1,2}:\d{2}\s*[AP]M)/i;
  const usMatch = usPattern.exec(cleanLine);
  if (usMatch) {
    const dateStr = usMatch[1];
    const startTimeStr = usMatch[2];
    const endTimeStr = usMatch[3];

    const date = parseDateString(dateStr);
    if (!date) return null;

    const startTime = parseTimeString(startTimeStr);
    const endTime = parseTimeString(endTimeStr);
    if (!startTime || !endTime) return null;

    return { date, startTime, endTime };
  }

  // European format: "27 February 2026 10:00-11:00"
  const euPattern =
    /(?:\w+,\s+)?(\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i;
  const euMatch = euPattern.exec(cleanLine);
  if (euMatch) {
    const dateStr = euMatch[1];
    const startTimeStr = euMatch[2];
    const endTimeStr = euMatch[3];

    const date = parseDateString(dateStr);
    if (!date) return null;

    return { date, startTime: startTimeStr + ":00", endTime: endTimeStr + ":00" };
  }

  return null;
}

// --- Date/Time Parsing Helpers ---

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse date strings like "February 27, 2026" or "27 February 2026" into "2026-02-27"
 */
function parseDateString(dateStr: string): string | null {
  // "February 27, 2026"
  const usMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (usMatch) {
    const month = MONTHS[usMatch[1].toLowerCase()];
    if (!month) return null;
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "27 February 2026"
  const euMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (euMatch) {
    const day = parseInt(euMatch[1], 10);
    const month = MONTHS[euMatch[2].toLowerCase()];
    if (!month) return null;
    const year = parseInt(euMatch[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * Parse time strings like "10:00 AM" or "2:30 PM" into "HH:MM:00" (24-hour)
 */
function parseTimeString(timeStr: string): string | null {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}:00`;
}

// --- Attendee/Organizer Parsing ---

/**
 * Parse an organizer line like:
 *   "John Smith <john@example.com>"
 *   "john@example.com"
 *   "John Smith"
 */
function parseOrganizerLine(
  line: string
): { name: string | null; email: string | null } {
  // "Name <email>"
  const angleMatch = line.match(/^(.+?)\s*<([^>]+)>/);
  if (angleMatch) {
    return { name: angleMatch[1].trim() || null, email: angleMatch[2].trim() };
  }

  // Bare email
  if (line.includes("@")) {
    return { name: null, email: line.trim() };
  }

  // Just a name
  return { name: line.trim() || null, email: null };
}

/**
 * Parse attendee list from To: line.
 * Handles semicolon-separated and comma-separated lists.
 *   "John Smith <john@example.com>; Jane Doe <jane@example.com>"
 *   "john@example.com, jane@example.com"
 *   "John Smith; Jane Doe"
 */
export function parseAttendeeList(line: string): MeetingAttendee[] {
  if (!line.trim()) return [];

  // Split by semicolons first (Outlook preference), fall back to commas
  // But only split by commas if there are no semicolons (commas can appear in names)
  const separator = line.includes(";") ? ";" : ",";
  const parts = line.split(separator).map((p) => p.trim()).filter(Boolean);

  const attendees: MeetingAttendee[] = [];
  for (const part of parts) {
    const parsed = parseOrganizerLine(part);
    // MeetingAttendee requires email: string, name: string | null
    // Skip entries without an email — can't create a valid attendee
    if (parsed.email) {
      attendees.push({
        name: parsed.name ?? null,
        email: parsed.email,
      });
    } else if (parsed.name) {
      // Name-only attendees: use empty string for email (best effort)
      attendees.push({
        name: parsed.name,
        email: "",
      });
    }
  }

  return attendees;
}

// --- Utility ---

/**
 * Strip FW:/RE:/Fwd: prefixes from email subjects.
 */
export function cleanSubjectPrefix(subject: string): string {
  let result = subject;
  // Loop to strip nested prefixes like "FW: RE: Meeting"
  let prev = "";
  while (result !== prev) {
    prev = result;
    result = result.replace(/^(FW|Fwd|RE):\s*/i, "").trim();
  }
  return result;
}

/**
 * Detect cancellation from title prefixes.
 */
function detectCancellation(title: string): boolean {
  return /^Cancell?ed:/i.test(title);
}

/**
 * Generate a synthetic UID for dedup. Not a real ICS UID —
 * just a stable identifier based on meeting content.
 */
function generateSyntheticUid(title: string, date: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50);
  return `body-parsed-${date}-${slug}`;
}
