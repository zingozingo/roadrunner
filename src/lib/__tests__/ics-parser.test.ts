import { describe, it, expect } from "vitest";
import { parseICSContent, extractICSFromAttachments } from "../ics-parser";

// ============================================================
// Helper: build a minimal valid ICS string
// ============================================================

function buildICS(
  overrides: Record<string, string> = {},
  extraLines: string[] = [],
  calendarProps: Record<string, string> = {}
): string {
  const defaults: Record<string, string> = {
    UID: "test-uid-123@example.com",
    SUMMARY: "Quarterly Business Review",
    DTSTART: "20260315T140000Z",
    DTEND: "20260315T150000Z",
    LOCATION: "Conference Room A",
    DESCRIPTION: "Discuss Q1 results and Q2 planning",
    ORGANIZER: "ORGANIZER;CN=Jane Smith:mailto:jane@partner.com",
    ATTENDEE1: "ATTENDEE;CN=Steven Romero;ROLE=REQ-PARTICIPANT:mailto:steven@amazon.com",
    ATTENDEE2: "ATTENDEE;CN=Bob Lee;ROLE=REQ-PARTICIPANT:mailto:bob@partner.com",
  };

  const merged = { ...defaults, ...overrides };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//Test//EN",
  ];

  // Add VCALENDAR-level properties (METHOD, etc.)
  for (const [key, value] of Object.entries(calendarProps)) {
    lines.push(`${key}:${value}`);
  }

  lines.push("BEGIN:VEVENT");

  // Add standard properties (skip ORGANIZER/ATTENDEE — handled separately)
  for (const [key, value] of Object.entries(merged)) {
    if (key === "ORGANIZER") {
      lines.push(value); // already includes "ORGANIZER;..." prefix
    } else if (key.startsWith("ATTENDEE")) {
      lines.push(value); // already includes "ATTENDEE;..." prefix
    } else {
      lines.push(`${key}:${value}`);
    }
  }

  lines.push(...extraLines);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

// ============================================================
// parseICSContent
// ============================================================

describe("parseICSContent", () => {
  it("parses a complete VCALENDAR with all fields", () => {
    const ics = buildICS();
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Quarterly Business Review");
    expect(result!.meeting_date).toBe("2026-03-15");
    expect(result!.start_time).toMatch(/\d{1,2}:\d{2} [AP]M/);
    expect(result!.end_time).toMatch(/\d{1,2}:\d{2} [AP]M/);
    expect(result!.location).toBe("Conference Room A");
    expect(result!.organizer_email).toBe("jane@partner.com");
    expect(result!.ics_uid).toBe("test-uid-123@example.com");
    expect(result!.notes).toBe("Discuss Q1 results and Q2 planning");
    expect(result!.attendees).toHaveLength(2);
    expect(result!.attendees[0]).toEqual({
      name: "Steven Romero",
      email: "steven@amazon.com",
    });
    expect(result!.attendees[1]).toEqual({
      name: "Bob Lee",
      email: "bob@partner.com",
    });
  });

  it("parses UTC (Z suffix) timestamps correctly", () => {
    const ics = buildICS({
      DTSTART: "20260601T180000Z",
      DTEND: "20260601T190000Z",
    });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.meeting_date).toBe("2026-06-01");
    // UTC 18:00 — exact local display depends on test runner TZ, but format is correct
    expect(result!.start_time).toMatch(/\d{1,2}:\d{2} [AP]M/);
    expect(result!.end_time).toMatch(/\d{1,2}:\d{2} [AP]M/);
  });

  it("parses TZID timezone format", () => {
    const ics = buildICS({
      DTSTART: "replaced", // will be overridden by raw line
      DTEND: "replaced",
    });

    // Manually construct with TZID params (can't use buildICS's key:value for parameterized props)
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:tzid-test-456@example.com",
      "SUMMARY:Partner Sync",
      "DTSTART;TZID=America/New_York:20260315T100000",
      "DTEND;TZID=America/New_York:20260315T110000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.meeting_date).toBe("2026-03-15");
    expect(result!.ics_uid).toBe("tzid-test-456@example.com");
    expect(result!.start_time).toMatch(/10:00 AM/);
    expect(result!.end_time).toMatch(/11:00 AM/);
  });

  it("handles missing optional fields (no LOCATION, no DESCRIPTION)", () => {
    const ics = buildICS({
      LOCATION: "",
      DESCRIPTION: "",
    });

    // Remove empty lines — buildICS will produce "LOCATION:" and "DESCRIPTION:" which
    // are technically present but empty. Build manually instead.
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:minimal-789@example.com",
      "SUMMARY:Quick Check-in",
      "DTSTART:20260401T090000Z",
      "DTEND:20260401T093000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Quick Check-in");
    expect(result!.location).toBeNull();
    expect(result!.notes).toBeNull();
    expect(result!.organizer_email).toBeNull();
    expect(result!.attendees).toEqual([]);
  });

  it("handles folded lines (RFC 5545 continuation)", () => {
    // Lines longer than 75 octets get folded with CRLF + space
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:fold-test@example.com",
      "SUMMARY:Very Important Meeting About Security Comp",
      " etency Program Review",
      "DTSTART:20260501T140000Z",
      "DTEND:20260501T150000Z",
      "DESCRIPTION:This is a long description that has be",
      " en folded across multiple lines to comply with th",
      " e 75-octet line length limit in RFC 5545.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.title).toBe(
      "Very Important Meeting About Security Competency Program Review"
    );
    expect(result!.notes).toBe(
      "This is a long description that has been folded across multiple lines to comply with the 75-octet line length limit in RFC 5545."
    );
  });

  it("handles escaped characters in SUMMARY and DESCRIPTION", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:escape-test@example.com",
      "SUMMARY:Acme\\, Inc. \\; Security Review",
      "DTSTART:20260601T100000Z",
      "DTEND:20260601T110000Z",
      "DESCRIPTION:Line one\\nLine two\\nAction items:\\n- Item A\\, urgent\\n- Item B",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Acme, Inc. ; Security Review");
    expect(result!.notes).toContain("Line one\nLine two");
    expect(result!.notes).toContain("Item A, urgent");
  });

  it("parses multiple ATTENDEEs with varied formats", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:multi-attendee@example.com",
      "SUMMARY:Team Sync",
      "DTSTART:20260315T140000Z",
      "DTEND:20260315T150000Z",
      'ATTENDEE;CN="Dana Wright";ROLE=REQ-PARTICIPANT:mailto:dana@aws.example.com',
      "ATTENDEE;CN=Monty Burns;RSVP=TRUE:mailto:monty@partner.com",
      "ATTENDEE;ROLE=OPT-PARTICIPANT;CN=CJ Park:mailto:cj@partner.com",
      "ATTENDEE:mailto:unknown@example.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.attendees).toHaveLength(4);
    expect(result!.attendees[0]).toEqual({
      name: "Dana Wright",
      email: "dana@aws.example.com",
    });
    expect(result!.attendees[1]).toEqual({
      name: "Monty Burns",
      email: "monty@partner.com",
    });
    expect(result!.attendees[2]).toEqual({
      name: "CJ Park",
      email: "cj@partner.com",
    });
    // No CN — falls back to email
    expect(result!.attendees[3]).toEqual({
      name: "unknown@example.com",
      email: "unknown@example.com",
    });
  });

  it("returns null when no VEVENT block found", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Test//Test//EN",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseICSContent(raw)).toBeNull();
  });

  it("returns null when UID is missing", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:No UID Meeting",
      "DTSTART:20260315T140000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseICSContent(raw)).toBeNull();
  });

  it("returns null when SUMMARY is missing", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:no-summary@example.com",
      "DTSTART:20260315T140000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseICSContent(raw)).toBeNull();
  });

  it("returns null when DTSTART is missing", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:no-dtstart@example.com",
      "SUMMARY:Missing Start",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseICSContent(raw)).toBeNull();
  });

  it("returns null on completely malformed input", () => {
    expect(parseICSContent("")).toBeNull();
    expect(parseICSContent("not ics at all")).toBeNull();
    expect(parseICSContent("BEGIN:VCALENDAR\ngarbage")).toBeNull();
  });

  it("uses DTSTART as end_time when DTEND is missing", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:no-end@example.com",
      "SUMMARY:Open-Ended Meeting",
      "DTSTART:20260315T140000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.start_time).toBe(result!.end_time);
  });

  it("handles LF-only line endings (no CRLF)", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:lf-only@example.com",
      "SUMMARY:LF Test",
      "DTSTART:20260315T140000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"); // LF only, no CR

    const result = parseICSContent(raw);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("LF Test");
  });

  // ============================================================
  // New fields: method, status, sequence,
  //             organizer_name, is_cancellation
  // ============================================================

  it("defaults new fields to null/false when not present in ICS", () => {
    const ics = buildICS();
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    // Existing fields still work
    expect(result!.title).toBe("Quarterly Business Review");
    expect(result!.organizer_email).toBe("jane@partner.com");
    // New fields
    expect(result!.method).toBeNull();
    expect(result!.status).toBeNull();
    expect(result!.sequence).toBeNull();
    expect(result!.organizer_name).toBe("Jane Smith");
    expect(result!.is_cancellation).toBe(false);
  });

  it("extracts METHOD:CANCEL from VCALENDAR level → is_cancellation true", () => {
    const ics = buildICS({}, [], { METHOD: "CANCEL" });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("CANCEL");
    expect(result!.is_cancellation).toBe(true);
  });

  it("extracts METHOD:REQUEST from VCALENDAR level → is_cancellation false", () => {
    const ics = buildICS({}, [], { METHOD: "REQUEST" });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("REQUEST");
    expect(result!.is_cancellation).toBe(false);
  });

  it("extracts STATUS:CANCELLED from VEVENT → is_cancellation true", () => {
    const ics = buildICS({}, ["STATUS:CANCELLED"]);
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.status).toBe("CANCELLED");
    expect(result!.is_cancellation).toBe(true);
  });

  it("extracts STATUS:CONFIRMED from VEVENT → is_cancellation false", () => {
    const ics = buildICS({}, ["STATUS:CONFIRMED"]);
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.status).toBe("CONFIRMED");
    expect(result!.is_cancellation).toBe(false);
  });

  it("extracts SEQUENCE as integer", () => {
    const ics = buildICS({}, ["SEQUENCE:3"]);
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.sequence).toBe(3);
  });

  it("extracts organizer_name from CN parameter", () => {
    const ics = buildICS({
      ORGANIZER: 'ORGANIZER;CN="Dr. Alice Chen":mailto:alice@partner.com',
    });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.organizer_name).toBe("Dr. Alice Chen");
    expect(result!.organizer_email).toBe("alice@partner.com");
  });

  it("organizer_name is null when no CN on ORGANIZER", () => {
    const ics = buildICS({
      ORGANIZER: "ORGANIZER:mailto:noname@partner.com",
    });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.organizer_name).toBeNull();
    expect(result!.organizer_email).toBe("noname@partner.com");
  });

  it("title starting with 'Canceled:' triggers is_cancellation even without METHOD/STATUS", () => {
    const ics = buildICS({
      SUMMARY: "Canceled: spacelift aws marketplace solution",
    });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.method).toBeNull();
    expect(result!.status).toBeNull();
    expect(result!.is_cancellation).toBe(true);
  });

  it("title starting with 'Cancelled:' (British spelling) triggers is_cancellation", () => {
    const ics = buildICS({
      SUMMARY: "Cancelled: weekly partner sync",
    });
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.is_cancellation).toBe(true);
  });

  it("combines METHOD:CANCEL + STATUS:CANCELLED + SEQUENCE + RRULE", () => {
    const ics = buildICS(
      {},
      ["STATUS:CANCELLED", "SEQUENCE:2", "RRULE:FREQ=DAILY;COUNT=10"],
      { METHOD: "CANCEL" }
    );
    const result = parseICSContent(ics);

    expect(result).not.toBeNull();
    expect(result!.method).toBe("CANCEL");
    expect(result!.status).toBe("CANCELLED");
    expect(result!.sequence).toBe(2);
    expect(result!.is_cancellation).toBe(true);
  });
});

// ============================================================
// Multi-VEVENT guardrail (one forward = one meeting)
// ============================================================

describe("parseICSContent — multi-VEVENT guardrail", () => {
  it("returns exactly one meeting from ICS with multiple VEVENT blocks", () => {
    // Simulate a recurring series ICS: master event + one occurrence override
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Test//Test//EN",
      "BEGIN:VEVENT",
      "UID:series-master@example.com",
      "SUMMARY:Weekly Partner Sync",
      "DTSTART:20260310T100000Z",
      "DTEND:20260310T103000Z",
      "LOCATION:Chime",
      "RRULE:FREQ=WEEKLY;BYDAY=TU",
      "ORGANIZER;CN=Jane Smith:mailto:jane@partner.com",
      "ATTENDEE;CN=Steven Romero:mailto:steven@amazon.com",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:series-master@example.com",
      "RECURRENCE-ID:20260317T100000Z",
      "SUMMARY:Weekly Partner Sync (Rescheduled)",
      "DTSTART:20260318T140000Z",
      "DTEND:20260318T143000Z",
      "LOCATION:Zoom",
      "ORGANIZER;CN=Jane Smith:mailto:jane@partner.com",
      "ATTENDEE;CN=Steven Romero:mailto:steven@amazon.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const result = parseICSContent(ics);

    // Returns exactly one meeting
    expect(result).not.toBeNull();

    // Uses data from the FIRST VEVENT only
    expect(result!.title).toBe("Weekly Partner Sync");
    expect(result!.meeting_date).toBe("2026-03-10");
    expect(result!.location).toBe("Chime");

    // Second VEVENT's data is NOT used
    expect(result!.title).not.toBe("Weekly Partner Sync (Rescheduled)");
    expect(result!.location).not.toBe("Zoom");
  });
});

// ============================================================
// extractICSFromAttachments
// ============================================================

describe("extractICSFromAttachments", () => {
  it("extracts .ics file from FormData by filename", async () => {
    const icsContent = buildICS();
    const file = new File([icsContent], "invite.ics", {
      type: "application/octet-stream",
    });

    const formData = new FormData();
    formData.append("body-plain", "Some email text");
    formData.append("attachment-1", file);

    const result = await extractICSFromAttachments(formData);

    expect(result).not.toBeNull();
    expect(result).toContain("BEGIN:VCALENDAR");
    expect(result).toContain("Quarterly Business Review");
  });

  it("extracts file by text/calendar content-type", async () => {
    const icsContent = buildICS({ SUMMARY: "Calendar Type Test" });
    const file = new File([icsContent], "meeting.dat", {
      type: "text/calendar",
    });

    const formData = new FormData();
    formData.append("attachment-1", file);

    const result = await extractICSFromAttachments(formData);

    expect(result).not.toBeNull();
    expect(result).toContain("Calendar Type Test");
  });

  it("returns null when no ICS attachment is present", async () => {
    const formData = new FormData();
    formData.append("body-plain", "Just a regular email");
    formData.append("subject", "No attachments here");

    const result = await extractICSFromAttachments(formData);

    expect(result).toBeNull();
  });

  it("returns null when attachments are non-ICS files", async () => {
    const pdfFile = new File(["fake pdf"], "document.pdf", {
      type: "application/pdf",
    });

    const formData = new FormData();
    formData.append("attachment-1", pdfFile);

    const result = await extractICSFromAttachments(formData);

    expect(result).toBeNull();
  });
});
