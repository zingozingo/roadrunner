import { describe, it, expect } from "vitest";
import type {
  Message,
  Engagement,
  Meeting,
  Participant,
  Event,
  Program,
  AwsRelationship,
  Partner,
  Phase1Result,
} from "../types";
import {
  buildPhase2Context,
  parsePhase2Response,
  PHASE2_SYSTEM_PROMPT,
} from "../phase2-prompt";

// ============================================================
// Fixtures
// ============================================================

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-001",
    engagement_id: null,
    sender_name: "Alice Chen",
    sender_email: "alice@cybershield.com",
    sent_at: "2026-02-20T15:30:00Z",
    subject: "Re: Security Review Next Steps",
    body_text: "Following up on the security review.",
    body_raw: "Following up on the security review.",
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarded_at: "2026-02-20T16:00:00Z",
    pending_review: false,
    classification_result: null,
    forwarder_email: null,
    forwarder_name: null,
    forwarder_note: null,
    to_header: "sterme@amazon.com",
    cc_header: null,
    ...overrides,
  };
}

const ENGAGEMENT: Engagement = {
  id: "eng-001",
  name: "CyberShield - Security Review",
  status: "active",
  current_state: "CyberShield is pursuing AWS Security Competency. Alice submitted the initial application last week. Steven connected them with the security team for technical review.",
  open_items: [
    { description: "Submit architecture diagram", assignee: "Alice", due_date: "2026-03-01", resolved: false },
    { description: "Schedule security team call", assignee: "Steven", due_date: null, resolved: true },
  ],
  partner_name: "CyberShield",
  partner_id: "partner-001",
  pillar: "Co-Build",
  priority: null,
  tags: ["security", "competency"],
  airtable_record_id: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-02-18T00:00:00Z",
  closed_at: null,
};

const HISTORY_MSG_1: Message = makeMessage({
  id: "hist-001",
  engagement_id: "eng-001",
  sender_name: "Steven Romero",
  sender_email: "sterme@amazon.com",
  sent_at: "2026-01-20T10:00:00Z",
  subject: "CyberShield Security Review",
  body_text: "Hi Alice, let's kick off the security review process.",
  to_header: "alice@cybershield.com",
});

const HISTORY_MSG_2: Message = makeMessage({
  id: "hist-002",
  engagement_id: "eng-001",
  sender_name: "Alice Chen",
  sender_email: "alice@cybershield.com",
  sent_at: "2026-02-10T14:00:00Z",
  subject: "Re: CyberShield Security Review",
  body_text: "Thanks Steven, we submitted the initial application.",
  to_header: "sterme@amazon.com",
});

const NEW_MSG: Message = makeMessage({
  id: "new-001",
  sender_name: "Alice Chen",
  sender_email: "alice@cybershield.com",
  sent_at: "2026-02-22T09:00:00Z",
  subject: "Re: Security Review - Architecture Diagram",
  body_text: "Hi Steven, attached is the architecture diagram. Can you forward to the security team?",
  to_header: "sterme@amazon.com",
  cc_header: "bob@cybershield.com",
});

const MEETING: Meeting = {
  id: "mtg-001",
  title: "CyberShield Security Review Call",
  engagement_id: "eng-001",
  event_id: null,
  program_id: null,
  partner_name: "CyberShield",
  partner_id: "partner-001",
  message_id: null,
  meeting_type: "review",
  status: "Confirmed",
  meeting_date: "2026-03-05",
  start_time: "10:00",
  end_time: "11:00",
  location: "Chime",
  organizer_email: "sterme@amazon.com",
  attendees: [
    { name: "Steven Romero", email: "sterme@amazon.com" },
    { name: "Alice Chen", email: "alice@cybershield.com" },
    { name: "Jane Doe", email: "janedoe@amazon.com" },
  ],
  ics_uid: null,
  source: "manual",
  notes: null,
  airtable_record_id: null,
  created_at: "2026-02-15T00:00:00Z",
  updated_at: "2026-02-15T00:00:00Z",
};

const PARTICIPANT: Participant & { role: string | null } = {
  id: "part-001",
  email: "alice@cybershield.com",
  name: "Alice Chen",
  organization: "CyberShield",
  title: "CTO",
  notes: null,
  created_at: "2026-01-20T00:00:00Z",
  role: "partner_contact",
};

const PARTNER: Partner = {
  id: "partner-001",
  name: "CyberShield",
  segment: "security",
  focus_area: ["endpoint"],
  alliance_lead: "Steven Romero",
  alliance_lead_email: "sterme@amazon.com",
  psa: null,
  spms_id: null,
  partner_contact_emails: ["alice@cybershield.com"],
  aws_stickiness: null,
  key_aws_services: [],
  what_they_do: "Cloud-native endpoint security platform",
  airtable_record_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const EVENT: Event = {
  id: "evt-001",
  name: "re:Inforce 2026",
  type: "conference",
  start_date: "2026-06-16",
  end_date: "2026-06-18",
  host: "AWS",
  location: "Philadelphia",
  description: "AWS security conference",
  source: "seed",
  verified: true,
  airtable_record_id: null,
  geo: null,
  created_at: "2026-01-01T00:00:00Z",
};

const PROGRAM: Program = {
  id: "prog-001",
  name: "Security Competency",
  type: "Competency",
  description: "AWS Security Partner validation",
  eligibility: null,
  url: null,
  status: "active",
  lifecycle_type: "indefinite",
  lifecycle_duration: null,
  airtable_record_id: null,
  created_at: "2026-01-01T00:00:00Z",
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PHASE1_EXISTING: Phase1Result = {
  content_type: "engagement_email",
  engagement_match: {
    id: "eng-001",
    name: "CyberShield - Security Review",
    confidence: 0.95,
    is_new: false,
    partner_name: "CyberShield",
    partner_id: "partner-001",
  },
};

const PHASE1_NEW: Phase1Result = {
  content_type: "engagement_email",
  engagement_match: {
    id: null,
    name: "NewCorp - Cloud Migration",
    confidence: 0.88,
    is_new: true,
    partner_name: "NewCorp",
    partner_id: null,
  },
};

const HISTORY = {
  engagement: ENGAGEMENT,
  messages: [HISTORY_MSG_1, HISTORY_MSG_2],
  meetings: [MEETING],
  participants: [PARTICIPANT],
};

const CATALOGS = {
  events: [EVENT],
  programs: [PROGRAM],
  relationships: [RELATIONSHIP],
};

// ============================================================
// Tests: PHASE2_SYSTEM_PROMPT content
// ============================================================

describe("PHASE2_SYSTEM_PROMPT", () => {
  it("contains thread awareness instructions", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Thread Awareness");
    expect(PHASE2_SYSTEM_PROMPT).toContain(">>> NEW EMAIL — CLASSIFY THIS <<<");
    expect(PHASE2_SYSTEM_PROMPT).toContain("CONTEXT ONLY");
  });

  it("contains temporal awareness instructions", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Temporal awareness");
    expect(PHASE2_SYSTEM_PROMPT).toContain("late-arriving forward");
    expect(PHASE2_SYSTEM_PROMPT).toContain("last_activity");
  });

  it("contains open items threshold language", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("leadership");
    expect(PHASE2_SYSTEM_PROMPT).toContain("blockers and commitments");
  });

  it("contains participant role vocabulary", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("forwarder");
    expect(PHASE2_SYSTEM_PROMPT).toContain("partner_contact");
    expect(PHASE2_SYSTEM_PROMPT).toContain("aws_stakeholder");
    expect(PHASE2_SYSTEM_PROMPT).toContain("executive");
    expect(PHASE2_SYSTEM_PROMPT).toContain("technical_contact");
    expect(PHASE2_SYSTEM_PROMPT).toContain("third_party");
  });

  it("contains pillar inference instructions", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Pillar Inference");
    expect(PHASE2_SYSTEM_PROMPT).toContain("Co-Sell");
    expect(PHASE2_SYSTEM_PROMPT).toContain("Co-Build");
    expect(PHASE2_SYSTEM_PROMPT).toContain("Co-Market");
  });

  it("contains response format with all required fields", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("content_type");
    expect(PHASE2_SYSTEM_PROMPT).toContain("engagement_match");
    expect(PHASE2_SYSTEM_PROMPT).toContain("current_state");
    expect(PHASE2_SYSTEM_PROMPT).toContain("open_items");
    expect(PHASE2_SYSTEM_PROMPT).toContain("resolved_open_items");
    expect(PHASE2_SYSTEM_PROMPT).toContain("participants");
    expect(PHASE2_SYSTEM_PROMPT).toContain("matched_events");
    expect(PHASE2_SYSTEM_PROMPT).toContain("matched_programs");
    expect(PHASE2_SYSTEM_PROMPT).toContain("matched_relationships");
    expect(PHASE2_SYSTEM_PROMPT).toContain("suggested_tags");
    expect(PHASE2_SYSTEM_PROMPT).toContain('"pillar"');
  });

  it("instructs to echo Phase 1 fields", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("echo them back exactly as given");
  });

  it("supports up to 7 sentences for complex engagements", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("3-5 sentences for typical engagements, up to 7 for complex");
  });

  it("has fresh briefing instruction for new engagements", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("no history (new engagement)");
    expect(PHASE2_SYSTEM_PROMPT).toContain("fresh briefing");
  });
});

// ============================================================
// Tests: buildPhase2Context for EXISTING engagement
// ============================================================

describe("buildPhase2Context — existing engagement", () => {
  it("includes forwarder section", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("Steven Romero");
    expect(result).toContain("sterme@amazon.com");
    expect(result).toContain("Forwarder Identity");
  });

  it("includes Phase 1 pass-through section", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("Phase 1 Classification");
    expect(result).toContain('"engagement_email"');
    expect(result).toContain("eng-001");
    expect(result).toContain("0.95");
  });

  it("includes engagement context with name, partner, current_state anchor", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("## Engagement Context");
    expect(result).toContain("CyberShield - Security Review");
    expect(result).toContain("**Partner:** CyberShield");
    expect(result).toContain("Current state (anchor — evolve this):");
    expect(result).toContain("pursuing AWS Security Competency");
  });

  it("includes open items with resolved/unresolved status", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("Submit architecture diagram");
    expect(result).toContain("[UNRESOLVED]");
    expect(result).toContain("Schedule security team call");
    expect(result).toContain("[RESOLVED]");
  });

  it("includes tags", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("security, competency");
  });

  it("includes history messages in chronological order with HISTORY label", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("Message 1 of 2 — HISTORY");
    expect(result).toContain("Message 2 of 2 — HISTORY");
    // Verify chronological order — msg 1 before msg 2 in history section
    const historySection = result.substring(result.indexOf("## Engagement History"));
    const idx1 = historySection.indexOf("kick off the security review");
    const idx2 = historySection.indexOf("submitted the initial application");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
    expect(idx1).toBeLessThan(idx2);
  });

  it("includes linked meetings", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("Linked Meetings");
    expect(result).toContain("CyberShield Security Review Call");
    expect(result).toContain("2026-03-05");
    expect(result).toContain("3 attendees");
    expect(result).toContain("Confirmed");
  });

  it("marks new email with >>> NEW EMAIL — CLASSIFY THIS <<<", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain(">>> NEW EMAIL — CLASSIFY THIS <<<");
    expect(result).toContain("Architecture Diagram");
    expect(result).toContain("attached is the architecture diagram");
  });

  it("includes matched partner details", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("## Matched Partner");
    expect(result).toContain("CyberShield");
    expect(result).toContain("security");
    expect(result).toContain("Cloud-native endpoint security platform");
  });

  it("includes event/program/relationship catalogs", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).toContain("re:Inforce 2026");
    expect(result).toContain("Security Competency");
    expect(result).toContain("Security Team - ISV");
  });

  it("does NOT include engagement index or compact partner catalog", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    expect(result).not.toContain("## Engagement Index");
    expect(result).not.toContain("## Partner Catalog");
  });

  it("includes forwarder note when provided", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER, "Urgent review");
    expect(result).toContain("Forwarder Note:");
    expect(result).toContain("Urgent review");
  });
});

// ============================================================
// Tests: buildPhase2Context for NEW engagement
// ============================================================

describe("buildPhase2Context — new engagement", () => {
  it("skips engagement context section", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_NEW, null, CATALOGS, null);
    expect(result).not.toContain("## Engagement Context");
    expect(result).not.toContain("Current state (anchor");
  });

  it("skips history section", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_NEW, null, CATALOGS, null);
    expect(result).not.toContain("## Engagement History");
    expect(result).not.toContain("HISTORY");
  });

  it("still includes new email with marker", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_NEW, null, CATALOGS, null);
    expect(result).toContain(">>> NEW EMAIL — CLASSIFY THIS <<<");
    expect(result).toContain("attached is the architecture diagram");
  });

  it("still includes catalogs", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_NEW, null, CATALOGS, null);
    expect(result).toContain("re:Inforce 2026");
    expect(result).toContain("Security Competency");
    expect(result).toContain("Security Team - ISV");
  });

  it("shows 'Partner not in catalog' when no matched partner", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_NEW, null, CATALOGS, null);
    expect(result).toContain("Partner not in catalog");
  });

  it("includes Phase 1 pass-through with is_new true", () => {
    const result = buildPhase2Context([NEW_MSG], PHASE1_NEW, null, CATALOGS, null);
    expect(result).toContain("Phase 1 Classification");
    expect(result).toContain('"is_new":true');
    expect(result).toContain("NewCorp - Cloud Migration");
  });
});

// ============================================================
// Tests: Multiple new messages
// ============================================================

describe("buildPhase2Context — multiple new messages", () => {
  it("marks each new message with the marker", () => {
    const msg2 = makeMessage({
      id: "new-002",
      sender_name: "Bob Smith",
      sender_email: "bob@cybershield.com",
      body_text: "Adding context from my side.",
    });
    const result = buildPhase2Context([NEW_MSG, msg2], PHASE1_EXISTING, HISTORY, CATALOGS, PARTNER);
    const markers = result.match(/>>> NEW EMAIL — CLASSIFY THIS <<</g);
    expect(markers).toHaveLength(2);
  });
});

// ============================================================
// Tests: parsePhase2Response
// ============================================================

describe("parsePhase2Response", () => {
  const validJson = JSON.stringify({
    content_type: "engagement_email",
    engagement_match: {
      id: "eng-001",
      name: "CyberShield - Security Review",
      confidence: 0.95,
      is_new: false,
      partner_name: "CyberShield",
      partner_id: "partner-001",
    },
    current_state: "Alice sent the architecture diagram.",
    open_items: [{ description: "Forward diagram to security team", assignee: "Steven", due_date: null }],
    resolved_open_items: ["Submit architecture diagram"],
    participants: [
      { name: "Alice Chen", email: "alice@cybershield.com", organization: "CyberShield", role: "partner_contact" },
    ],
    matched_events: [],
    matched_programs: [{ id: "prog-001", name: "Security Competency", relationship: "qualifies_for" }],
    matched_relationships: [],
    suggested_tags: ["security", "competency"],
    pillar: "Co-Build",
  });

  it("parses valid combined result", () => {
    const result = parsePhase2Response(validJson);
    expect(result.content_type).toBe("engagement_email");
    expect(result.engagement_match.id).toBe("eng-001");
    expect(result.current_state).toBe("Alice sent the architecture diagram.");
    expect(result.open_items).toHaveLength(1);
    expect(result.resolved_open_items).toEqual(["Submit architecture diagram"]);
    expect(result.participants).toHaveLength(1);
    expect(result.matched_programs).toHaveLength(1);
    expect(result.suggested_tags).toEqual(["security", "competency"]);
    expect(result.pillar).toBe("Co-Build");
  });

  it("handles markdown-wrapped JSON", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const result = parsePhase2Response(wrapped);
    expect(result.content_type).toBe("engagement_email");
    expect(result.pillar).toBe("Co-Build");
  });

  it("handles bare ``` wrapping", () => {
    const wrapped = "```\n" + validJson + "\n```";
    const result = parsePhase2Response(wrapped);
    expect(result.content_type).toBe("engagement_email");
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePhase2Response("not json")).toThrow();
  });

  it("defaults missing arrays and pillar", () => {
    const minimal = JSON.stringify({
      content_type: "engagement_email",
      engagement_match: {
        id: "eng-001",
        name: "Test",
        confidence: 0.9,
        is_new: false,
        partner_name: null,
      },
      current_state: "Some state.",
    });
    const result = parsePhase2Response(minimal);
    expect(result.matched_events).toEqual([]);
    expect(result.matched_programs).toEqual([]);
    expect(result.matched_relationships).toEqual([]);
    expect(result.participants).toEqual([]);
    expect(result.open_items).toEqual([]);
    expect(result.resolved_open_items).toEqual([]);
    expect(result.suggested_tags).toEqual([]);
    expect(result.pillar).toBeNull();
  });

  it("preserves content_type and engagement_match from echo", () => {
    const result = parsePhase2Response(validJson);
    expect(result.content_type).toBe("engagement_email");
    expect(result.engagement_match.confidence).toBe(0.95);
    expect(result.engagement_match.is_new).toBe(false);
    expect(result.engagement_match.partner_id).toBe("partner-001");
  });
});
