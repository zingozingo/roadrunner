import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClassificationResult, Message, Engagement, Event, Program } from "../types";

// ============================================================
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ============================================================

const {
  mockClassifyMessage,
  mockGetActiveEngagements,
  mockGetActiveEvents,
  mockGetActivePrograms,
  mockGetUnclassifiedMessages,
  mockCreateApproval,
  mockCreateEngagement,
  mockCreateEntityLink,
  mockSendClassificationPrompt,
  mockUpsertParticipants,
  mockAppendOpenItems,
  mockFrom,
} = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockReturnValue({
    in: vi.fn().mockResolvedValue({ error: null }),
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
    mockClassifyMessage: vi.fn(),
    mockGetActiveEngagements: vi.fn(),
    mockGetActiveEvents: vi.fn(),
    mockGetActivePrograms: vi.fn(),
    mockGetUnclassifiedMessages: vi.fn(),
    mockCreateApproval: vi.fn().mockResolvedValue({ id: "approval-001" }),
    mockCreateEngagement: vi.fn().mockResolvedValue({ id: "init-auto", name: "Auto-Created", status: "active", summary: null, partner_name: null, tags: [], created_at: "", updated_at: "", closed_at: null }),
    mockCreateEntityLink: vi.fn().mockResolvedValue(undefined),
    mockSendClassificationPrompt: vi.fn().mockResolvedValue({
      sid: "SM123",
      options: [{ number: 1, label: "Test", engagement_id: null, is_new: true }],
    }),
    mockUpsertParticipants: vi.fn().mockResolvedValue(undefined),
    mockAppendOpenItems: vi.fn().mockResolvedValue(null),
    mockFrom,
  };
});

// ============================================================
// Mock setup
// ============================================================

vi.mock("../claude", () => ({
  classifyMessage: mockClassifyMessage,
}));

vi.mock("../supabase", () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: mockFrom }),
  getActiveEngagements: mockGetActiveEngagements,
  getActiveEvents: mockGetActiveEvents,
  getActivePrograms: mockGetActivePrograms,
  getUnclassifiedMessages: mockGetUnclassifiedMessages,
  createApproval: mockCreateApproval,
  createEngagement: mockCreateEngagement,
  createEntityLink: mockCreateEntityLink,
  upsertParticipants: mockUpsertParticipants,
  appendOpenItems: mockAppendOpenItems,
}));

vi.mock("../sms", () => ({
  sendClassificationPrompt: mockSendClassificationPrompt,
}));

// Now import the module under test
import { processUnclassifiedMessages } from "../classifier";

// ============================================================
// Test fixtures
// ============================================================

const ENGAGEMENT_FALCON: Engagement = {
  id: "init-001",
  name: "CyberShield - Security Review",
  status: "active",
  summary: "CyberShield is pursuing AWS Security Competency.",
  current_state: null,
  open_items: [],
  partner_name: "CyberShield",
  tags: [],
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-02-01T00:00:00Z",
  closed_at: null,
};

const EVENT_REINVENT: Event = {
  id: "evt-001",
  name: "AWS re:Invent 2025",
  type: "conference",
  start_date: "2025-12-01",
  end_date: "2025-12-05",
  date_precision: "exact",
  location: "Las Vegas, NV",
  description: "Annual AWS conference",
  source: "seed",
  verified: true,
  created_at: "2025-01-01T00:00:00Z",
};

const PROGRAM_COMPETENCY: Program = {
  id: "prog-001",
  name: "AWS Security Competency",
  description: "Validates partner security expertise",
  eligibility: "Must pass technical review",
  url: null,
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
};

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
    ...overrides,
  };
}

const HIGH_CONFIDENCE_RESULT: ClassificationResult = {
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
    { id: "prog-001", name: "AWS Security Competency" },
  ],
  entity_links: [
    {
      source_type: "engagement",
      source_name: "CyberShield - Security Review",
      target_type: "program",
      target_name: "AWS Security Competency",
      relationship: "qualifies_for",
      context: "CyberShield is working toward Security Competency certification",
    },
  ],
  participants: [
    { name: "Alice Chen", email: "alice@cybershield.com", organization: "CyberShield", role: "Technical Lead" },
  ],
  current_state: "CyberShield continues to pursue AWS Security Competency.",
  open_items: [],
  suggested_tags: [],
};

const LOW_CONFIDENCE_RESULT: ClassificationResult = {
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
  entity_links: [],
  participants: [],
  current_state: null,
  open_items: [],
  suggested_tags: [],
};

const HIGH_CONFIDENCE_NEW_RESULT: ClassificationResult = {
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
  entity_links: [],
  participants: [
    { name: "Bob Smith", email: "bob@newcorp.com", organization: "NewCorp", role: "CTO" },
  ],
  current_state: "NewCorp exploring cloud migration.",
  open_items: [],
  suggested_tags: [],
};

const NOISE_RESULT: ClassificationResult = {
  content_type: "noise",
  engagement_match: {
    id: null,
    name: "",
    confidence: 1.0,
    is_new: false,
    partner_name: null,
  },
  matched_events: [],
  matched_programs: [],
  entity_links: [],
  participants: [],
  current_state: null,
  open_items: [],
  suggested_tags: [],
};

// ============================================================
// Tests
// ============================================================

describe("processUnclassifiedMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveEngagements.mockResolvedValue([ENGAGEMENT_FALCON]);
    mockGetActiveEvents.mockResolvedValue([EVENT_REINVENT]);
    mockGetActivePrograms.mockResolvedValue([PROGRAM_COMPETENCY]);
  });

  it("processes nothing when there are no unclassified messages", async () => {
    mockGetUnclassifiedMessages.mockResolvedValue([]);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(0);
    expect(result.autoAssigned).toBe(0);
    expect(result.flaggedForReview).toBe(0);
    expect(mockClassifyMessage).not.toHaveBeenCalled();
  });

  it("auto-assigns messages with high confidence matches", async () => {
    const msg = makeMessage();
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyMessage.mockResolvedValue(HIGH_CONFIDENCE_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(1);
    expect(result.flaggedForReview).toBe(0);

    // Verify classifyMessage was called with the message and full context
    expect(mockClassifyMessage).toHaveBeenCalledWith(
      [msg],
      {
        engagements: [ENGAGEMENT_FALCON],
        events: [EVENT_REINVENT],
        programs: [PROGRAM_COMPETENCY],
      }
    );
  });

  it("flags low confidence matches for review", async () => {
    const msg = makeMessage({ id: "msg-low" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyMessage.mockResolvedValue(LOW_CONFIDENCE_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(0);
    expect(result.flaggedForReview).toBe(1);
  });

  it("handles noise classification without assigning or flagging", async () => {
    const msg = makeMessage({ id: "msg-noise", subject: "Out of Office" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyMessage.mockResolvedValue(NOISE_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(0);
    expect(result.flaggedForReview).toBe(0);
  });

  it("groups messages with close forwarded_at timestamps", async () => {
    const msg1 = makeMessage({ id: "msg-a", forwarded_at: "2025-02-03T16:00:00.000Z" });
    const msg2 = makeMessage({ id: "msg-b", forwarded_at: "2025-02-03T16:00:02.000Z" });
    const msg3 = makeMessage({ id: "msg-c", forwarded_at: "2025-02-03T17:00:00.000Z" });

    mockGetUnclassifiedMessages.mockResolvedValue([msg1, msg2, msg3]);
    mockClassifyMessage.mockResolvedValue(HIGH_CONFIDENCE_RESULT);

    await processUnclassifiedMessages();

    // msg1+msg2 grouped (2s apart), msg3 separate = 2 calls
    expect(mockClassifyMessage).toHaveBeenCalledTimes(2);

    const firstCallMessages = mockClassifyMessage.mock.calls[0][0];
    expect(firstCallMessages).toHaveLength(2);
    expect(firstCallMessages[0].id).toBe("msg-a");
    expect(firstCallMessages[1].id).toBe("msg-b");

    const secondCallMessages = mockClassifyMessage.mock.calls[1][0];
    expect(secondCallMessages).toHaveLength(1);
    expect(secondCallMessages[0].id).toBe("msg-c");
  });

  it("continues processing remaining groups when one fails", async () => {
    const msg1 = makeMessage({ id: "msg-ok", forwarded_at: "2025-02-03T16:00:00.000Z" });
    const msg2 = makeMessage({ id: "msg-fail", forwarded_at: "2025-02-03T17:00:00.000Z" });

    mockGetUnclassifiedMessages.mockResolvedValue([msg1, msg2]);
    mockClassifyMessage
      .mockResolvedValueOnce(HIGH_CONFIDENCE_RESULT)
      .mockRejectedValueOnce(new Error("API rate limit"));

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(mockClassifyMessage).toHaveBeenCalledTimes(2);
  });

  it("auto-creates new engagement at high confidence", async () => {
    const msg = makeMessage({ id: "msg-new" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyMessage.mockResolvedValue(HIGH_CONFIDENCE_NEW_RESULT);

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.autoAssigned).toBe(1);
    expect(result.flaggedForReview).toBe(0);
    expect(mockCreateEngagement).toHaveBeenCalledWith({
      name: "NewCorp - Cloud Migration",
      partner_name: "NewCorp",
      summary: "NewCorp exploring cloud migration.",
      current_state: "NewCorp exploring cloud migration.",
      open_items: [],
      tags: [],
    });
  });

  it("falls back to review when auto-create fails", async () => {
    const msg = makeMessage({ id: "msg-fail-create" });
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyMessage.mockResolvedValue(HIGH_CONFIDENCE_NEW_RESULT);
    mockCreateEngagement.mockRejectedValueOnce(new Error("DB error"));

    const result = await processUnclassifiedMessages();

    expect(result.processed).toBe(1);
    expect(result.flaggedForReview).toBe(1);
    expect(mockCreateApproval).toHaveBeenCalled();
  });

  it("auto-assigns with matched events at high confidence", async () => {
    const resultWithEvent: ClassificationResult = {
      ...HIGH_CONFIDENCE_RESULT,
      matched_events: [
        { id: "evt-001", name: "AWS re:Invent 2025" },
      ],
    };

    const msg = makeMessage();
    mockGetUnclassifiedMessages.mockResolvedValue([msg]);
    mockClassifyMessage.mockResolvedValue(resultWithEvent);

    const result = await processUnclassifiedMessages();

    expect(result.autoAssigned).toBe(1);
    expect(result.flaggedForReview).toBe(0);
  });
});
