/**
 * ICS (RFC 5545) parser — extracts meeting data from VCALENDAR content.
 *
 * Pure functions, no npm dependencies. Handles:
 * - Line folding (CRLF + space/tab continuation)
 * - UTC timestamps (20260315T140000Z)
 * - Zoned timestamps (TZID=America/New_York:20260315T100000)
 * - ORGANIZER and ATTENDEE parameter extraction
 * - Escaped characters (\n, \,, \;)
 */

import type { ParsedMeeting, MeetingAttendee } from "./types";

// ============================================================
// Line unfolding — RFC 5545 §3.1
// ============================================================

/**
 * Unfold ICS content: long lines are folded by inserting CRLF followed
 * by a single whitespace character (space or tab). Unfold by joining
 * continuation lines back to their predecessor.
 */
function unfoldLines(raw: string): string {
  // Normalize line endings to LF first
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Continuation lines start with a space or tab after a newline
  return normalized.replace(/\n[ \t]/g, "");
}

// ============================================================
// Text unescaping — RFC 5545 §3.3.11
// ============================================================

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// ============================================================
// Date/time parsing
// ============================================================

/**
 * Parse an ICS DTSTART/DTEND value into a Date object.
 *
 * Formats handled:
 * - 20260315T140000Z          (UTC)
 * - 20260315T100000            (floating / local)
 * - TZID=America/New_York:20260315T100000  (zoned — best-effort via Date)
 * - 20260315                   (all-day event, date only)
 */
function parseICSDateTime(raw: string): Date | null {
  let dateStr = raw.trim();

  // Strip TZID prefix if present: "TZID=America/New_York:20260315T100000"
  const tzidMatch = dateStr.match(/^TZID=[^:]+:(.+)$/);
  if (tzidMatch) {
    dateStr = tzidMatch[1];
  }

  // All-day: 20260315 (8 digits, no T)
  const allDayMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (allDayMatch) {
    return new Date(`${allDayMatch[1]}-${allDayMatch[2]}-${allDayMatch[3]}T00:00:00`);
  }

  // DateTime: 20260315T100000 or 20260315T100000Z
  const dtMatch = dateStr.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/
  );
  if (!dtMatch) return null;

  const [, year, month, day, hour, min, sec, utcFlag] = dtMatch;
  const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}${utcFlag || ""}`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a Date as "YYYY-MM-DD".
 */
function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a Date as "h:mm AM/PM" in local time.
 * For UTC timestamps, we convert to local for display.
 */
function formatTime(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

// ============================================================
// Property extraction helpers
// ============================================================

/**
 * Extract a simple property value from VEVENT lines.
 * Returns the value after "PROPNAME:" or "PROPNAME;...:" on the first match.
 */
function getProperty(lines: string[], propName: string): string | null {
  const prefix = propName + ":";
  const prefixWithParams = propName + ";";

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
    if (line.startsWith(prefixWithParams)) {
      // Has parameters — value is after the last unescaped colon
      const colonIdx = line.indexOf(":", prefixWithParams.length);
      if (colonIdx !== -1) {
        return line.slice(colonIdx + 1).trim();
      }
    }
  }
  return null;
}

/**
 * Extract DTSTART or DTEND — handles both the property value and
 * any TZID parameter on the property line.
 */
function getDateTimeProperty(lines: string[], propName: string): string | null {
  const prefix = propName + ":";
  const prefixWithParams = propName + ";";

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
    if (line.startsWith(prefixWithParams)) {
      // Could be "DTSTART;TZID=America/New_York:20260315T100000"
      // or "DTSTART;VALUE=DATE:20260315"
      // Return everything after the property name (including TZID prefix)
      const rest = line.slice(propName.length + 1); // skip "DTSTART;"
      // If there's a TZID, keep it for parseICSDateTime to handle
      const tzidMatch = rest.match(/^(TZID=[^:]+):(.+)$/);
      if (tzidMatch) {
        return `TZID=${tzidMatch[1].replace(/^TZID=/, "")}:${tzidMatch[2]}`;
      }
      // VALUE=DATE or other params — value is after the last colon
      const colonIdx = rest.lastIndexOf(":");
      if (colonIdx !== -1) {
        return rest.slice(colonIdx + 1).trim();
      }
    }
  }
  return null;
}

/**
 * Extract email from a mailto: URI or bare email.
 */
function extractEmail(raw: string): string | null {
  const mailtoMatch = raw.match(/mailto:([^\s;>"]+)/i);
  if (mailtoMatch) return mailtoMatch[1].toLowerCase();
  if (raw.includes("@")) return raw.trim().toLowerCase();
  return null;
}

/**
 * Extract CN (common name) from an ICS parameter string.
 * Handles both quoted and unquoted forms:
 *   CN="Jane Doe"
 *   CN=Jane Doe
 */
function extractCN(paramString: string): string | null {
  const quotedMatch = paramString.match(/CN="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];

  const unquotedMatch = paramString.match(/CN=([^;:]+)/i);
  if (unquotedMatch) return unquotedMatch[1].trim();

  return null;
}

/**
 * Parse ORGANIZER line into { name, email }.
 */
function parseOrganizer(
  lines: string[]
): { name: string | null; email: string | null } {
  for (const line of lines) {
    if (line.startsWith("ORGANIZER:") || line.startsWith("ORGANIZER;")) {
      const email = extractEmail(line);
      const name = extractCN(line);
      return { name, email };
    }
  }
  return { name: null, email: null };
}

/**
 * Parse all ATTENDEE lines into MeetingAttendee[].
 */
function parseAttendees(lines: string[]): MeetingAttendee[] {
  const attendees: MeetingAttendee[] = [];

  for (const line of lines) {
    if (line.startsWith("ATTENDEE:") || line.startsWith("ATTENDEE;")) {
      const email = extractEmail(line);
      if (!email) continue;

      const name = extractCN(line) ?? email;
      attendees.push({ name, email });
    }
  }

  return attendees;
}

// ============================================================
// Main parser
// ============================================================

/**
 * Parse ICS content and extract the first VEVENT as a ParsedMeeting.
 *
 * Returns null if:
 * - No VEVENT block found
 * - UID is missing
 * - DTSTART is missing or unparseable
 * - SUMMARY (title) is missing
 */
export function parseICSContent(icsContent: string): ParsedMeeting | null {
  try {
    const unfolded = unfoldLines(icsContent);
    const allLines = unfolded.split("\n");

    // Find first VEVENT block
    let inEvent = false;
    const eventLines: string[] = [];

    for (const line of allLines) {
      if (line.trim() === "BEGIN:VEVENT") {
        inEvent = true;
        continue;
      }
      if (line.trim() === "END:VEVENT") {
        break; // first event only
      }
      if (inEvent) {
        eventLines.push(line);
      }
    }

    if (eventLines.length === 0) return null;

    // Extract required fields
    const uid = getProperty(eventLines, "UID");
    if (!uid) return null;

    const summary = getProperty(eventLines, "SUMMARY");
    if (!summary) return null;

    const dtStartRaw = getDateTimeProperty(eventLines, "DTSTART");
    if (!dtStartRaw) return null;

    const dtStart = parseICSDateTime(dtStartRaw);
    if (!dtStart) return null;

    // Extract optional fields
    const dtEndRaw = getDateTimeProperty(eventLines, "DTEND");
    const dtEnd = dtEndRaw ? parseICSDateTime(dtEndRaw) : null;

    const locationRaw = getProperty(eventLines, "LOCATION");
    const descriptionRaw = getProperty(eventLines, "DESCRIPTION");

    const organizer = parseOrganizer(eventLines);
    const attendees = parseAttendees(eventLines);

    return {
      title: unescapeText(summary),
      meeting_date: formatDate(dtStart),
      start_time: formatTime(dtStart),
      end_time: dtEnd ? formatTime(dtEnd) : formatTime(dtStart),
      location: locationRaw ? unescapeText(locationRaw) : null,
      organizer_email: organizer.email,
      attendees,
      ics_uid: uid,
      notes: descriptionRaw ? unescapeText(descriptionRaw) : null,
    };
  } catch {
    // Defensive — malformed ICS never throws
    return null;
  }
}

// ============================================================
// Attachment extraction helper
// ============================================================

/**
 * Scan FormData entries for an ICS file attachment.
 * Returns the file content as a string, or null if no ICS found.
 *
 * Mailgun sends attachments as File objects in the FormData payload.
 * Detection: filename ends with .ics OR content-type is text/calendar.
 */
export async function extractICSFromAttachments(
  formData: FormData
): Promise<string | null> {
  // [ICS-DEBUG] Temporary diagnostic logging — remove after ICS is confirmed working
  let entryCount = 0;
  let fileCount = 0;

  for (const [key, value] of formData.entries()) {
    entryCount++;
    if (!(value instanceof File)) continue;

    fileCount++;
    const isICSByName = value.name.toLowerCase().endsWith(".ics");
    const isICSByType =
      value.type === "text/calendar" ||
      value.type === "application/ics";

    console.log(
      `[ICS-DEBUG] File entry: key="${key}" name="${value.name}" type="${value.type}" size=${value.size} isICS=${isICSByName || isICSByType}`
    );

    if (isICSByName || isICSByType) {
      const content = await value.text();
      console.log(`[ICS-DEBUG] Extracted ICS content (${content.length} chars), starts with: ${content.slice(0, 80)}`);
      return content;
    }
  }

  console.log(`[ICS-DEBUG] No ICS found. Scanned ${entryCount} entries, ${fileCount} were File objects.`);
  return null;
}
