import { describe, it, expect } from "vitest";
import {
  detectMeetingFromBody,
  parseWhenLine,
  parseAttendeeList,
  cleanSubjectPrefix,
} from "../meeting-detector";

// --- Outlook "Original Appointment" blocks ---

describe("detectMeetingFromBody", () => {
  describe("Tier 1: Outlook Original Appointment", () => {
    it("extracts full meeting from Original Appointment block", () => {
      const body = `
Steven forwarded this meeting.

-----Original Appointment-----
From: John Smith <john@partner.com>
To: Steven Romero <sromero@amazon.com>; Jane Doe <jane@partner.com>
Subject: Quarterly Business Review
When: Thursday, February 27, 2026 10:00 AM-11:00 AM (UTC-08:00)
Where: https://chime.aws/1234567890

Let's review Q4 results and plan for Q1.
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Quarterly Business Review");

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Quarterly Business Review");
      expect(result!.meeting_date).toBe("2026-02-27");
      expect(result!.start_time).toBe("10:00:00");
      expect(result!.end_time).toBe("11:00:00");
      expect(result!.location).toBe("https://chime.aws/1234567890");
      expect(result!.organizer_email).toBe("john@partner.com");
      expect(result!.organizer_name).toBe("John Smith");
      expect(result!.attendees).toHaveLength(2);
      expect(result!.attendees[0].email).toBe("sromero@amazon.com");
      expect(result!.attendees[1].email).toBe("jane@partner.com");
      expect(result!.is_cancellation).toBe(false);
      expect(result!.ics_uid).toMatch(/^body-parsed-/);
      expect(result!.method).toBeNull();
      expect(result!.sequence).toBeNull();
      expect(result!.is_recurring).toBe(false);
    });

    it("uses inner Subject line over outer email subject", () => {
      const body = `
-----Original Appointment-----
Subject: Partner Sync - Nozomi Networks
When: March 1, 2026 2:00 PM-3:00 PM
Where: Teams meeting
      `.trim();

      const result = detectMeetingFromBody(body, "FW: RE: Something else");
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Partner Sync - Nozomi Networks");
    });

    it("falls back to outer subject when no inner Subject line", () => {
      const body = `
-----Original Appointment-----
When: March 1, 2026 2:00 PM-3:00 PM
Where: Conference Room B
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Weekly Standup");
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Weekly Standup");
    });

    it("handles case-insensitive marker", () => {
      const body = `
-----original appointment-----
When: March 1, 2026 9:00 AM-10:00 AM
Where: Zoom
      `.trim();

      const result = detectMeetingFromBody(body, "Meeting");
      expect(result).not.toBeNull();
    });

    it("returns null for Original Appointment without When:", () => {
      const body = `
-----Original Appointment-----
From: John Smith <john@partner.com>
Subject: Old Meeting
Where: Room A
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Old Meeting");
      expect(result).toBeNull();
    });

    it("detects cancellation from Canceled: prefix in inner subject", () => {
      const body = `
-----Original Appointment-----
Subject: Canceled: Quarterly Review
When: March 10, 2026 1:00 PM-2:00 PM
Where: Teams
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Canceled: Quarterly Review");
      expect(result).not.toBeNull();
      expect(result!.is_cancellation).toBe(true);
      expect(result!.title).toBe("Canceled: Quarterly Review");
    });

    it("detects cancellation from Cancelled: prefix (British spelling)", () => {
      const body = `
-----Original Appointment-----
Subject: Cancelled: Sprint Review
When: March 10, 2026 1:00 PM-2:00 PM
Where: Teams
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Cancelled: Sprint Review");
      expect(result).not.toBeNull();
      expect(result!.is_cancellation).toBe(true);
    });
  });

  describe("Tier 2: Generic When + Where", () => {
    it("detects meeting with When: and Where: lines", () => {
      const body = `
Hi team,

When: Friday, March 14, 2026 3:00 PM-4:00 PM (UTC-08:00)
Where: https://zoom.us/j/123456789

Please join for the kickoff.
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Project Kickoff");
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Project Kickoff");
      expect(result!.meeting_date).toBe("2026-03-14");
      expect(result!.start_time).toBe("15:00:00");
      expect(result!.end_time).toBe("16:00:00");
      expect(result!.location).toBe("https://zoom.us/j/123456789");
      expect(result!.organizer_email).toBeNull();
      expect(result!.attendees).toHaveLength(0);
    });

    it("returns null when only When: present (no Where:)", () => {
      const body = `
Let's meet on:
When: March 14, 2026 3:00 PM-4:00 PM

No location specified.
      `.trim();

      const result = detectMeetingFromBody(body, "Meeting?");
      expect(result).toBeNull();
    });

    it("returns null when only Where: present (no When:)", () => {
      const body = `
Where: https://zoom.us/j/123456789
Join anytime!
      `.trim();

      const result = detectMeetingFromBody(body, "Zoom Link");
      expect(result).toBeNull();
    });
  });

  describe("false positive prevention", () => {
    it("returns null for regular email with Zoom link in discussion", () => {
      const body = `
Hi Steven,

Thanks for the follow-up. Here's the Zoom link for reference:
https://zoom.us/j/123456789

Let me know when you've reviewed the doc.
      `.trim();

      const result = detectMeetingFromBody(body, "RE: Follow up");
      expect(result).toBeNull();
    });

    it("returns null for meeting notes recap email", () => {
      const body = `
Hi team,

Here are the notes from our meeting:

1. Discussed Q4 roadmap
2. Agreed on timeline
3. Next steps: finalize budget

Thanks,
Jane
      `.trim();

      const result = detectMeetingFromBody(body, "FW: Meeting Notes");
      expect(result).toBeNull();
    });

    it("returns null for empty body", () => {
      expect(detectMeetingFromBody("", "Subject")).toBeNull();
    });

    it("returns null for body with no meeting signals", () => {
      const body = "Just a quick note about the partner engagement. No meetings here.";
      expect(detectMeetingFromBody(body, "FW: Update")).toBeNull();
    });
  });
});

// --- parseWhenLine ---

describe("parseWhenLine", () => {
  it("parses US format with day of week and timezone", () => {
    const result = parseWhenLine(
      "Thursday, February 27, 2026 10:00 AM-11:00 AM (UTC-08:00)"
    );
    expect(result).toEqual({
      date: "2026-02-27",
      startTime: "10:00:00",
      endTime: "11:00:00",
    });
  });

  it("parses US format without day of week", () => {
    const result = parseWhenLine("February 27, 2026 10:00 AM-11:00 AM");
    expect(result).toEqual({
      date: "2026-02-27",
      startTime: "10:00:00",
      endTime: "11:00:00",
    });
  });

  it("parses PM times correctly", () => {
    const result = parseWhenLine("March 1, 2026 2:30 PM-4:00 PM");
    expect(result).toEqual({
      date: "2026-03-01",
      startTime: "14:30:00",
      endTime: "16:00:00",
    });
  });

  it("parses 12:00 PM as noon", () => {
    const result = parseWhenLine("March 1, 2026 12:00 PM-1:00 PM");
    expect(result).toEqual({
      date: "2026-03-01",
      startTime: "12:00:00",
      endTime: "13:00:00",
    });
  });

  it("parses 12:00 AM as midnight", () => {
    const result = parseWhenLine("March 1, 2026 12:00 AM-1:00 AM");
    expect(result).toEqual({
      date: "2026-03-01",
      startTime: "00:00:00",
      endTime: "01:00:00",
    });
  });

  it("parses European format with 24-hour time", () => {
    const result = parseWhenLine("27 February 2026 10:00-11:00 (UTC+01:00)");
    expect(result).toEqual({
      date: "2026-02-27",
      startTime: "10:00:00",
      endTime: "11:00:00",
    });
  });

  it("parses European format without timezone", () => {
    const result = parseWhenLine("14 March 2026 14:30-16:00");
    expect(result).toEqual({
      date: "2026-03-14",
      startTime: "14:30:00",
      endTime: "16:00:00",
    });
  });

  it("handles en-dash separator", () => {
    const result = parseWhenLine("March 1, 2026 2:00 PM\u20133:00 PM");
    expect(result).toEqual({
      date: "2026-03-01",
      startTime: "14:00:00",
      endTime: "15:00:00",
    });
  });

  it("returns null for unparseable line", () => {
    expect(parseWhenLine("next Tuesday around 3pm")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseWhenLine("")).toBeNull();
  });

  it("handles timezone suffix (UTC-08:00)", () => {
    const result = parseWhenLine(
      "Friday, March 14, 2026 3:00 PM-4:00 PM (UTC-08:00)"
    );
    expect(result).toEqual({
      date: "2026-03-14",
      startTime: "15:00:00",
      endTime: "16:00:00",
    });
  });

  it("handles timezone suffix (UTC+01:00)", () => {
    const result = parseWhenLine(
      "Friday, March 14, 2026 3:00 PM-4:00 PM (UTC+01:00)"
    );
    expect(result).toEqual({
      date: "2026-03-14",
      startTime: "15:00:00",
      endTime: "16:00:00",
    });
  });
});

// --- parseAttendeeList ---

describe("parseAttendeeList", () => {
  it("parses semicolon-separated attendees with email", () => {
    const result = parseAttendeeList(
      "John Smith <john@example.com>; Jane Doe <jane@example.com>"
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "John Smith", email: "john@example.com" });
    expect(result[1]).toEqual({ name: "Jane Doe", email: "jane@example.com" });
  });

  it("parses comma-separated bare emails", () => {
    const result = parseAttendeeList("john@example.com, jane@example.com");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: null, email: "john@example.com" });
    expect(result[1]).toEqual({ name: null, email: "jane@example.com" });
  });

  it("parses names without email addresses", () => {
    const result = parseAttendeeList("John Smith; Jane Doe");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "John Smith", email: "" });
    expect(result[1]).toEqual({ name: "Jane Doe", email: "" });
  });

  it("prefers semicolons when both separators present", () => {
    // "Smith, John <j@e.com>; Doe, Jane <d@e.com>" — commas are in names
    const result = parseAttendeeList(
      "Smith, John <j@e.com>; Doe, Jane <d@e.com>"
    );
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("j@e.com");
    expect(result[1].email).toBe("d@e.com");
  });

  it("handles single attendee", () => {
    const result = parseAttendeeList("John Smith <john@example.com>");
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("john@example.com");
  });

  it("returns empty for empty string", () => {
    expect(parseAttendeeList("")).toHaveLength(0);
  });
});

// --- cleanSubjectPrefix ---

describe("cleanSubjectPrefix", () => {
  it("strips FW: prefix", () => {
    expect(cleanSubjectPrefix("FW: Meeting")).toBe("Meeting");
  });

  it("strips RE: prefix", () => {
    expect(cleanSubjectPrefix("RE: Meeting")).toBe("Meeting");
  });

  it("strips Fwd: prefix", () => {
    expect(cleanSubjectPrefix("Fwd: Meeting")).toBe("Meeting");
  });

  it("strips multiple nested prefixes", () => {
    expect(cleanSubjectPrefix("FW: RE: Meeting")).toBe("Meeting");
  });

  it("strips fw: (lowercase)", () => {
    expect(cleanSubjectPrefix("fw: Meeting")).toBe("Meeting");
  });

  it("returns unchanged string with no prefix", () => {
    expect(cleanSubjectPrefix("Meeting")).toBe("Meeting");
  });

  it("handles empty string", () => {
    expect(cleanSubjectPrefix("")).toBe("");
  });
});
