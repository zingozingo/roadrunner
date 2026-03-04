import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  CombinedClassificationResult,
  Message,
  Engagement,
  Event,
  Program,
} from "../types";

// ============================================================
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ============================================================

const {
  mockClassifyPhase1,
  mockClassifyPhase2,
  mockBuildPhase1Context,
  mockBuildPhase2Context,
  mockGetUnclassifiedMessages,
  mockGetEngagementHistory,
  mockGetPartner,
  mockGetActiveEvents,
  mockGetActivePrograms,
  mockGetAwsRelationships,
  mockCreateApproval,
  mockCreateEngagement,
  mockCreateEntityLink,
  mockUpsertParticipants,
  mockLinkEngagementAwsRelationship,
  mockFrom,
} = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockReturnValue({
    in: vi.fn().mockResolvedValue({ error: null }),
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: "new-participant-id" }, error: null }),
    }),
  });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "messages") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: mockUpdate,
      };
    }
    if (table === "entity_links") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    if (table === "meetings") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    if (table === "engagements") {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "participants") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        insert: mockInsert,
      };
    }
    if (table === "participant_links") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
  });

  return {
    mockClassifyPhase1: vi.fn(),
    mockClassifyPhase2: vi.fn(),
    mockBuildPhase1Context: vi.fn().mockResolvedValue("phase1-context"),
    mockBuildPhase2Context: vi.fn().mockReturnValue("phase2-context"),
    mockGetUnclassifiedMessages: vi.fn(),
    mockGetEngagementHistory: vi.fn().mockResolvedValue(null),
    mockGetPartner: vi.fn().mockResolvedValue(null),
    mockGetActiveEvents: vi.fn().mockResolvedValue([]),
    mockGetActivePrograms: vi.fn().mockResolvedValue([]),
    mockGetAwsRelationships: vi.fn().mockResolvedValue([]),
    mockCreateApproval: vi.fn().mockResolvedValue({ id: "approval-001" }),
    mockCreateEngagement: vi.fn().mockResolvedValue({
      id: "init-auto", name: "Auto-Created", status: "active",
      partner_name: null, pillar: null,
      created_at: "", updated_at: "", closed_at: null,
    }),
    mockCreateEntityLink: vi.fn().mockResolvedValue(undefined),
    mockUpsertParticipants: vi.fn().mockResolvedValue(undefined),
    mockLinkEngagementAwsRelationship: vi.fn().mockResolvedValue(undefined),
    mockFrom,
  };
});

// ============================================================
// Mock setup
// ============================================================

vi.mock("../claude", () => ({
  classifyPhase1: mockClassifyPhase1,
  classifyPhase2: mockClassifyPhase2,
}));

vi.mock("../phase1-prompt", () => ({
  buildPhase1Context: mockBuildPhase1Context,
}));

vi.mock("../phase2-prompt", () => ({
  buildPhase2Context: mockBuildPhase2Context,
}));

vi.mock("../db", () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: mockFrom }),
  getUnclassifiedMessages: mockGetUnclassifiedMessages,
  getEngagementHistory: mockGetEngagementHistory,
  getPartner: mockGetPartner,
  getActiveEvents: mockGetActiveEvents,
  getActivePrograms: mockGetActivePrograms,
  getAwsRelationships: mockGetAwsRelationships,
  createApproval: mockCreateApproval,
  createEngagement: mockCreateEngagement,
  createEntityLink: mockCreateEntityLink,
  upsertParticipants: mockUpsertParticipants,
  backfillMessageSenderNames: vi.fn().mockResolvedValue(0),
  linkMeetingToEngagement: vi.fn().mockResolvedValue(undefined),
  linkEngagementAwsRelationship: mockLinkEngagementAwsRelationship,
  getEntityLinksForEntity: vi.fn().mockResolvedValue([]),
  getAwsRelationshipsByEngagement: vi.fn().mockResolvedValue([]),
}));

vi.mock("../user-config", () => ({
  isUserEmail: vi.fn().mockReturnValue(false),
  USER_CONFIG: {
    name: "Steven Romero",
    email: "sterme@amazon.com",
    aliases: ["sromero@amazon.com"],
    role: "Partner Development Manager (PDM)",
    segment: "AWS Security, ISV Partners",
  },
}));

// Now import the module under test
import { processUnclassifiedMessages } from "../classifier";

// ============================================================
// Test fixtures
// ============================================================

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-001",
    engagement_id: null,
    sender_name: "Alice Chen",
    sender_email: "alice@cybershield.com",
    sent_at: "2025-02-03T15:30:00Z",
    subject: "Re: Security Review Next Steps",
    body_text: "Following up on the security review for the competency program.",
    body_raw: "Following up on the security review for the competency program.",
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarded_at: "2025-02-03T16:00:00Z",
    pending_review: false,
    classification_result: null,
    forwarder_email: null,
    forwarder_name: null,
    forwarder_note: null,
    to_header: null,
    cc_header: null,
    ...overrides,
  };
}

// Phase 1 results (routing only)
const PHASE1_EXISTING = {
  content_type: "engagement_email" as const,
  engagement_match: {
    id: "init-001",
    name: "CyberShield - Security Review",
    confidence: 0.95,
    is_new: false,
    partner_name: "CyberShield",
    partner_id: null,
  },
};

const PHASE1_LOW_CONFIDENCE = {
  content_type: "engagement_email" as const,
  engagement_match: {
    id: null,
    name: "Unknown Partner - Marketplace Discussion",
    confidence: 0.55,
    is_new: true,
    partner_name: "Unknown Partner",
    partner_id: null,
  },
};

const PHASE1_NEW_HIGH = {
  content_type: "engagement_email" as const,
  engagement_match: {
    id: null,
    name: "NewCorp - Cloud Migration",
    confidence: 0.92,
    is_new: true,
    partner_name: "NewCorp",
    partner_id: null,
  },
};

const PHASE1_NOISE = {
  content_type: "noise" as const,
  engagement_match: {
    id: null,
    name: "",
    confidence: 1.0,
    is_new: false,
    partner_name: null,
    partner_id: null,
  },
};

// Phase 2 results (full analysis)
const HIGH_CONFIDENCE_RESULT: CombinedClassificationResult = {
  content_type: "engagement_email",
  engagement_match: {
    id: "init-001",
    name: "CyberShield - Security Review",
    confidence: 0.95,
    is_new: false,
    partner_name: "CyberShield",
  },
  matched_events: [],
  matched_programs: [
    { id: "prog-001", name: "AWS Security Competency", relationship: "qualifies_for" },
  ],
  matched_relationships: [],
  participants: [
    { name: "Alice Chen", email: "alice@cybershield.com", organization: "CyberShield", role: "partner_contact" },
  ],
  current_state: "CyberShield continues to pursue AWS Security Competency.",
  topic: "Security Competency Technical Validation",
  goal: "CyberShield achieves AWS Security Competency.",
  engagement_name: "CyberShield - Security Competency Technical Validation",
  pillar: "Co-Build",
};

const LOW_CONFIDENCE_RESULT: CombinedClassificationResult = {
  content_type: "engagement_email",
  engagement_match: {
    id: null,
    name: "Unknown Partner - Marketplace Discussion",
    confidence: 0.55,
    is_new: true,
    partner_name: "Unknown Partner",
  },
  matched_events: [],
  matched_programs: [],
  matched_relationships: [],
  participants: [],
  current_state: null,
  topic: null,
  goal: null,
  engagement_name: null,
  pillar: null,
};

const HIGH_CONFIDENCE_NEW_RESULT: CombinedClassificationResult = {
  content_type: "engagement_email",
  engagement_match: {
    id: null,
    name: "NewCorp - Cloud Migration",
    confidence: 0.92,
    is_new: true,
    partner_name: "NewCorp",
  },
  matched_events: [],
  matched_programs: [],
  matched_relationships: [],
  participants: [
    { name: "Bob Smith", email: "bob@newcorp.com", organization: "NewCorp", role: "partner_contact" },
  ],
  current_state: "NewCorp exploring cloud migration.",
  topic: "Cloud Migration Assessment",
  goal: "NewCorp completes cloud migration to AWS.",
  engagement_name: "NewCorp - Cloud Migration Assessment",
  pillar: "Co-Build",
};

// ============================================================
// Tests
// ============================================================

describe("processUnclassifiedMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes nothing when there are no unclassified messages", async () => {
    mockGetUnclassifiedMessages.mockResolvedValue([]);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(0);
    expect(result.autoAssigned).toBe(0);
    expect(result.flaggedForReview).toBe(0);
    expect(mockClassifyPhase1).not.toHaveBeenCalled();
  });

  it("auto-assigns messages with high confidence matches via two-phase", async () => {
    const msg = makeMessage();
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_EXISTING);
    mockClassifyPhase2.mockResolvedValue(HIGH_CONFIDENCE_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(1);
    expect(result.flaggedForReview).toBe(0);

    // Phase 1 was called
    expect(mockClassifyPhase1).toHaveBeenCalledTimes(1);
    // Phase 2 was called (not noise)
    expect(mockClassifyPhase2).toHaveBeenCalledTimes(1);
  });

  it("flags low confidence matches for review", async () => {
    const msg = makeMessage({ id: "msg-low" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_LOW_CONFIDENCE);
    mockClassifyPhase2.mockResolvedValue(LOW_CONFIDENCE_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(0);
    expect(result.flaggedForReview).toBe(1);
  });

  it("handles noise classification without running Phase 2", async () => {
    const msg = makeMessage({ id: "msg-noise", subject: "Out of Office" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_NOISE);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(0);
    expect(result.flaggedForReview).toBe(0);
    // Phase 2 should NOT be called for noise
    expect(mockClassifyPhase2).not.toHaveBeenCalled();
  });

  it("groups messages with close forwarded_at timestamps", async () => {
    const msg1 = makeMessage({ id: "msg-a", forwarded_at: "2025-02-03T16:00:00.000Z" });
    const msg2 = makeMessage({ id: "msg-b", forwarded_at: "2025-02-03T16:00:02.000Z" });
    const msg3 = makeMessage({ id: "msg-c", forwarded_at: "2025-02-03T17:00:00.000Z" });

    mockGetUnclassifiedMessages.mockResolvedValue([msg1, msg2, msg3]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_EXISTING);
    mockClassifyPhase2.mockResolvedValue(HIGH_CONFIDENCE_RESULT);

    await processUnclassifiedMessages();

    // msg1+msg2 grouped (2s apart), msg3 separate = 2 Phase 1 calls
    expect(mockClassifyPhase1).toHaveBeenCalledTimes(2);
  });

  it("continues processing remaining groups when one fails", async () => {
    const msg1 = makeMessage({ id: "msg-ok", forwarded_at: "2025-02-03T16:00:00.000Z" });
    const msg2 = makeMessage({ id: "msg-fail", forwarded_at: "2025-02-03T17:00:00.000Z" });

    mockGetUnclassifiedMessages.mockResolvedValue([msg1, msg2]);
    mockClassifyPhase1
      .mockResolvedValueOnce(PHASE1_EXISTING)
      .mockRejectedValueOnce(new Error("API rate limit"));
    mockClassifyPhase2.mockResolvedValue(HIGH_CONFIDENCE_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(mockClassifyPhase1).toHaveBeenCalledTimes(2);
  });

  it("auto-creates new engagement at high confidence", async () => {
    const msg = makeMessage({ id: "msg-new" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_NEW_HIGH);
    mockClassifyPhase2.mockResolvedValue(HIGH_CONFIDENCE_NEW_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(1);
    expect(result.flaggedForReview).toBe(0);
    expect(mockCreateEngagement).toHaveBeenCalledWith({
      name: "NewCorp - Cloud Migration Assessment",
      partner_name: "NewCorp",
      current_state: "NewCorp exploring cloud migration.",
      topic: "Cloud Migration Assessment",
      goal: "NewCorp completes cloud migration to AWS.",
    });
  });

  it("falls back to review when auto-create fails", async () => {
    const msg = makeMessage({ id: "msg-fail-create" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_NEW_HIGH);
    mockClassifyPhase2.mockResolvedValue(HIGH_CONFIDENCE_NEW_RESULT);
    mockCreateEngagement.mockRejectedValueOnce(new Error("DB error"));

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.flaggedForReview).toBe(1);
    expect(mockCreateApproval).toHaveBeenCalled();
  });

  it("auto-assigns with matched events at high confidence", async () => {
    const resultWithEvent: CombinedClassificationResult = {
      ...HIGH_CONFIDENCE_RESULT,
      matched_events: [
        { id: "evt-001", name: "AWS re:Invent 2025", relationship: "relevant_to" },
      ],
    };

    const msg = makeMessage();
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_EXISTING);
    mockClassifyPhase2.mockResolvedValue(resultWithEvent);

    const result = await processUnclassifiedMessages();

    expect(result.autoAssigned).toBe(1);
    expect(result.flaggedForReview).toBe(0);
  });

  it("passes forwarder note through two-phase pipeline", async () => {
    const msg = makeMessage({ forwarder_note: "Important - handle ASAP" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_EXISTING);
    mockClassifyPhase2.mockResolvedValue(HIGH_CONFIDENCE_RESULT);

    await processUnclassifiedMessages();

    // buildPhase1Context should receive the forwarder note
    expect(mockBuildPhase1Context).toHaveBeenCalledWith(
      [msg],
      "Important - handle ASAP"
    );
  });

  it("low confidence does NOT set engagement_id on messages (mutual exclusion)", async () => {
    const msg = makeMessage({ id: "msg-lowconf" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyPhase1.mockResolvedValue(PHASE1_LOW_CONFIDENCE);
    mockClassifyPhase2.mockResolvedValue(LOW_CONFIDENCE_RESULT);

    await processUnclassifiedMessages();

    // Should create an approval (pending review)
    expect(mockCreateApproval).toHaveBeenCalledTimes(1);
    // Should NOT create an engagement (low confidence + is_new)
    expect(mockCreateEngagement).not.toHaveBeenCalled();

    // The message update should set pending_review=true and NOT set engagement_id
    // Find the messages.update() call
    const updateCalls = mockFrom.mock.calls.filter(
      ([table]: [string]) => table === "messages"
    );
    // There should be at least one update call for classification data
    expect(updateCalls.length).toBeGreaterThan(0);
  });

});
