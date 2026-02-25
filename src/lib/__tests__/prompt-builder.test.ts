import { describe, it, expect } from "vitest";
import {
  buildForwarderSection,
  buildEngagementsSection,
  buildEventsSection,
  buildProgramsSection,
  buildPartnersSection,
  buildRelationshipsSection,
  buildEmailSection,
} from "../prompt-builder";
import type { Engagement, Event, Program, Partner, AwsRelationship, Message } from "../types";

const ENGAGEMENT: Engagement = {
  id: "eng-001",
  name: "CyberShield - Security Review",
  status: "active",
  current_state: "Pursuing Security Competency.",
  topic: null,
  goal: null,
  engagement_type: null,
  partner_name: "CyberShield",
  partner_id: null,
  pillar: "Co-Build",
  tags: ["security", "competency"],
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
  geo: null,
  created_at: "2025-01-01T00:00:00Z",
};

const PROGRAM: Program = {
  id: "prog-001",
  name: "AWS Security Competency",
  type: "Competency",
  description: "Validates partner security expertise",
  eligibility: "Must pass technical review",
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
  partner_contact_emails: ["alice@cybershield.com", "bob@cybershield.com"],
  aws_stickiness: null,
  key_aws_services: [],
  what_they_do: null,
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

describe("buildEngagementsSection", () => {
  it("renders engagement with partner, pillar, and tags", () => {
    const result = buildEngagementsSection([ENGAGEMENT]);
    expect(result).toContain("CyberShield - Security Review");
    expect(result).toContain("eng-001");
    expect(result).toContain("Partner: CyberShield");
    expect(result).toContain("Pillar: Co-Build");
    expect(result).toContain("Tags: security, competency");
    expect(result).toContain("Current state: Pursuing Security Competency.");
  });

  it("shows 'None yet' for empty list", () => {
    const result = buildEngagementsSection([]);
    expect(result).toContain("None yet.");
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
  it("renders program with eligibility", () => {
    const result = buildProgramsSection([PROGRAM]);
    expect(result).toContain("AWS Security Competency");
    expect(result).toContain("prog-001");
    expect(result).toContain("Validates partner security expertise");
    expect(result).toContain("Eligibility: Must pass technical review");
  });

  it("shows 'None yet' for empty list", () => {
    expect(buildProgramsSection([])).toContain("None yet.");
  });
});

describe("buildPartnersSection", () => {
  it("renders partner with domains extracted from contact emails", () => {
    const result = buildPartnersSection([PARTNER]);
    expect(result).toContain("CyberShield");
    expect(result).toContain("partner-001");
    expect(result).toContain("cybershield.com");
    expect(result).toContain("Lead: Steven Romero");
  });

  it("deduplicates domains", () => {
    const result = buildPartnersSection([PARTNER]);
    // Two emails with same domain should produce one domain entry
    const matches = result.match(/cybershield\.com/g);
    expect(matches?.length).toBe(1);
  });

  it("shows 'None yet' for empty list", () => {
    expect(buildPartnersSection([])).toContain("None yet.");
  });
});

describe("buildRelationshipsSection", () => {
  it("renders relationship with contact info", () => {
    const result = buildRelationshipsSection([RELATIONSHIP]);
    expect(result).toContain("Security Team - ISV");
    expect(result).toContain("rel-001");
    expect(result).toContain("Product Team");
    expect(result).toContain("Jane Doe");
    expect(result).toContain("janedoe@amazon.com");
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
