import { describe, it, expect } from "vitest";
import { buildUserMessage, parseClassificationResponse, ClassifyContext } from "../claude";
import type { Message, Engagement, Event, Program, Partner, AwsRelationship } from "../types";

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
    forwarder_email: null,
    forwarder_name: null,
    forwarder_note: null,
    to_header: null,
    cc_header: null,
    ...overrides,
  };
}

const ENGAGEMENT: Engagement = {
  id: "init-001",
  name: "CyberShield - Security Review",
  status: "active",
  current_state: "Pursuing Security Competency.",
  open_items: [],
  partner_name: "CyberShield",
  partner_id: null,
  pillar: null,
  priority: null,
  tags: [],
  airtable_record_id: null,
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
  host: "AWS",
  location: "Las Vegas, NV",
  description: "Annual AWS conference",
  source: "seed",
  verified: true,
  airtable_record_id: null,
  created_at: "2025-01-01T00:00:00Z",
};

const PROGRAM: Program = {
  id: "prog-001",
  name: "AWS Security Competency",
  type: "Competency",
  description: "Validates partner security expertise",
  eligibility: null,
  url: null,
  status: "active",
  lifecycle_type: "indefinite",
  lifecycle_duration: null,
  airtable_record_id: null,
  created_at: "2025-01-01T00:00:00Z",
};

const PARTNER: Partner = {
  id: "partner-001",
  name: "CyberShield",
  segment: "security",
  focus_area: [],
  alliance_lead: "Steven Romero",
  alliance_lead_email: "sterme@amazon.com",
  psa: null,
  spms_id: null,
  partner_contact_emails: ["alice@cybershield.com"],
  aws_stickiness: null,
  key_aws_services: [],
  airtable_record_id: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const RELATIONSHIP: AwsRelationship = {
  id: "rel-001",
  name: "Security Team - ISV",
  aws_org: "AWS Security",
  aws_service: null,
  relationship_type: "Product Team",
  primary_contact_name: "Jane Doe",
  primary_contact_email: "janedoe@amazon.com",
  aws_contact_emails: ["janedoe@amazon.com"],
  notes: null,
  airtable_record_id: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

function makeContext(overrides: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    engagements: [],
    events: [],
    programs: [],
    partners: [],
    relationships: [],
    ...overrides,
  };
}

describe("buildUserMessage", () => {
  it("includes engagement names, ids, and current state", () => {
    const ctx = makeContext({ engagements: [ENGAGEMENT] });
    const result = buildUserMessage([makeMessage()], ctx);
    expect(result).toContain("CyberShield - Security Review");
    expect(result).toContain("init-001");
    expect(result).toContain("Current state: Pursuing Security Competency.");
    expect(result).toContain("Partner: CyberShield");
  });

  it("includes event details with dates", () => {
    const ctx = makeContext({ events: [EVENT] });
    const result = buildUserMessage([makeMessage()], ctx);
    expect(result).toContain("AWS re:Invent 2025");
    expect(result).toContain("evt-001");
    expect(result).toContain("2025-12-01");
    expect(result).toContain("2025-12-05");
    expect(result).toContain("conference");
  });

  it("includes program details", () => {
    const ctx = makeContext({ programs: [PROGRAM] });
    const result = buildUserMessage([makeMessage()], ctx);
    expect(result).toContain("AWS Security Competency");
    expect(result).toContain("prog-001");
    expect(result).toContain("Validates partner security expertise");
  });

  it("includes partner catalog with domains", () => {
    const ctx = makeContext({ partners: [PARTNER] });
    const result = buildUserMessage([makeMessage()], ctx);
    expect(result).toContain("CyberShield");
    expect(result).toContain("partner-001");
    expect(result).toContain("cybershield.com");
  });

  it("includes AWS relationships with contact info", () => {
    const ctx = makeContext({ relationships: [RELATIONSHIP] });
    const result = buildUserMessage([makeMessage()], ctx);
    expect(result).toContain("Security Team - ISV");
    expect(result).toContain("rel-001");
    expect(result).toContain("janedoe@amazon.com");
  });

  it("shows 'None yet' when state is empty", () => {
    const result = buildUserMessage([makeMessage()], makeContext());
    expect(result).toContain("None yet.");
  });

  it("includes the email content to classify", () => {
    const msg = makeMessage({ subject: "Important Update", body_text: "The deal is closing." });
    const result = buildUserMessage([msg], makeContext());
    expect(result).toContain("Important Update");
    expect(result).toContain("The deal is closing.");
    expect(result).toContain("alice@cybershield.com");
  });

  it("handles multiple messages with headers per message", () => {
    const msg1 = makeMessage({ id: "m1", sender_name: "Alice" });
    const msg2 = makeMessage({ id: "m2", sender_name: "Bob", sender_email: "bob@example.com" });
    const result = buildUserMessage([msg1, msg2], makeContext());
    expect(result).toContain("Message from Alice");
    expect(result).toContain("Message from Bob");
  });

  it("always includes forwarder identity from USER_CONFIG", () => {
    const result = buildUserMessage([makeMessage()], makeContext());
    expect(result).toContain("Steven Romero");
    expect(result).toContain("sterme@amazon.com");
    expect(result).toContain("Partner Development Manager");
  });

  it("includes forwarder note when provided", () => {
    const result = buildUserMessage([makeMessage()], makeContext(), "Please prioritize this one");
    expect(result).toContain("Forwarder Note:");
    expect(result).toContain("Please prioritize this one");
  });
});

describe("parseClassificationResponse", () => {
  const validJson = JSON.stringify({
    content_type: "engagement_email",
    engagement_match: { id: "init-001", name: "Test", confidence: 0.95, is_new: false, partner_name: null },
    matched_events: [],
    matched_programs: [],
    matched_relationships: [],
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

  it("defaults matched_relationships when omitted", () => {
    const json = JSON.stringify({
      content_type: "engagement_email",
      engagement_match: { id: "init-001", name: "Test", confidence: 0.95, is_new: false, partner_name: null },
      matched_events: [],
      matched_programs: [],
      participants: [],
    });
    const result = parseClassificationResponse(json);
    expect(result.matched_relationships).toEqual([]);
  });

  it("defaults resolved_open_items to empty array when omitted", () => {
    const json = JSON.stringify({
      content_type: "engagement_email",
      engagement_match: { id: "init-001", name: "Test", confidence: 0.95, is_new: false, partner_name: null },
      matched_events: [],
      matched_programs: [],
      participants: [],
    });
    const result = parseClassificationResponse(json);
    expect(result.resolved_open_items).toEqual([]);
  });

  it("preserves resolved_open_items when present", () => {
    const json = JSON.stringify({
      content_type: "engagement_email",
      engagement_match: { id: "init-001", name: "Test", confidence: 0.95, is_new: false, partner_name: null },
      matched_events: [],
      matched_programs: [],
      matched_relationships: [],
      participants: [],
      resolved_open_items: ["Send GTM doc"],
    });
    const result = parseClassificationResponse(json);
    expect(result.resolved_open_items).toEqual(["Send GTM doc"]);
  });
});
