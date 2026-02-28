import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedMeeting, MeetingAttendee, Partner } from "../types";

// ============================================================
// Hoisted mocks
// ============================================================

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

// Set env vars so getSupabaseClient() doesn't throw before reaching createClient
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-key";

// Mock the Supabase client at the library level so getSupabaseClient() returns our mock
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
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
    is_recurring: false,
    organizer_name: "Jane Doe",
    is_cancellation: false,
    ...overrides,
  };
}

function buildPartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-001",
    name: "Acme Corp",
    segment: "isv",
    focus_area: [],
    alliance_lead: "Alice Lead",
    alliance_lead_email: "alice@amazon.com",
    psa: "Bob PSA",
    psa_email: "bob@amazon.com",
    account_manager: null,
    account_manager_email: null,
    pmm: null,
    pmm_email: null,
    spms_id: null,
    what_they_do: null,
    partner_contact_emails: ["jane@partner.com", "john@partner.com"],
    aws_stickiness: null,
    key_aws_services: [],
    airtable_record_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Helper to set up mockFrom for partners table query (used by getPartners → matchPartnerFromAttendees) */
function setupPartnersQuery(partners: Partner[]) {
  const originalImpl = mockFrom.getMockImplementation();
  mockFrom.mockImplementation((table: string) => {
    if (table === "partners") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: partners, error: null }),
        }),
      };
    }
    // Delegate to existing mock for other tables
    if (originalImpl) return originalImpl(table);
    return { select: vi.fn() };
  });
}

/**
 * Set up mockFrom for meetings + partners tables.
 * Returns capture objects for insert/update data.
 */
function setupMeetingMocks(
  existingMeeting: Record<string, unknown> | null,
  partners: Partner[] = []
) {
  const captured = {
    insertData: null as Record<string, unknown> | null,
    updateData: null as Record<string, unknown> | null,
    updateCalled: false,
  };

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
    if (table === "partners") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: partners, error: null }),
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
    setupPartnersQuery([
      buildPartner({ id: "p-1", name: "Acme Corp", partner_contact_emails: ["jane@acme.com"] }),
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Steven", email: "steven@amazon.com" },
      { name: "Jane", email: "jane@acme.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBe("p-1");
    expect(result.partner_name).toBe("Acme Corp");
  });

  it("skips amazon.com attendees", async () => {
    setupPartnersQuery([
      buildPartner({ id: "p-1", name: "Acme Corp", partner_contact_emails: ["a@amazon.com"] }),
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Steven", email: "steven@amazon.com" },
      { name: "Jane", email: "jane@amazon.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBeNull();
  });

  it("returns null when no partner domain matches", async () => {
    setupPartnersQuery([
      buildPartner({ id: "p-1", name: "Acme Corp", partner_contact_emails: ["a@acme.com"] }),
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Bob", email: "bob@unknown.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBeNull();
  });

  it("returns null when multiple partner domains match (ambiguous)", async () => {
    setupPartnersQuery([
      buildPartner({ id: "p-1", name: "Acme Corp", partner_contact_emails: ["a@acme.com"] }),
      buildPartner({ id: "p-2", name: "Beta Inc", partner_contact_emails: ["b@beta.com"] }),
    ]);

    const attendees: MeetingAttendee[] = [
      { name: "Alice", email: "alice@acme.com" },
      { name: "Bob", email: "bob@beta.com" },
    ];

    const result = await matchPartnerFromAttendees(attendees);
    expect(result.partner_id).toBeNull();
  });

  it("matches via alliance_lead_email domain (non-Amazon)", async () => {
    setupPartnersQuery([
      buildPartner({
        id: "p-1",
        name: "Acme Corp",
        alliance_lead_email: "lead@acme.com",
        partner_contact_emails: [],
      }),
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
    expect(captured.insertData!.is_recurring).toBe(false);
    expect(captured.insertData!.source).toBe("ics_parsed");
  });

  it("sets partner_id when attendee domain matches a partner", async () => {
    const partners = [
      buildPartner({ id: "p-1", name: "PartnerCo", partner_contact_emails: ["jane@partner.com"] }),
    ];
    const captured = setupMeetingMocks(null, partners);

    const parsed = buildParsedMeeting();
    const result = await createMeetingFromICS(parsed, "msg-001");

    expect(result).toBe("new-meeting-id");
    expect(captured.insertData!.partner_id).toBe("p-1");
    expect(captured.insertData!.partner_name).toBe("PartnerCo");
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
