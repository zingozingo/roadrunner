import { describe, it, expect } from "vitest";
import type {
  Message,
  Engagement,
  Meeting,
  Participant,
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
    partner_id: null as string | null,
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

const ENGAGEMENT: Engagement & { partner_name: string | null } = {
  id: "eng-001",
  name: "CyberShield - Security Review",
  status: "active",
  current_state: "CyberShield is pursuing AWS Security Competency. Alice submitted the initial application last week. Steven connected them with the security team for technical review.",
  condensed: null,
  topic: "Security Competency Technical Validation",
  partner_name: "CyberShield",
  partner_id: "partner-001",
  pillar: "Co-Build",
  program_id: null,
  airtable_record_id: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-02-18T00:00:00Z",
  closed_at: null,
};

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
  partner_id: "partner-001",
  message_id: null,
  status: "scheduled",
  meeting_date: "2026-03-05",
  start_time: "10:00",
  end_time: "11:00",
  location: "Chime",
  organizer_email: "sterme@amazon.com",
  organizer_name: "Steven Romero",
  ics_uid: null,
  sequence: null,
  is_recurring: false,
  source: "manual",
  meeting_type: null,
  recurrence_pattern: null,
  recurrence_end: null,
  series_id: null,
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
  org_type: "partner",
  notes: null,
  created_at: "2026-01-20T00:00:00Z",
  role: "partner_contact",
};

const PARTNER: Partner = {
  id: "partner-001",
  name: "CyberShield",
  segment: "security",
  focus_area: ["endpoint"],
  spms_id: null,
  aws_stickiness: null,
  key_aws_services: [],
  what_they_do: "Cloud-native endpoint security platform",
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
  participants: [PARTICIPANT],
};

// ============================================================
// Tests: PHASE2_SYSTEM_PROMPT content
// ============================================================

describe("PHASE2_SYSTEM_PROMPT", () => {
  it("contains context description and condensed instructions", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Context You Receive");
    expect(PHASE2_SYSTEM_PROMPT).toContain("condensed Instructions");
    expect(PHASE2_SYSTEM_PROMPT).toContain("Importance Weighting");
  });

  it("contains temporal awareness instructions", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Temporal Discipline");
    expect(PHASE2_SYSTEM_PROMPT).toContain("Late-arriving email");
    expect(PHASE2_SYSTEM_PROMPT).toContain("last_activity");
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
    expect(PHASE2_SYSTEM_PROMPT).toContain("participants");
    expect(PHASE2_SYSTEM_PROMPT).toContain("condensed");
    expect(PHASE2_SYSTEM_PROMPT).toContain('"pillar"');
  });

  it("instructs to return routing fields as-is", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Return them as-is in your response");
  });

  it("supports up to 7 sentences for complex engagements", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Up to 7 sentences allowed");
  });

  it("has fresh briefing instruction for new engagements", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("New engagement");
    expect(PHASE2_SYSTEM_PROMPT).toContain("fresh 3-5 sentence briefing");
  });
});

// ============================================================
// Tests: buildPhase2Context for EXISTING engagement
// ============================================================

describe("buildPhase2Context — existing engagement", () => {
  it("includes forwarder section", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    expect(result).toContain("Steven Romero");
    expect(result).toContain("sterme@amazon.com");
    expect(result).toContain("Forwarder Identity");
  });

  it("includes routing decision section", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    expect(result).toContain("Routing Decision");
    expect(result).toContain('"engagement_email"');
    expect(result).toContain("eng-001");
    expect(result).toContain("0.95");
  });

  it("includes engagement context with name, partner, current_state anchor", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    expect(result).toContain("## Engagement Context");
    expect(result).toContain("CyberShield - Security Review");
    expect(result).toContain("**Partner:** CyberShield");
    expect(result).toContain("Current state (anchor — evolve this):");
    expect(result).toContain("pursuing AWS Security Competency");
  });

  it("marks new email with >>> NEW EMAIL — CLASSIFY THIS <<<", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    expect(result).toContain(">>> NEW EMAIL — CLASSIFY THIS <<<");
    expect(result).toContain("Architecture Diagram");
    expect(result).toContain("attached is the architecture diagram");
  });

  it("includes matched partner details with key contacts", () => {
    const registryContacts = [
      { name: "Alice Chen", email: "alice@cybershield.com", title: "CTO", org_type: "partner", role: "Alliance Lead" },
    ];
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      partnerContacts: registryContacts,
    });
    expect(result).toContain("## Matched Partner");
    expect(result).toContain("CyberShield");
    expect(result).toContain("security");
    expect(result).toContain("Key Contacts:");
    expect(result).toContain("Alice Chen");
    expect(result).toContain("Alliance Lead");
    expect(result).toContain("Cloud-native endpoint security platform");
  });

  it("includes forwarder note when provided", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER, forwarderNote: "Urgent review" });
    expect(result).toContain("Forwarder Note:");
    expect(result).toContain("Urgent review");
  });

  it("includes topic in engagement context when it exists", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    expect(result).toContain("**Topic:** Security Competency Technical Validation");
  });

  it("shows 'Not yet set' when topic is null", () => {
    const historyNullSlots = {
      ...HISTORY,
      engagement: { ...ENGAGEMENT, topic: null },
    };
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: historyNullSlots, matchedPartner: PARTNER });
    expect(result).toContain("**Topic:** Not yet set");
  });

  it("includes pillar in engagement context when set", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    expect(result).toContain("**Pillar:** Co-Build");
  });
});

// ============================================================
// Tests: buildPhase2Context for NEW engagement
// ============================================================

describe("buildPhase2Context — new engagement", () => {
  it("skips engagement context section", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_NEW, history: null, matchedPartner: null });
    expect(result).not.toContain("## Engagement Context");
    expect(result).not.toContain("Current state (anchor");
  });

  it("skips history section", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_NEW, history: null, matchedPartner: null });
    expect(result).not.toContain("## Engagement History");
    expect(result).not.toContain("HISTORY");
  });

  it("still includes new email with marker", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_NEW, history: null, matchedPartner: null });
    expect(result).toContain(">>> NEW EMAIL — CLASSIFY THIS <<<");
    expect(result).toContain("attached is the architecture diagram");
  });

  it("shows 'Partner not in catalog' when no matched partner", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_NEW, history: null, matchedPartner: null });
    expect(result).toContain("Partner not in catalog");
  });

  it("includes routing decision with is_new true", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_NEW, history: null, matchedPartner: null });
    expect(result).toContain("Routing Decision");
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
    const result = buildPhase2Context({ newMessages: [NEW_MSG, msg2], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
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
    participants: [
      { name: "Alice Chen", email: "alice@cybershield.com", organization: "CyberShield", role: "partner_contact" },
    ],
    pillar: "Co-Build",
  });

  it("parses valid combined result", () => {
    const result = parsePhase2Response(validJson);
    expect(result.content_type).toBe("engagement_email");
    expect(result.engagement_match.id).toBe("eng-001");
    expect(result.current_state).toBe("Alice sent the architecture diagram.");
    expect(result.participants).toHaveLength(1);
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
    expect(result.participants).toEqual([]);
    expect(result.pillar).toBeNull();
  });

  it("preserves content_type and engagement_match from echo", () => {
    const result = parsePhase2Response(validJson);
    expect(result.content_type).toBe("engagement_email");
    expect(result.engagement_match.confidence).toBe(0.95);
    expect(result.engagement_match.is_new).toBe(false);
    expect(result.engagement_match.partner_id).toBe("partner-001");
  });

  it("extracts topic and engagement_name from response", () => {
    const jsonWithSlots = JSON.stringify({
      content_type: "engagement_email",
      engagement_match: {
        id: "eng-001",
        name: "CyberShield - Security Review",
        confidence: 0.95,
        is_new: false,
        partner_name: "CyberShield",
        partner_id: "partner-001",
      },
      topic: "Security Competency Technical Validation",
      engagement_name: "CyberShield - Security Competency Technical Validation",
      current_state: "Alice sent the architecture diagram.",
      participants: [],
      matched_events: [],
      matched_programs: [],
      matched_relationships: [],
      pillar: "Co-Build",
    });
    const result = parsePhase2Response(jsonWithSlots);
    expect(result.topic).toBe("Security Competency Technical Validation");
    expect(result.engagement_name).toBe("CyberShield - Security Competency Technical Validation");
  });

  it("defaults topic and engagement_name to null when missing", () => {
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
    expect(result.topic).toBeNull();
    expect(result.engagement_name).toBeNull();
  });
});

// ============================================================
// Tests: PHASE2_SYSTEM_PROMPT date discipline rules
// ============================================================

describe("PHASE2_SYSTEM_PROMPT — date discipline", () => {
  it("contains point-in-time snapshot instruction", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("point-in-time snapshot");
  });

  it("prohibits relative time words", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("NEVER use relative time words");
    expect(PHASE2_SYSTEM_PROMPT).toContain("recently, soon, this week, last month");
  });

  it("instructs to describe states not futures", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("Describe states, not futures");
  });

  it("instructs present progressive for ongoing activity", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("present progressive");
  });

  it("contains topic and engagement_name instructions", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("## topic Instructions");
    expect(PHASE2_SYSTEM_PROMPT).toContain("## engagement_name Instructions");
  });

  it("response format includes topic and engagement_name fields", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain('"topic"');
    expect(PHASE2_SYSTEM_PROMPT).toContain('"engagement_name"');
  });

  it("contains stability rule for topic", () => {
    expect(PHASE2_SYSTEM_PROMPT).toContain("return it EXACTLY as-is unless the engagement has fundamentally changed direction");
    expect(PHASE2_SYSTEM_PROMPT).toContain("Do not rephrase for stylistic variety");
  });
});

// ============================================================
// Tests: buildPhase2Context includes current date
// ============================================================

describe("buildPhase2Context — current date injection", () => {
  it("includes Current Date section with today's date", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    const today = new Date().toISOString().split("T")[0];
    expect(result).toContain("## Current Date");
    expect(result).toContain(today);
    expect(result).toContain("temporal anchor");
  });

  it("includes date section before other sections", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    const dateIdx = result.indexOf("## Current Date");
    const forwarderIdx = result.indexOf("## Forwarder Identity");
    expect(dateIdx).toBeGreaterThan(-1);
    expect(forwarderIdx).toBeGreaterThan(-1);
    expect(dateIdx).toBeLessThan(forwarderIdx);
  });
});

// ============================================================
// Tests: buildPhase2Context with name resolution map
// ============================================================

describe("buildPhase2Context — name resolution", () => {
  const NAME_MAP = {
    emailToName: new Map([
      ["crisresl@amazon.com", { name: "Cristian Restrepo Lopez", source: "participant" as const }],
      ["alice@cybershield.com", { name: "Alice Chen", source: "participant" as const }],
    ]),
    domainToOrg: new Map([
      ["cybershield.com", "CyberShield"],
    ]),
  };

  it("uses resolved name from map for new email with null sender_name", () => {
    const newMsg = makeMessage({
      id: "new-alias",
      sender_name: null,
      sender_email: "crisresl@amazon.com",
      body_text: "Here's the updated architecture.",
    });
    const result = buildPhase2Context({
      newMessages: [newMsg], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      nameResolutionMap: NAME_MAP,
    });
    expect(result).toContain("Cristian Restrepo Lopez <crisresl@amazon.com>");
  });

  it("uses displayName fallback when both sender_name and map resolution are null", () => {
    const msgNoName = makeMessage({
      id: "new-noname",
      sender_name: null,
      sender_email: "jane.doe@unknown.com",
      body_text: "Test message.",
    });
    const result = buildPhase2Context({
      newMessages: [msgNoName], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      nameResolutionMap: NAME_MAP,
    });
    // displayName formats "jane.doe@unknown.com" → "Jane Doe"
    expect(result).toContain("Jane Doe <jane.doe@unknown.com>");
  });

  it("works without a resolution map (backward compatible)", () => {
    const result = buildPhase2Context({ newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER });
    // Should use sender_name directly
    expect(result).toContain("Alice Chen <alice@cybershield.com>");
  });
});

// ============================================================
// Incoming meeting data
// ============================================================

describe("buildPhase2Context — incoming meeting data", () => {
  const NEW_MEETING: Meeting & { partner_name: string | null } = {
    id: "mtg-new",
    title: "Partner Kickoff Call",
    engagement_id: null,
    partner_name: "CyberShield",
    partner_id: "partner-001",
    message_id: "new-001",
    status: "scheduled",
    meeting_date: "2026-03-20",
    start_time: "14:00",
    end_time: "15:00",
    location: "Chime",
    organizer_email: "alice@cybershield.com",
    organizer_name: "Alice Chen",
    ics_uid: "uid-new",
    sequence: 0,
    is_recurring: true,
    source: "ics_parsed",
    meeting_type: null,
    recurrence_pattern: null,
    recurrence_end: null,
    series_id: null,
    notes: null,
    airtable_record_id: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
  };

  it("includes incoming meeting data when newMeetings provided", () => {
    const meetingContacts = new Map([
      ["mtg-new", [
        { name: "Alice Chen", email: "alice@cybershield.com" },
        { name: "Bob Smith", email: "bob@cybershield.com" },
      ]],
    ]);
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      newMeetings: [NEW_MEETING], meetingContacts,
    });
    expect(result).toContain("Incoming Meeting Data");
    expect(result).toContain("Partner Kickoff Call");
    expect(result).toContain("**Organizer:** alice@cybershield.com");
    expect(result).toContain("**Matched Partner:** CyberShield (id: partner-001)");
    expect(result).toContain("**Recurring:** Yes");
    expect(result).toContain("Alice Chen <alice@cybershield.com>");
    expect(result).toContain("Bob Smith <bob@cybershield.com>");
  });

  it("omits incoming meeting section when no meetings", () => {
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
    });
    expect(result).not.toContain("Incoming Meeting Data");
  });

  it("omits incoming meeting section when empty array", () => {
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      newMeetings: [],
    });
    expect(result).not.toContain("Incoming Meeting Data");
  });
});

// ============================================================
// Tests: Scratchpad and condensed digest sections
// ============================================================

describe("buildPhase2Context — scratchpad and digests", () => {
  it("includes scratchpad section when entries provided", () => {
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      scratchpadEntries: [
        { content: "Alice is the key decision maker", created_at: "2026-02-10T00:00:00Z" },
        { content: "Partner prefers async communication", created_at: "2026-01-15T00:00:00Z" },
      ],
    });
    expect(result).toContain("## Scratchpad Notes (PDM tribal knowledge)");
    expect(result).toContain("[2026-02-10] Alice is the key decision maker");
    expect(result).toContain("[2026-01-15] Partner prefers async communication");
  });

  it("omits scratchpad section when no entries", () => {
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
    });
    expect(result).not.toContain("Scratchpad");
  });

  it("includes condensed meeting digests when provided", () => {
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
      condensedMeetingDigests: [
        { title: "Security Review Call", meeting_date: "2026-02-15", condensed: "Topic: Security validation\nStatus: active\nKey developments:\n- Architecture review in progress" },
      ],
    });
    expect(result).toContain("## Meeting Digests (linked to this engagement)");
    expect(result).toContain("### Security Review Call (2026-02-15)");
    expect(result).toContain("Architecture review in progress");
  });

  it("omits condensed digests section when no digests", () => {
    const result = buildPhase2Context({
      newMessages: [NEW_MSG], phase1Result: PHASE1_EXISTING, history: HISTORY, matchedPartner: PARTNER,
    });
    expect(result).not.toContain("Meeting Digests");
  });
});
