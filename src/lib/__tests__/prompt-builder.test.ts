import { describe, it, expect } from "vitest";
import {
  buildForwarderSection,
  buildEventsSection,
  buildProgramsSection,
  buildRelationshipsSection,
  buildEmailSection,
} from "../prompt-builder";
import type { Event, Program, Relationship, Message } from "../types";

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
  sponsor_option: false,
  partner_day: false,
  partner_day_date: null,
  airtable_record_id: null,
  geo: null,
  created_at: "2025-01-01T00:00:00Z",
};

const PROGRAM: Program = {
  id: "prog-001",
  name: "AWS Security Competency",
  type: "Competency",
  description: "Validates partner security expertise",
  requirements: "Must pass technical review",
  what_it_unlocks: null,
  notes: null,
  lifecycle_type: "indefinite",
  lifecycle_duration: null,
  airtable_record_id: null,
  created_at: "2025-01-01T00:00:00Z",
};

const RELATIONSHIP: Relationship = {
  id: "rel-001",
  name: "Security Team - ISV",
  org: "AWS Security",
  service: null,
  org_type: "internal",
  relationship_type: "Product Team",
  notes: null,
  airtable_record_id: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-001",
    engagement_id: null,
    sender_name: "Alice Chen",
    sender_email: "alice@cybershield.com",
    sent_at: "2025-02-03T15:30:00Z",
    subject: "Re: Security Review",
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

describe("buildForwarderSection", () => {
  it("includes USER_CONFIG identity", () => {
    const result = buildForwarderSection();
    expect(result).toContain("Steven Romero");
    expect(result).toContain("sterme@amazon.com");
    expect(result).toContain("Partner Development Manager");
  });

  it("includes forwarder note when provided", () => {
    const result = buildForwarderSection("Please prioritize this");
    expect(result).toContain("Forwarder Note:");
    expect(result).toContain("Please prioritize this");
  });

  it("omits forwarder note when null", () => {
    const result = buildForwarderSection(null);
    expect(result).not.toContain("Forwarder Note:");
  });
});

describe("buildEventsSection", () => {
  it("renders event with dates and host", () => {
    const result = buildEventsSection([EVENT]);
    expect(result).toContain("AWS re:Invent 2025");
    expect(result).toContain("evt-001");
    expect(result).toContain("2025-12-01 to 2025-12-05");
    expect(result).toContain("host: AWS");
  });

  it("shows 'None yet' for empty list", () => {
    expect(buildEventsSection([])).toContain("None yet.");
  });
});

describe("buildProgramsSection", () => {
  it("renders Competency program in compact tier", () => {
    const result = buildProgramsSection([PROGRAM]);
    expect(result).toContain("AWS Security Competency");
    expect(result).toContain("prog-001");
    expect(result).toContain("Competencies");
    // Competencies render in compact tier — no individual description/requirements
    expect(result).not.toContain("Validates partner security expertise");
  });

  it("shows 'None yet' for empty list", () => {
    expect(buildProgramsSection([])).toContain("None yet.");
  });
});

describe("buildRelationshipsSection", () => {
  it("renders relationship with contacts from registry", () => {
    const contactsMap = new Map([
      ["rel-001", [
        { name: "Jane Doe", email: "janedoe@amazon.com", role: "Lead Contact" },
      ]],
    ]);
    const result = buildRelationshipsSection([RELATIONSHIP], contactsMap);
    expect(result).toContain("Security Team - ISV");
    expect(result).toContain("rel-001");
    expect(result).toContain("Product Team");
    expect(result).toContain("Jane Doe");
    expect(result).toContain("janedoe@amazon.com");
    expect(result).toContain("Lead Contact");
  });

  it("shows 'None yet' for empty list", () => {
    expect(buildRelationshipsSection([])).toContain("None yet.");
  });
});

describe("buildEmailSection", () => {
  it("renders email headers and body", () => {
    const result = buildEmailSection([makeMessage()]);
    expect(result).toContain("alice@cybershield.com");
    expect(result).toContain("Re: Security Review");
    expect(result).toContain("Following up on the security review.");
  });

  it("renders multiple messages with per-message headers", () => {
    const msg1 = makeMessage({ sender_name: "Alice" });
    const msg2 = makeMessage({ sender_name: "Bob", sender_email: "bob@example.com" });
    const result = buildEmailSection([msg1, msg2]);
    expect(result).toContain("Message from Alice");
    expect(result).toContain("Message from Bob");
  });
});
