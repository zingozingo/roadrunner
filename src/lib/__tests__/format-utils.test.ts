import { describe, it, expect } from "vitest";
import { displayName } from "../format-utils";
import type { TimelineItem, Message, Meeting } from "../types";

describe("displayName", () => {
  // Title-case normalization
  it("title-cases lowercase names", () => {
    expect(displayName("Tim wikander", "tim@example.com")).toBe("Tim Wikander");
  });

  it("title-cases all-caps names", () => {
    expect(displayName("JOHN DOE", "john@example.com")).toBe("John Doe");
  });

  it("title-cases mixed case", () => {
    expect(displayName("stefan tabacaru", "stefan@example.com")).toBe("Stefan Tabacaru");
  });

  // Apostrophe handling
  it("preserves O'Brien capitalization", () => {
    expect(displayName("O'Brien", null)).toBe("O'Brien");
  });

  it("fixes o'brien from lowercase", () => {
    expect(displayName("o'brien", null)).toBe("O'Brien");
  });

  // Lowercase prefixes
  it("keeps 'van der' lowercase when not first word", () => {
    expect(displayName("ludwig van der berg", null)).toBe("Ludwig van der Berg");
  });

  it("capitalizes 'van' when it IS the first word", () => {
    expect(displayName("van der berg", null)).toBe("Van der Berg");
  });

  // 2-letter initials
  it("preserves 2-letter all-caps initials", () => {
    expect(displayName("CJ", null)).toBe("CJ");
  });

  it("preserves DJ initials", () => {
    expect(displayName("DJ Smith", null)).toBe("DJ Smith");
  });

  // Mc/Mac prefixes
  it("handles McBride", () => {
    expect(displayName("mcbride", null)).toBe("McBride");
  });

  it("handles MacDonald", () => {
    expect(displayName("macdonald", null)).toBe("MacDonald");
  });

  // Fallback to Unknown
  it("returns Unknown for null, null", () => {
    expect(displayName(null, null)).toBe("Unknown");
  });

  // Email fallback
  it("title-cases from email when name is null", () => {
    expect(displayName(null, "john.doe@acme.com")).toBe("John Doe");
  });

  // Strip angle-bracket fragments
  it("strips trailing angle-bracket email fragment from name", () => {
    expect(displayName("Tim wikander <tim", "tim@example.com")).toBe("Tim Wikander");
  });

  it("strips complete angle-bracket email from name", () => {
    expect(displayName("Tim wikander <tim@example.com>", "tim@example.com")).toBe("Tim Wikander");
  });

  // Name equals email → use email display
  it("falls through to email display when name equals email", () => {
    expect(displayName("tim@example.com", "tim@example.com")).toBe("Tim");
  });

  // Name contains @ → treat as no-name
  it("falls through to email display when name contains @", () => {
    expect(displayName("user@domain.com", "user@domain.com")).toBe("User");
  });

  // Hyphenated names
  it("handles hyphenated names", () => {
    expect(displayName("mary-jane watson", null)).toBe("Mary-Jane Watson");
  });

  // Defensive: raw header leaked into email field
  it("extracts name from Outlook mailto header in email field", () => {
    expect(displayName(null, "Sturgess, CJ <sturgeci@amazon.com<mailto:sturgeci@amazon.com>>")).toBe("CJ Sturgess");
  });

  it("extracts name from Tim Wikander mailto header in email field", () => {
    expect(displayName(null, "Tim Wikander <tim.wikander@opswat.com<mailto:tim.wikander@opswat.com>>")).toBe("Tim Wikander");
  });

  // Comma-inverted names
  it("flips comma-inverted name: Sturgess, cj", () => {
    expect(displayName("Sturgess, cj", "sturgeci@amazon.com")).toBe("CJ Sturgess");
  });

  // 2-letter lowercase initials
  it("uppercases 2-letter lowercase initials: cj → CJ", () => {
    expect(displayName("cj smith", null)).toBe("CJ Smith");
  });

  it("uppercases initials from email: cj.sturgess@amazon.com", () => {
    expect(displayName(null, "cj.sturgess@amazon.com")).toBe("CJ Sturgess");
  });
});

// Helper to build a minimal Message for timeline tests
function makeMessage(overrides: Partial<Message> & { id: string; sent_at?: string | null; forwarded_at?: string }): Message {
  return {
    id: overrides.id,
    engagement_id: null,
    sender_name: null,
    sender_email: null,
    sent_at: overrides.sent_at ?? null,
    subject: null,
    body_text: null,
    body_raw: null,
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarded_at: overrides.forwarded_at ?? "2026-01-01T00:00:00Z",
    pending_review: false,
    classification_result: null,
    forwarder_email: null,
    forwarder_name: null,
    forwarder_note: null,
    to_header: null,
    cc_header: null,
    ...overrides,
  } as Message;
}

function makeMeeting(overrides: Partial<Meeting> & { id: string; meeting_date?: string | null }): Meeting {
  return {
    id: overrides.id,
    title: "Test Meeting",
    engagement_id: null,
    partner_name: null,
    partner_id: null,
    message_id: null,
    status: "scheduled",
    meeting_date: overrides.meeting_date ?? null,
    start_time: null,
    end_time: null,
    location: null,
    organizer_email: null,
    attendees: [],
    ics_uid: null,
    sequence: null,
    is_recurring: false,
    source: "manual",
    notes: null,
    airtable_record_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Meeting;
}

/** Reproduce the exact sorting + consolidation logic from the engagement detail page */
function buildTimeline(messages: Message[], meetings: Meeting[]): TimelineItem[] {
  // Suppress messages that have an associated meeting record
  const meetingSourceMessageIds = new Set(
    meetings.filter((m) => m.message_id).map((m) => m.message_id!)
  );

  const items: TimelineItem[] = [];
  for (const msg of messages) {
    if (meetingSourceMessageIds.has(msg.id)) continue;
    const date = msg.sent_at ?? msg.forwarded_at;
    items.push({ type: "message", date, data: msg });
  }
  for (const mtg of meetings) {
    const date = mtg.meeting_date
      ? mtg.meeting_date + "T00:00:00"
      : new Date().toISOString();
    items.push({ type: "meeting", date, data: mtg });
  }
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

describe("unified timeline sorting", () => {
  it("interleaves messages and meetings by date (newest first)", () => {
    const messages = [
      makeMessage({ id: "msg1", sent_at: "2026-02-20T10:00:00Z" }),
      makeMessage({ id: "msg2", sent_at: "2026-02-23T10:00:00Z" }),
    ];
    const meetings = [
      makeMeeting({ id: "mtg1", meeting_date: "2026-02-26" }),
    ];

    const timeline = buildTimeline(messages, meetings);

    expect(timeline.map((i) => i.data.id)).toEqual(["mtg1", "msg2", "msg1"]);
  });

  it("meeting at Feb 26 appears before email at Feb 20", () => {
    const messages = [
      makeMessage({ id: "email-feb20", sent_at: "2026-02-20T12:00:00Z" }),
    ];
    const meetings = [
      makeMeeting({ id: "mtg-feb26", meeting_date: "2026-02-26" }),
    ];

    const timeline = buildTimeline(messages, meetings);

    expect(timeline[0].data.id).toBe("mtg-feb26");
    expect(timeline[1].data.id).toBe("email-feb20");
  });

  it("falls back to forwarded_at when sent_at is null", () => {
    const messages = [
      makeMessage({ id: "msg-no-sent", sent_at: null, forwarded_at: "2026-02-15T10:00:00Z" }),
      makeMessage({ id: "msg-with-sent", sent_at: "2026-02-18T10:00:00Z" }),
    ];

    const timeline = buildTimeline(messages, []);

    expect(timeline[0].data.id).toBe("msg-with-sent");
    expect(timeline[1].data.id).toBe("msg-no-sent");
  });

  it("sorts multiple meetings correctly among messages", () => {
    const messages = [
      makeMessage({ id: "msg1", sent_at: "2026-02-10T10:00:00Z" }),
      makeMessage({ id: "msg2", sent_at: "2026-02-20T10:00:00Z" }),
    ];
    const meetings = [
      makeMeeting({ id: "mtg1", meeting_date: "2026-02-15" }),
      makeMeeting({ id: "mtg2", meeting_date: "2026-02-25" }),
    ];

    const timeline = buildTimeline(messages, meetings);

    expect(timeline.map((i) => i.data.id)).toEqual(["mtg2", "msg2", "mtg1", "msg1"]);
  });

  it("meeting replaces its source message in timeline (consolidation)", () => {
    const messages = [
      makeMessage({ id: "msg-source", sent_at: "2026-02-18T10:00:00Z" }),
    ];
    const meetings = [
      makeMeeting({ id: "mtg-linked", meeting_date: "2026-02-26", message_id: "msg-source" }),
    ];

    const timeline = buildTimeline(messages, meetings);

    // Only the meeting card appears — the source message is suppressed
    expect(timeline).toHaveLength(1);
    expect(timeline[0].data.id).toBe("mtg-linked");
    expect(timeline[0].type).toBe("meeting");
  });

  it("messages without associated meetings still appear", () => {
    const messages = [
      makeMessage({ id: "msg-standalone", sent_at: "2026-02-18T10:00:00Z" }),
      makeMessage({ id: "msg-source", sent_at: "2026-02-20T10:00:00Z" }),
    ];
    const meetings = [
      makeMeeting({ id: "mtg-linked", meeting_date: "2026-02-26", message_id: "msg-source" }),
    ];

    const timeline = buildTimeline(messages, meetings);

    // msg-source suppressed, msg-standalone and mtg-linked remain
    expect(timeline).toHaveLength(2);
    expect(timeline.map(i => i.data.id)).toEqual(["mtg-linked", "msg-standalone"]);
  });
});

// ============================================================
// "Better name" comparison logic (mirrors backfillMessageSenderNames)
// ============================================================

/** Pure version of the "better name" check used by both backfill and UI */
function isBetterName(current: string | null, candidate: string): boolean {
  const currentWords = current ? current.split(/\s+/).length : 0;
  const newWords = candidate.split(/\s+/).length;
  return newWords > currentWords;
}

describe("better name comparison", () => {
  it("participant name beats null sender_name", () => {
    expect(isBetterName(null, "Taylor Murphy")).toBe(true);
  });

  it("two-word name beats one-word name", () => {
    expect(isBetterName("Taylor", "Taylor Murphy")).toBe(true);
  });

  it("does not overwrite equally long name", () => {
    expect(isBetterName("Taylor Murphy", "Taylor Swift")).toBe(false);
  });

  it("does not overwrite longer name with shorter", () => {
    expect(isBetterName("Mary Jane Watson", "Mary Watson")).toBe(false);
  });

  it("Steven → Steven Romero is an upgrade", () => {
    expect(isBetterName("Steven", "Steven Romero")).toBe(true);
  });
});

// ============================================================
// UI participant name lookup (belt-and-suspenders)
// ============================================================

/** Reproduce the participant name lookup from Timeline MessageCard */
function resolveDisplayNameWithParticipants(
  senderName: string | null,
  senderEmail: string | null,
  participantNameMap: Map<string, string>
): string {
  let name = senderName;
  if (senderEmail) {
    const pName = participantNameMap.get(senderEmail.toLowerCase());
    if (pName) {
      const currentWords = name ? name.split(/\s+/).length : 0;
      const pWords = pName.split(/\s+/).length;
      if (pWords > currentWords) name = pName;
    }
  }
  return displayName(name, senderEmail);
}

describe("UI participant name lookup", () => {
  const participants = new Map([
    ["taylor@acme.com", "Taylor Murphy"],
    ["sterme@amazon.com", "Steven Romero"],
  ]);

  it("uses participant name when sender_name is null", () => {
    expect(resolveDisplayNameWithParticipants(null, "taylor@acme.com", participants)).toBe("Taylor Murphy");
  });

  it("upgrades single-word sender_name with participant full name", () => {
    expect(resolveDisplayNameWithParticipants("Taylor", "taylor@acme.com", participants)).toBe("Taylor Murphy");
  });

  it("keeps sender_name when equally specific", () => {
    expect(resolveDisplayNameWithParticipants("Taylor Murphy", "taylor@acme.com", participants)).toBe("Taylor Murphy");
  });

  it("resolves Steven to Steven Romero via participant map", () => {
    expect(resolveDisplayNameWithParticipants("Steven", "sterme@amazon.com", participants)).toBe("Steven Romero");
  });

  it("falls back to email display when no participant match", () => {
    expect(resolveDisplayNameWithParticipants(null, "unknown@example.com", participants)).toBe("Unknown");
  });
});
