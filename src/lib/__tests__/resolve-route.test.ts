import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CombinedClassificationResult } from "../types";

// ============================================================
// Hoisted mocks
// ============================================================

const {
  mockResolveApproval,
  mockCreateEngagement,
  mockLinkMeetingToEngagement,
  mockPersistClassificationResult,
  mockRunPhase2ForResolve,
  mockFrom,
} = vi.hoisted(() => {
  const mockResolveApproval = vi.fn().mockResolvedValue(undefined);
  const mockCreateEngagement = vi.fn().mockResolvedValue({
    id: "eng-new",
    name: "NewCo - Security Review",
    partner_name: "NewCo",
    partner_id: null,
    pillar: null,
    status: "active",
  });
  const mockLinkMeetingToEngagement = vi.fn().mockResolvedValue(undefined);
  const mockPersistClassificationResult = vi.fn().mockResolvedValue(undefined);
  const mockRunPhase2ForResolve = vi.fn();

  // Chainable Supabase mock
  const mockFrom = vi.fn();

  return {
    mockResolveApproval,
    mockCreateEngagement,
    mockLinkMeetingToEngagement,
    mockPersistClassificationResult,
    mockRunPhase2ForResolve,
    mockFrom,
  };
});

vi.mock("@/lib/db", () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: mockFrom }),
  resolveApproval: mockResolveApproval,
  createEngagement: mockCreateEngagement,
  linkMeetingToEngagement: mockLinkMeetingToEngagement,
}));

vi.mock("@/lib/classifier", () => ({
  persistClassificationResult: mockPersistClassificationResult,
  runPhase2ForResolve: mockRunPhase2ForResolve,
}));

vi.mock("@/lib/sync", () => ({
  pushEngagementToAirtable: vi.fn().mockResolvedValue({ action: "updated" }),
}));

// Import after mocks
import { POST } from "@/app/api/reviews/resolve/route";

// ============================================================
// Helpers
// ============================================================

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/reviews/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeClassResult(
  overrides: Partial<CombinedClassificationResult> = {}
): CombinedClassificationResult {
  return {
    content_type: "engagement_email",
    engagement_match: {
      id: "eng-123",
      name: "Acme - Cloud Migration",
      confidence: 0.7,
      is_new: false,
      partner_name: "Acme",
      partner_id: "partner-1",
    },
    current_state: "Scheduling follow-up",
    matched_events: [],
    matched_programs: [],
    matched_relationships: [],
    participants: [],
    topic: "Cloud Migration",
    goal: "Complete migration by Q2",
    engagement_name: "Acme - Cloud Migration",
    pillar: null,
    ...overrides,
  };
}

const APPROVAL_BASE = {
  id: "review-1",
  type: "engagement_assignment" as const,
  message_id: "msg-1",
  engagement_id: null,
  resolved: false,
  resolved_at: null,
  resolution: null,
  created_at: "2026-01-01T00:00:00Z",
};

const EXISTING_ENGAGEMENT = {
  id: "eng-123",
  name: "Acme - Cloud Migration",
  partner_name: "Acme",
  partner_id: "partner-1",
  pillar: null,
  status: "active",
};

// ============================================================
// Setup
// ============================================================

function setupMocks(
  approval: Record<string, unknown>,
  message: Record<string, unknown> | null,
  engagement?: Record<string, unknown>
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "approval_queue") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: approval, error: null }),
          }),
        }),
      };
    }
    if (table === "messages") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: message ? [message] : [],
            error: null,
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "engagements") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: engagement ?? EXISTING_ENGAGEMENT,
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRunPhase2ForResolve.mockImplementation(
    (_msgs: unknown, _p1: unknown) => Promise.resolve(makeClassResult())
  );
});

// ============================================================
// Tests: meeting linking on resolve
// ============================================================

describe("resolve route — meeting linking", () => {
  it("confirm: links meeting invite to engagement", async () => {
    const classResult = makeClassResult({ content_type: "meeting_invite" });
    const approval = { ...APPROVAL_BASE, classification_result: classResult };
    const message = { id: "msg-1", content_type: "meeting_invite", forwarder_note: null };

    setupMocks(approval, message);
    mockRunPhase2ForResolve.mockResolvedValue(classResult);

    const req = makeRequest({ review_id: "review-1", action: "confirm" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.status).toBe("confirmed");
    expect(mockLinkMeetingToEngagement).toHaveBeenCalledTimes(1);
    expect(mockLinkMeetingToEngagement).toHaveBeenCalledWith("msg-1", "eng-123");
  });

  it("assign_existing: links meeting invite to new engagement", async () => {
    const classResult = makeClassResult({ content_type: "meeting_invite" });
    const approval = { ...APPROVAL_BASE, classification_result: classResult };
    const message = { id: "msg-1", content_type: "meeting_invite", forwarder_note: null };
    const targetEngagement = {
      id: "eng-456",
      name: "NewCo - Security Review",
      partner_name: "NewCo",
      partner_id: "partner-2",
      pillar: null,
      status: "active",
    };

    setupMocks(approval, message, targetEngagement);
    mockRunPhase2ForResolve.mockResolvedValue(classResult);

    const req = makeRequest({
      review_id: "review-1",
      action: "assign_existing",
      engagement_id: "eng-456",
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.status).toBe("assigned");
    expect(mockLinkMeetingToEngagement).toHaveBeenCalledTimes(1);
    expect(mockLinkMeetingToEngagement).toHaveBeenCalledWith("msg-1", "eng-456");
  });

  it("confirm: links meetings even when content_type is engagement_email", async () => {
    const classResult = makeClassResult({ content_type: "engagement_email" });
    const approval = { ...APPROVAL_BASE, classification_result: classResult };
    const message = { id: "msg-1", content_type: "engagement_email", forwarder_note: null };

    setupMocks(approval, message);
    mockRunPhase2ForResolve.mockResolvedValue(classResult);

    const req = makeRequest({ review_id: "review-1", action: "confirm" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.status).toBe("confirmed");
    expect(mockLinkMeetingToEngagement).toHaveBeenCalledTimes(1);
    expect(mockLinkMeetingToEngagement).toHaveBeenCalledWith("msg-1", "eng-123");
  });

  it("discard: does NOT link meeting invite", async () => {
    const classResult = makeClassResult({ content_type: "meeting_invite" });
    const approval = { ...APPROVAL_BASE, classification_result: classResult };
    const message = { id: "msg-1", content_type: "meeting_invite", forwarder_note: null };

    setupMocks(approval, message);

    const req = makeRequest({ review_id: "review-1", action: "discard" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.status).toBe("discarded");
    expect(mockLinkMeetingToEngagement).not.toHaveBeenCalled();
  });
});
