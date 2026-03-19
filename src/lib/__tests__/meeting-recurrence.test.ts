import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Meeting } from "../types";

// ── Mock setup ──────────────────────────────────────────────
const { mockFrom, mockSelect, mockInsert, mockEq, mockIn, mockNot, mockLt, mockOr, mockGte, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockGte = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockOr = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockLt = vi.fn(() => ({ or: mockOr }));
  const mockNot = vi.fn(() => ({ lt: mockLt }));
  const mockIn = vi.fn(() => ({ gte: mockGte }));
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle, in: mockIn, gte: mockGte, not: mockNot }));
  const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    not: mockNot,
    lt: mockLt,
    or: mockOr,
    eq: mockEq,
    in: mockIn,
    gte: mockGte,
  }));
  return { mockFrom, mockSelect, mockInsert, mockEq, mockIn, mockNot, mockLt, mockOr, mockGte, mockSingle };
});

vi.mock("../db/client", () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock("../sync/push", () => ({
  pushMeetingToAirtable: vi.fn().mockResolvedValue({ action: "created" }),
}));

import { calculateNextDate, getOverdueRecurringMeetings, spawnNextOccurrence } from "../meeting-recurrence";

// ── Helper: build a mock Meeting ────────────────────────────
function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: "m-001",
    title: "Weekly Sync",
    engagement_id: "e-001",
    partner_id: "p-001",
    message_id: null,
    status: "scheduled",
    meeting_date: "2026-03-11",
    start_time: "10:00",
    end_time: "10:30",
    location: "Chime",
    organizer_email: null,
    organizer_name: null,
    ics_uid: null,
    sequence: null,
    is_recurring: true,
    source: "manual",
    meeting_type: "partner_cadence",
    recurrence_pattern: "weekly",
    recurrence_end: null,
    series_id: "m-001",
    notes: "Standing agenda",
    airtable_record_id: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

// ── calculateNextDate ───────────────────────────────────────
describe("calculateNextDate", () => {
  // Freeze "today" to 2026-03-18 for deterministic tests
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("weekly: +7 days", () => {
    expect(calculateNextDate("2026-03-18", "weekly")).toBe("2026-03-25");
  });

  it("biweekly: +14 days", () => {
    expect(calculateNextDate("2026-03-18", "biweekly")).toBe("2026-04-01");
  });

  it("monthly: normal case", () => {
    expect(calculateNextDate("2026-03-15", "monthly")).toBe("2026-04-15");
  });

  it("monthly: Jan 31 → Feb 28 (month-end clamping)", () => {
    // Current date 2026-01-31, but need to advance past today (2026-03-18)
    // Jan 31 → Feb 28 → Mar 28 → result is Mar 28 (>= Mar 18)
    expect(calculateNextDate("2026-01-31", "monthly")).toBe("2026-03-28");
  });

  it("monthly: month-end single advance when already near today", () => {
    // Set today to 2026-02-15 so a single advance from Jan 31 lands in the future
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
    expect(calculateNextDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("quarterly: normal case", () => {
    expect(calculateNextDate("2026-01-15", "quarterly")).toBe("2026-04-15");
  });

  it("quarterly: Nov 30 → Feb 28 (year boundary + month-end)", () => {
    // Nov 30 → Feb 28 2027, but need to advance past today (2026-03-18)
    // Nov 30 2025 → Feb 28 2026 → but we need it past 2026-03-18
    // Actually: 2026-11-30 is in the future (> 2026-03-18), single advance
    vi.setSystemTime(new Date("2026-11-30T12:00:00Z"));
    expect(calculateNextDate("2026-11-30", "quarterly")).toBe("2027-02-28");
  });

  it("multiple missed: advances past today", () => {
    // currentDate is 2026-01-01 (weekly), today is 2026-03-18
    // Should advance 7 days at a time until >= 2026-03-18
    const result = calculateNextDate("2026-01-01", "weekly");
    expect(result >= "2026-03-18").toBe(true);
    // 2026-01-01 + 11 weeks = 2026-03-19 (Thursday)
    expect(result).toBe("2026-03-19");
  });

  it("weekly from a date already in the future doesn't over-advance", () => {
    expect(calculateNextDate("2026-03-25", "weekly")).toBe("2026-04-01");
  });
});

// ── getOverdueRecurringMeetings ─────────────────────────────
describe("getOverdueRecurringMeetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no candidates", async () => {
    mockOr.mockResolvedValueOnce({ data: [], error: null });
    const result = await getOverdueRecurringMeetings();
    expect(result).toEqual([]);
  });

  it("filters out meetings whose series has a future sibling", async () => {
    const overdue = makeMeeting({ id: "m-old", series_id: "m-series", meeting_date: "2026-03-10" });
    mockOr.mockResolvedValueOnce({ data: [overdue], error: null });
    // Future sibling exists
    mockGte.mockResolvedValueOnce({ data: [{ series_id: "m-series", meeting_date: "2026-03-20" }], error: null });

    const result = await getOverdueRecurringMeetings();
    expect(result).toEqual([]);
  });

  it("keeps meetings without future siblings", async () => {
    const overdue = makeMeeting({ id: "m-old", series_id: "m-series", meeting_date: "2026-03-10" });
    mockOr.mockResolvedValueOnce({ data: [overdue], error: null });
    mockGte.mockResolvedValueOnce({ data: [], error: null });

    const result = await getOverdueRecurringMeetings();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m-old");
  });

  it("throws on query error", async () => {
    mockOr.mockResolvedValueOnce({ data: null, error: { message: "DB down" } });
    await expect(getOverdueRecurringMeetings()).rejects.toThrow("Failed to query overdue recurring meetings");
  });
});

// ── spawnNextOccurrence ─────────────────────────────────────
describe("spawnNextOccurrence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null if no recurrence_pattern", async () => {
    const meeting = makeMeeting({ recurrence_pattern: null });
    expect(await spawnNextOccurrence(meeting)).toBeNull();
  });

  it("returns null if no series_id", async () => {
    const meeting = makeMeeting({ series_id: null });
    expect(await spawnNextOccurrence(meeting)).toBeNull();
  });

  it("returns null if next date exceeds recurrence_end", async () => {
    const meeting = makeMeeting({
      meeting_date: "2026-03-11",
      recurrence_pattern: "weekly",
      recurrence_end: "2026-03-15",
    });
    // Next date would be 2026-03-18, but recurrence_end is 2026-03-15
    // Actually: calculateNextDate("2026-03-11", "weekly") with today=2026-03-18
    // 2026-03-11 + 7 = 2026-03-18, which is >= today, so result = 2026-03-18
    // 2026-03-18 > 2026-03-15 → null
    expect(await spawnNextOccurrence(meeting)).toBeNull();
  });

  it("handles unique constraint conflict gracefully", async () => {
    const meeting = makeMeeting({ meeting_date: "2026-03-11" });

    // Mock insert to return unique violation
    mockFrom.mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "23505", message: "duplicate key" },
          }),
        })),
      })),
    });

    expect(await spawnNextOccurrence(meeting)).toBeNull();
  });

  it("spawns a new meeting with correct fields", async () => {
    const meeting = makeMeeting({ meeting_date: "2026-03-11" });
    const newMeeting = { ...meeting, id: "m-new", meeting_date: "2026-03-18" };

    // Mock insert → select → single
    mockFrom.mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: newMeeting, error: null }),
        })),
      })),
    });

    // Mock participant query
    mockFrom.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [{ participant_id: "part-1", role: "attendee" }],
          error: null,
        }),
      })),
    });

    // Mock participant insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await spawnNextOccurrence(meeting);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("m-new");
    expect(result!.meeting_date).toBe("2026-03-18");

    // Verify insert was called for meetings
    expect(mockFrom).toHaveBeenCalledWith("meetings");
    // Verify participants were copied
    expect(mockFrom).toHaveBeenCalledWith("meeting_participants");
  });
});
