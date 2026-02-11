import { describe, it, expect } from "vitest";
import { buildUserMessage, parseClassificationResponse } from "../claude";
import type { Message, Engagement, Event, Program } from "../types";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-001",
    engagement_id: null,
    sender_name: "Alice Chen",
    sender_email: "alice@cybershield.com",
    sent_at: "2025-02-03T15:30:00Z",
    subject: "Re: Security Review Next Steps",
    body_text: "Following up on the security review.",
    body_raw: "Following up on the security review.",
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarded_at: "2025-02-03T16:00:00Z",
    pending_review: false,
    classification_result: null,
    ...overrides,
  };
}

const ENGAGEMENT: Engagement = {
  id: "init-001",
  name: "CyberShield - Security Review",
  status: "active",
  summary: "Pursuing Security Competency.",
  current_state: null,
  open_items: [],
  partner_name: "CyberShield",
  tags: [],
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-02-01T00:00:00Z",
  closed_at: null,
};

const EVENT: Event = {
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

const PROGRAM: Program = {
  id: "prog-001",
  name: "AWS Security Competency",
  description: "Validates partner security expertise",
  eligibility: null,
  url: null,
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
};

describe("buildUserMessage", () => {
  it("includes engagement names, ids, and summaries", () => {
    const result = buildUserMessage([makeMessage()], [ENGAGEMENT], [], []);
    expect(result).toContain("CyberShield - Security Review");
    expect(result).toContain("init-001");
    expect(result).toContain("Pursuing Security Competency.");
    expect(result).toContain("Partner: CyberShield");
  });

  it("includes event details with dates", () => {
    const result = buildUserMessage([makeMessage()], [], [EVENT], []);
    expect(result).toContain("AWS re:Invent 2025");
    expect(result).toContain("evt-001");
    expect(result).toContain("2025-12-01");
    expect(result).toContain("2025-12-05");
    expect(result).toContain("conference");
  });

  it("includes program details", () => {
    const result = buildUserMessage([makeMessage()], [], [], [PROGRAM]);
    expect(result).toContain("AWS Security Competency");
    expect(result).toContain("prog-001");
    expect(result).toContain("Validates partner security expertise");
  });

  it("shows 'None yet' when state is empty", () => {
    const result = buildUserMessage([makeMessage()], [], [], []);
    expect(result).toContain("None yet.");
  });

  it("includes the email content to classify", () => {
    const msg = makeMessage({ subject: "Important Update", body_text: "The deal is closing." });
    const result = buildUserMessage([msg], [], [], []);
    expect(result).toContain("Important Update");
    expect(result).toContain("The deal is closing.");
    expect(result).toContain("alice@cybershield.com");
  });

  it("handles multiple messages with headers per message", () => {
    const msg1 = makeMessage({ id: "m1", sender_name: "Alice" });
    const msg2 = makeMessage({ id: "m2", sender_name: "Bob", sender_email: "bob@example.com" });
    const result = buildUserMessage([msg1, msg2], [], [], []);
    expect(result).toContain("Message from Alice");
    expect(result).toContain("Message from Bob");
  });
});

describe("parseClassificationResponse", () => {
  const validJson = JSON.stringify({
    content_type: "engagement_email",
    engagement_match: { id: "init-001", name: "Test", confidence: 0.95, is_new: false, partner_name: null },
    matched_events: [],
    matched_programs: [],
    entity_links: [],
    participants: [],
  });

  it("parses raw JSON", () => {
    const result = parseClassificationResponse(validJson);
    expect(result.content_type).toBe("engagement_email");
    expect(result.engagement_match.confidence).toBe(0.95);
  });

  it("strips ```json ... ``` wrapping", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const result = parseClassificationResponse(wrapped);
    expect(result.content_type).toBe("engagement_email");
  });

  it("strips bare ``` wrapping", () => {
    const wrapped = "```\n" + validJson + "\n```";
    const result = parseClassificationResponse(wrapped);
    expect(result.content_type).toBe("engagement_email");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseClassificationResponse("not json")).toThrow();
  });

  it("handles leading/trailing whitespace", () => {
    const padded = "\n  " + validJson + "  \n";
    const result = parseClassificationResponse(padded);
    expect(result.content_type).toBe("engagement_email");
  });
});
