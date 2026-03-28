import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedMeeting, MeetingAttendee } from "../types";

// ============================================================
// Hoisted mocks
// ============================================================

const { mockFrom, mockGetPartnerContactDomains } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetPartnerContactDomains: vi.fn().mockResolvedValue(new Map()),
}));

// Set env vars so getSupabaseClient() doesn't throw before reaching createClient
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-key";

// Mock the Supabase client at the library level so getSupabaseClient() returns our mock
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Mock participants module for getPartnerContactDomains
vi.mock("../db/participants", () => ({
  syncMeetingAttendeesToRegistry: vi.fn().mockResolvedValue(undefined),
  replaceMeetingParticipants: vi.fn().mockResolvedValue(undefined),
  getPartnerContactDomains: mockGetPartnerContactDomains,
}));

// Suppress fire-and-forget AT push (dynamic import in createMeetingFromICS)
vi.mock("../sync", () => ({
  pushMeetingToAirtable: vi.fn().mockResolvedValue({ action: "created" }),
}));

import { createMeetingFromICS, matchPartnerFromAttendees } from "../db/meetings";

// ============================================================
// Helpers
// ============================================================

function buildParsedMeeting(overrides: Partial<ParsedMeeting> = {}): ParsedMeeting {
  return {
    title: "Weekly Partner Sync",
    meeting_date: "2026-03-15",
    start_time: "2:00 PM",
    end_time: "3:00 PM",
    location: "Chime",
    organizer_email: "jane@partner.com",
    attendees: [
      { name: "Steven Romero", email: "steven@amazon.com" },
      { name: "Jane Doe", email: "jane@partner.com" },
    ],
    ics_uid: "test-uid-123@example.com",
    notes: null,
    method: null,
    status: null,
    sequence: null,
    organizer_name: "Jane Doe",
    is_cancellation: false,
    ...overrides,
  };
}


/** Helper to set up getPartnerContactDomains mock (used by matchPartnerFromAttendees) */
function setupPartnerDomains(domainEntries: Array<[string, { partnerId: string; partnerName: string }]>) {
  mockGetPartnerContactDomains.mockResolvedValue(new Map(domainEntries));
}

/**
 * Set up mockFrom for meetings table.
 * Returns capture objects for insert/update data.
 * Partner matching now uses getPartnerContactDomains (mocked via vi.mock("../db/participants")).
 */
function setupMeetingMocks(
  existingMeeting: Record<string, unknown> | null,
  partnerDomains: Array<[string, { partnerId: string; partnerName: string }]> = []
) {
  const captured = {
    insertData: null as Record<string, unknown> | null,
    updateData: null as Record<string, unknown> | null,
    updateCalled: false,
  };

  // Set up partner domain mock for matchPartnerFromAttendees
  mockGetPartnerContactDomains.mockResolvedValue(new Map(partnerDomains));

  mockFrom.mockImplementation((table: string) => {
    if (table === "meetings") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingMeeting,
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          captured.insertData = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "new-meeting-id" },
                error: null,
              }),
            }),
          };
        }),
        update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          captured.updateData = data;
          captured.updateCalled = true;
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
      };
    }
    return { select: vi.fn() };
  });

  return captured;
}

// ============================================================
// matchPartnerFromAttendees
// ============================================================

describe("matchPartnerFromAttendees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching partner when single partner domain matches", async () => {
    setupPartnerDomains([
      ["acme.com", { partnerId: "p-1", partnerName: "Acme Corp" }],
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Steven", email: "steven@amazon.com" },
      { name: "Jane", email: "jane@acme.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBe("p-1");
  });

  it("skips amazon.com attendees", async () => {
    setupPartnerDomains([
      ["acme.com", { partnerId: "p-1", partnerName: "Acme Corp" }],
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Steven", email: "steven@amazon.com" },
      { name: "Jane", email: "jane@amazon.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBeNull();
  });

  it("returns null when no partner domain matches", async () => {
    setupPartnerDomains([
      ["acme.com", { partnerId: "p-1", partnerName: "Acme Corp" }],
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Bob", email: "bob@unknown.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBeNull();
  });

  it("returns null when multiple partner domains match (ambiguous)", async () => {
    setupPartnerDomains([
      ["acme.com", { partnerId: "p-1", partnerName: "Acme Corp" }],
      ["beta.com", { partnerId: "p-2", partnerName: "Beta Inc" }],
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Alice", email: "alice@acme.com" },
      { name: "Bob", email: "bob@beta.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBeNull();
  });

  it("matches via registry domain (non-Amazon)", async () => {
    setupPartnerDomains([
      ["acme.com", { partnerId: "p-1", partnerName: "Acme Corp" }],
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Someone", email: "someone@acme.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBe("p-1");
  });

  it("returns null for empty attendees", async () => {
    const result = await matchPartnerFromAttendees([]);
    expect(result.partner_id).toBeNull();
  });
});

// ============================================================
// createMeetingFromICS
// ============================================================

describe("createMeetingFromICS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new meeting when no existing record found", async () => {
    const captured = setupMeetingMocks(null);

    const parsed = buildParsedMeeting({ sequence: 0 });
    const result = await createMeetingFromICS(parsed, "msg-001");

    expect(result).toBe("new-meeting-id");
    expect(captured.insertData).not.toBeNull();
    expect(captured.insertData!.status).toBe("scheduled");
    expect(captured.insertData!.sequence).toBe(0);
    expect(captured.insertData!.source).toBe("ics_parsed");
  });

  it("sets partner_id when attendee domain matches a partner", async () => {
    const captured = setupMeetingMocks(null, [
      ["partner.com", { partnerId: "p-1", partnerName: "PartnerCo" }],
    ]);

    const parsed = buildParsedMeeting();
    const result = await createMeetingFromICS(parsed, "msg-001");

    expect(result).toBe("new-meeting-id");
    expect(captured.insertData!.partner_id).toBe("p-1");
  });

  it("sets status to 'cancelled' for new cancellation meeting", async () => {
    const captured = setupMeetingMocks(null);

    const parsed = buildParsedMeeting({
      is_cancellation: true,
      method: "CANCEL",
    });
    const result = await createMeetingFromICS(parsed, "msg-001");

    expect(result).toBe("new-meeting-id");
    expect(captured.insertData!.status).toBe("cancelled");
  });

  it("cancels an existing meeting when is_cancellation is true", async () => {
    const captured = setupMeetingMocks({ id: "existing-id", sequence: 0 });

    const parsed = buildParsedMeeting({
      is_cancellation: true,
      method: "CANCEL",
      title: "Canceled: Weekly Sync",
    });
    const result = await createMeetingFromICS(parsed, "msg-002");

    expect(result).toBe("existing-id");
    expect(captured.updateData!.status).toBe("cancelled");
    expect(captured.updateData!.title).toBe("Canceled: Weekly Sync");
    // Should NOT overwrite attendees, time, etc.
    expect(captured.updateData!.attendees).toBeUndefined();
    expect(captured.updateData!.meeting_date).toBeUndefined();
  });

  it("updates existing meeting when sequence >= stored", async () => {
    const captured = setupMeetingMocks({ id: "existing-id", sequence: 1 });

    const parsed = buildParsedMeeting({
      sequence: 2,
      title: "Updated Title",
      meeting_date: "2026-04-01",
    });
    const result = await createMeetingFromICS(parsed, "msg-003");

    expect(result).toBe("existing-id");
    expect(captured.updateData).not.toBeNull();
    expect(captured.updateData!.title).toBe("Updated Title");
    expect(captured.updateData!.meeting_date).toBe("2026-04-01");
    expect(captured.updateData!.sequence).toBe(2);
    // Should NOT overwrite engagement_id, message_id, etc.
    expect(captured.updateData!.engagement_id).toBeUndefined();
    expect(captured.updateData!.message_id).toBeUndefined();
    expect(captured.updateData!.source).toBeUndefined();
  });

  it("rejects update when sequence < stored (stale)", async () => {
    const captured = setupMeetingMocks({ id: "existing-id", sequence: 5 });

    const parsed = buildParsedMeeting({ sequence: 3 });
    const result = await createMeetingFromICS(parsed, "msg-004");

    expect(result).toBe("existing-id");
    expect(captured.updateCalled).toBe(false);
  });

  it("accepts update when stored sequence is null", async () => {
    const captured = setupMeetingMocks({ id: "existing-id", sequence: null });

    const parsed = buildParsedMeeting({ sequence: 1 });
    const result = await createMeetingFromICS(parsed, "msg-005");

    expect(result).toBe("existing-id");
    expect(captured.updateData).not.toBeNull();
    expect(captured.updateData!.sequence).toBe(1);
  });
});
