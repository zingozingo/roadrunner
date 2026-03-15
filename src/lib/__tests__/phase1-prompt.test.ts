import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, Meeting, Engagement, Partner } from "../types";

// ============================================================
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ============================================================

const {
  mockGetActiveEngagements,
  mockGetPartners,
  mockGetPartnerContactDomains,
  mockFrom,
} = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockIn = vi.fn().mockReturnValue({ order: mockOrder });
  const mockEq = vi.fn().mockReturnValue({ in: mockIn });
  const mockSelect = vi.fn().mockReturnValue({ in: mockIn, eq: mockEq });

  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return {
    mockGetActiveEngagements: vi.fn().mockResolvedValue([]),
    mockGetPartners: vi.fn().mockResolvedValue([]),
    mockGetPartnerContactDomains: vi.fn().mockResolvedValue(new Map()),
    mockFrom,
  };
});

vi.mock("../db", () => ({
  getActiveEngagements: mockGetActiveEngagements,
  getPartners: mockGetPartners,
  getPartnerContactDomains: mockGetPartnerContactDomains,
  getSupabaseClient: vi.fn().mockReturnValue({ from: mockFrom }),
}));

vi.mock("../user-config", () => ({
  USER_CONFIG: {
    name: "Steven Romero",
    email: "sterme@amazon.com",
    aliases: ["sromero@amazon.com"],
    role: "Partner Development Manager (PDM)",
    segment: "AWS Security, ISV Partners",
  },
}));

// Import after mocks
import {
  buildPhase1Context,
  buildEngagementIndex,
  buildCompactPartnerCatalog,
  buildMeetingHint,
  parsePhase1Response,
  truncateToWords,
  PHASE1_SYSTEM_PROMPT,
} from "../phase1-prompt";

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
    to_header: null,
    cc_header: null,
    ...overrides,
  };
}

type EngagementWithPartner = Engagement & { partner_name: string | null };

const ENGAGEMENT_A: EngagementWithPartner = {
  id: "eng-001",
  name: "CyberShield - Security Review",
  status: "active",
  current_state: "Pursuing Security Competency.",
  topic: "Security Competency Pursuit",
  goal: null,
  partner_name: "CyberShield",
  partner_id: "partner-001",
  pillar: "Co-Build",
  program_id: null,
  airtable_record_id: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  closed_at: null,
};

const ENGAGEMENT_B: EngagementWithPartner = {
  id: "eng-002",
  name: "NinjaOne - NFL Partnership",
  status: "active",
  current_state: null,
  topic: "NFL Sponsorship Campaign",
  goal: null,
  partner_name: "NinjaOne",
  partner_id: "partner-002",
  pillar: "Co-Market",
  program_id: null,
  airtable_record_id: null,
  created_at: "2026-01-20T00:00:00Z",
  updated_at: "2026-02-15T00:00:00Z",
  closed_at: null,
};

const ENGAGEMENT_C: EngagementWithPartner = {
  id: "eng-003",
  name: "CyberShield - Marketplace Listing",
  status: "active",
  current_state: null,
  topic: "Marketplace Listing",
  goal: null,
  partner_name: "CyberShield",
  partner_id: "partner-001",
  pillar: "Co-Sell",
  program_id: null,
  airtable_record_id: null,
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-20T00:00:00Z",
  closed_at: null,
};

const PARTNER_WITH_DOMAINS: Partner = {
  id: "partner-001",
  name: "CyberShield",
  segment: "security",
  focus_area: [],
  spms_id: null,
  aws_team: [],
  partner_contacts: [
    { name: "Alice Chen", email: "alice@cybershield.com", title: "CTO", role: "Alliance Lead" },
    { name: "Bob Smith", email: "bob@cybershield.com", title: null, role: "Contact" },
    { name: "Carol Lee", email: "carol@cybershield.io", title: null, role: "Contact" },
  ],
  aws_stickiness: null,
  key_aws_services: [],
  what_they_do: null,
  airtable_record_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PARTNER_NO_EMAILS: Partner = {
  id: "partner-003",
  name: "GhostCorp",
  segment: null,
  focus_area: [],
  spms_id: null,
  aws_team: [],
  partner_contacts: [],
  aws_stickiness: null,
  key_aws_services: [],
  what_they_do: null,
  airtable_record_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PARTNER_EMPTY_EMAILS: Partner = {
  ...PARTNER_NO_EMAILS,
  id: "partner-004",
  name: "EmptyDomains",
};

// ============================================================
// Tests
// ============================================================

describe("PHASE1_SYSTEM_PROMPT", () => {
  it("uses curated-input philosophy", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("intentionally forwarded by the PDM");
    expect(PHASE1_SYSTEM_PROMPT).toContain("WHICH engagement it belongs to");
  });

  it("specifies JSON response format", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("Return ONLY valid JSON");
    expect(PHASE1_SYSTEM_PROMPT).toContain("content_type");
    expect(PHASE1_SYSTEM_PROMPT).toContain("engagement_match");
  });

  it("includes ordered decision framework steps", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("Step 1: Check the forwarder note");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Step 2: Identify the partner");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Step 3: Evaluate against ALL engagements");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Step 4: Route based on evaluation");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Step 5: Identify new engagements");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Step 6: When uncertain, flag for review");
  });

  it("references evaluation signals for routing", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("Topic alignment");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Context alignment");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Participant overlap");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Pillar alignment");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Linked entities");
    expect(PHASE1_SYSTEM_PROMPT).toContain("External parties");
  });

  it("does NOT treat single-engagement partners as a routing shortcut", () => {
    // The old prompt had "If the partner has only one active engagement ... route there"
    // This shortcut bypassed content evaluation and caused the Spacelift merge bug
    expect(PHASE1_SYSTEM_PROMPT).not.toMatch(/only one .*engagement/i);
    expect(PHASE1_SYSTEM_PROMPT).not.toMatch(/single.*engagement/i);
    expect(PHASE1_SYSTEM_PROMPT).not.toMatch(/has one .*engagement/i);
    expect(PHASE1_SYSTEM_PROMPT).toContain("number of engagements a partner has is IRRELEVANT");
  });

  it("requires content evaluation, not just partner match, for confidence", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("Partner identification alone");
    expect(PHASE1_SYSTEM_PROMPT).toContain("NEVER sufficient for high confidence");
  });

  it("treats noise as rare given curated input", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("rare given curated input");
  });
});

describe("buildEngagementIndex", () => {
  it("groups engagements by partner with header", () => {
    const lastSubjects = new Map([["eng-001", "Re: Security Review Next Steps"]]);
    const result = buildEngagementIndex([ENGAGEMENT_A], lastSubjects);

    expect(result).toContain("### CyberShield (1 engagement)");
    expect(result).toContain('"CyberShield - Security Review"');
    expect(result).toContain("id: eng-001");
    expect(result).toContain('Last Subject: "Re: Security Review Next Steps"');
  });

  it("includes pillar and topic", () => {
    const lastSubjects = new Map([["eng-001", "Re: Security Review"]]);
    const result = buildEngagementIndex([ENGAGEMENT_A], lastSubjects);

    expect(result).toContain("Pillar: Co-Build");
    expect(result).toContain('Topic: "Security Competency Pursuit"');
  });

  it("omits pillar when null", () => {
    const engNoPillar = { ...ENGAGEMENT_B, pillar: null } as Engagement;
    const lastSubjects = new Map([["eng-002", "NFL update"]]);
    const result = buildEngagementIndex([engNoPillar], lastSubjects);

    expect(result).not.toContain("Pillar:");
    expect(result).toContain('Topic: "NFL Sponsorship Campaign"');
  });

  it("omits topic when null", () => {
    const engNoTopic = { ...ENGAGEMENT_A, topic: null };
    const lastSubjects = new Map([["eng-001", "Re: Security Review"]]);
    const result = buildEngagementIndex([engNoTopic], lastSubjects);

    expect(result).not.toContain("Topic:");
    expect(result).toContain("Pillar: Co-Build");
  });

  it("groups multi-engagement partners together", () => {
    const lastSubjects = new Map([
      ["eng-001", "Re: Security Review"],
      ["eng-003", "Marketplace listing update"],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A, ENGAGEMENT_C], lastSubjects);

    expect(result).toContain("### CyberShield (2 engagements)");
    expect(result).toContain('"CyberShield - Security Review"');
    expect(result).toContain('"CyberShield - Marketplace Listing"');
  });

  it("includes last_subject from most recent message", () => {
    const lastSubjects = new Map([
      ["eng-001", "Re: FedRAMP timeline"],
      ["eng-002", "NFL sponsorship update"],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A, ENGAGEMENT_B], lastSubjects);

    expect(result).toContain('Last Subject: "Re: FedRAMP timeline"');
    expect(result).toContain('Last Subject: "NFL sponsorship update"');
  });

  it("shows (none) when engagement has no messages", () => {
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map());
    expect(result).toContain('Last Subject: "(none)"');
  });

  it("returns 'None yet' when no engagements exist", () => {
    const result = buildEngagementIndex([], new Map());
    expect(result).toContain("None yet.");
  });

  it("renders participants sorted with partner domains first", () => {
    const participantMap = new Map([
      ["eng-001", ["sterme@amazon.com", "alice@cybershield.com", "bob@cybershield.com", "cdbragg@amazon.com"]],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map(), participantMap);

    expect(result).toContain("Participants:");
    // Forwarder sterme@amazon.com should be excluded
    expect(result).not.toContain("sterme@amazon.com");
    // Partner domains should come before AWS
    const participantLine = result.split("\n").find((l) => l.startsWith("Participants:"))!;
    const aliceIdx = participantLine.indexOf("alice@cybershield.com");
    const cdbraggIdx = participantLine.indexOf("cdbragg@amazon.com");
    expect(aliceIdx).toBeLessThan(cdbraggIdx);
  });

  it("caps participants at 8 with overflow count", () => {
    // 10 non-forwarder emails: should show 8 + "+2 more"
    const emails = [
      "sterme@amazon.com", // forwarder — excluded
      "p1@partner.com", "p2@partner.com", "p3@partner.com", "p4@partner.com",
      "p5@partner.com", "p6@partner.com", "p7@partner.com", "p8@partner.com",
      "a1@amazon.com", "a2@amazon.com",
    ];
    const participantMap = new Map([["eng-001", emails]]);
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map(), participantMap);

    expect(result).toContain("+2 more");
    // Should contain first 8 non-forwarder emails
    expect(result).toContain("p1@partner.com");
    expect(result).toContain("p8@partner.com");
  });

  it("excludes forwarder email from participant lists", () => {
    const participantMap = new Map([
      ["eng-001", ["sterme@amazon.com", "alice@cybershield.com"]],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map(), participantMap);

    expect(result).toContain("alice@cybershield.com");
    expect(result).not.toContain("sterme@amazon.com");
  });

  it("omits Participants line when no participants after filtering", () => {
    const participantMap = new Map([
      ["eng-001", ["sterme@amazon.com"]], // only forwarder
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map(), participantMap);

    expect(result).not.toContain("Participants:");
  });

  it("renders entity links for programs and events", () => {
    const entityLinksMap = new Map([
      ["eng-001", [
        { type: "program", name: "DevOps Competency" },
        { type: "event", name: "RSA Conference 2026" },
      ]],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map(), new Map(), entityLinksMap);

    expect(result).toContain("Programs: DevOps Competency");
    expect(result).toContain("Events: RSA Conference 2026");
  });

  it("omits entity link lines when none exist for engagement", () => {
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map(), new Map(), new Map());

    expect(result).not.toContain("Programs:");
    expect(result).not.toContain("Events:");
  });

  it("uses 'Unassigned' group for engagements without partner_name", () => {
    const noPartner = { ...ENGAGEMENT_A, partner_name: null };
    const result = buildEngagementIndex([noPartner], new Map());

    expect(result).toContain("### Unassigned (1 engagement)");
  });

  it("includes goal when populated", () => {
    const engWithGoal = { ...ENGAGEMENT_A, goal: "Achieve Security Competency and list on Marketplace." };
    const result = buildEngagementIndex([engWithGoal], new Map());

    expect(result).toContain('Goal: "Achieve Security Competency and list on Marketplace."');
  });

  it("omits goal when null", () => {
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map());
    expect(result).not.toContain("Goal:");
  });

  it("includes truncated current_state as Context", () => {
    const engWithState = {
      ...ENGAGEMENT_A,
      current_state: "Pursuing Security Competency. Technical validation in progress with AWS security team.",
    };
    const result = buildEngagementIndex([engWithState], new Map());

    expect(result).toContain("Context: Pursuing Security Competency. Technical validation in progress with AWS security team.");
  });

  it("omits Context when current_state is null", () => {
    const engNoState = { ...ENGAGEMENT_B, current_state: null };
    const result = buildEngagementIndex([engNoState], new Map());

    expect(result).not.toContain("Context:");
  });

  it("truncates long current_state to ~150 words", () => {
    // Generate a 200-word current_state
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const longState = words.join(" ");
    const engLongState = { ...ENGAGEMENT_A, current_state: longState };
    const result = buildEngagementIndex([engLongState], new Map());

    expect(result).toContain("Context:");
    // Should end with ellipsis
    expect(result).toContain("…");
    // Should NOT contain word199 (the 200th word)
    expect(result).not.toContain("word199");
    // Should contain word149 (the 150th word)
    expect(result).toContain("word149");
  });
});

describe("buildCompactPartnerCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes partners with domains", async () => {
    mockGetPartnerContactDomains.mockResolvedValue(new Map([
      ["cybershield.com", { partnerId: "partner-001", partnerName: "CyberShield" }],
      ["cybershield.io", { partnerId: "partner-001", partnerName: "CyberShield" }],
    ]));

    const result = await buildCompactPartnerCatalog([PARTNER_WITH_DOMAINS]);
    expect(result).toContain('"CyberShield"');
    expect(result).toContain("id: partner-001");
    expect(result).toContain("Domains:");
    expect(result).toContain("cybershield.com");
  });

  it("deduplicates domains from multiple emails", async () => {
    mockGetPartnerContactDomains.mockResolvedValue(new Map([
      ["cybershield.com", { partnerId: "partner-001", partnerName: "CyberShield" }],
      ["cybershield.io", { partnerId: "partner-001", partnerName: "CyberShield" }],
    ]));

    const result = await buildCompactPartnerCatalog([PARTNER_WITH_DOMAINS]);
    // cybershield.com appears twice in emails but should only appear once
    const domainMatches = result.match(/cybershield\.com/g);
    expect(domainMatches).toHaveLength(1);
    // cybershield.io should also appear
    expect(result).toContain("cybershield.io");
  });

  it("excludes partners with no contact emails", async () => {
    mockGetPartnerContactDomains.mockResolvedValue(new Map([
      ["cybershield.com", { partnerId: "partner-001", partnerName: "CyberShield" }],
      ["cybershield.io", { partnerId: "partner-001", partnerName: "CyberShield" }],
    ]));

    const result = await buildCompactPartnerCatalog([PARTNER_WITH_DOMAINS, PARTNER_NO_EMAILS]);
    expect(result).toContain("CyberShield");
    expect(result).not.toContain("GhostCorp");
  });

  it("excludes partners with empty contact emails array", async () => {
    mockGetPartnerContactDomains.mockResolvedValue(new Map());

    const result = await buildCompactPartnerCatalog([PARTNER_EMPTY_EMAILS]);
    expect(result).not.toContain("EmptyDomains");
  });

  it("returns 'None yet' when no partners have domains", async () => {
    mockGetPartnerContactDomains.mockResolvedValue(new Map());

    const result = await buildCompactPartnerCatalog([PARTNER_NO_EMAILS, PARTNER_EMPTY_EMAILS]);
    expect(result).toContain("None yet.");
  });
});

describe("buildPhase1Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveEngagements.mockResolvedValue([ENGAGEMENT_A]);
    mockGetPartners.mockResolvedValue([PARTNER_WITH_DOMAINS]);
    mockGetPartnerContactDomains.mockResolvedValue(new Map([
      ["cybershield.com", { partnerId: "partner-001", partnerName: "CyberShield" }],
      ["cybershield.io", { partnerId: "partner-001", partnerName: "CyberShield" }],
    ]));
  });

  it("includes compact forwarder section", async () => {
    const result = await buildPhase1Context([makeMessage()]);
    expect(result).toContain("## Forwarder");
    expect(result).toContain("Steven Romero");
    expect(result).toContain("sterme@amazon.com");
    // Should NOT include the verbose section fields
    expect(result).not.toContain("Forwarder Identity");
    expect(result).not.toContain("Segment:");
  });

  it("includes forwarder note when provided", async () => {
    const result = await buildPhase1Context([makeMessage()], "Urgent deal");
    expect(result).toContain("Note: Urgent deal");
  });

  it("includes engagement index", async () => {
    const result = await buildPhase1Context([makeMessage()]);
    expect(result).toContain("## Engagement Index");
    expect(result).toContain("CyberShield - Security Review");
  });

  it("includes partner catalog", async () => {
    const result = await buildPhase1Context([makeMessage()]);
    expect(result).toContain("## Partner Catalog");
    expect(result).toContain("CyberShield");
    expect(result).toContain("cybershield.com");
  });

  it("includes email content via buildEmailSection", async () => {
    const msg = makeMessage({ subject: "Important Update", body_text: "Deal closing soon." });
    const result = await buildPhase1Context([msg]);
    expect(result).toContain("## Email to Classify");
    expect(result).toContain("Important Update");
    expect(result).toContain("Deal closing soon.");
    expect(result).toContain("alice@cybershield.com");
  });

  it("does NOT include events, programs, or relationships sections", async () => {
    const result = await buildPhase1Context([makeMessage()]);
    expect(result).not.toContain("Tracked Events");
    expect(result).not.toContain("Active Programs");
    expect(result).not.toContain("AWS Relationships");
  });

  it("includes engagement context from current_state", async () => {
    mockGetActiveEngagements.mockResolvedValue([ENGAGEMENT_A]);
    const result = await buildPhase1Context([makeMessage()]);
    expect(result).toContain("Context: Pursuing Security Competency.");
  });
});

describe("parsePhase1Response", () => {
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
  });

  it("parses valid JSON", () => {
    const result = parsePhase1Response(validJson);
    expect(result.content_type).toBe("engagement_email");
    expect(result.engagement_match.id).toBe("eng-001");
    expect(result.engagement_match.confidence).toBe(0.95);
    expect(result.engagement_match.is_new).toBe(false);
    expect(result.engagement_match.partner_name).toBe("CyberShield");
    expect(result.engagement_match.partner_id).toBe("partner-001");
  });

  it("strips ```json ... ``` wrapping", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const result = parsePhase1Response(wrapped);
    expect(result.content_type).toBe("engagement_email");
  });

  it("strips bare ``` wrapping", () => {
    const wrapped = "```\n" + validJson + "\n```";
    const result = parsePhase1Response(wrapped);
    expect(result.content_type).toBe("engagement_email");
  });

  it("handles leading/trailing whitespace", () => {
    const padded = "\n  " + validJson + "  \n";
    const result = parsePhase1Response(padded);
    expect(result.content_type).toBe("engagement_email");
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePhase1Response("not json")).toThrow();
  });

  it("defaults partner_id to null when omitted", () => {
    const json = JSON.stringify({
      content_type: "noise",
      engagement_match: {
        id: null,
        name: "",
        confidence: 1.0,
        is_new: false,
        partner_name: null,
      },
    });
    const result = parsePhase1Response(json);
    expect(result.engagement_match.partner_id).toBeNull();
  });

  it("defaults engagement_match when omitted", () => {
    const json = JSON.stringify({ content_type: "noise" });
    const result = parsePhase1Response(json);
    expect(result.engagement_match.id).toBeNull();
    expect(result.engagement_match.confidence).toBe(0);
    expect(result.engagement_match.is_new).toBe(false);
  });
});

// ============================================================
// buildMeetingHint
// ============================================================

describe("buildMeetingHint", () => {
  const MEETING: Meeting & { partner_name: string | null } = {
    id: "mtg-001",
    title: "Security Review Sync",
    engagement_id: null,
    partner_name: "CyberShield",
    partner_id: "partner-001",
    message_id: "msg-001",
    status: "scheduled",
    meeting_date: "2026-03-15",
    start_time: "10:00",
    end_time: "11:00",
    location: "Chime",
    organizer_email: "sterme@amazon.com",
    organizer_name: "Steven Romero",
    attendees: [
      { name: "Steven Romero", email: "sterme@amazon.com" },
      { name: "Alice Chen", email: "alice@cybershield.com" },
    ],
    ics_uid: "uid-123",
    sequence: 0,
    is_recurring: false,
    source: "ics_parsed",
    meeting_type: null,
    notes: null,
    airtable_record_id: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
  };

  it("includes partner hint with id", () => {
    const result = buildMeetingHint([MEETING]);
    expect(result).toContain("Meeting Data (from calendar invite)");
    expect(result).toContain("**Partner Hint:** CyberShield (id: partner-001)");
  });

  it("includes organizer and attendee list", () => {
    const result = buildMeetingHint([MEETING]);
    expect(result).toContain("**Organizer:** sterme@amazon.com");
    expect(result).toContain("**Attendees:**");
    expect(result).toContain("Steven Romero <sterme@amazon.com>");
    expect(result).toContain("Alice Chen <alice@cybershield.com>");
  });

  it("includes recurring flag when true", () => {
    const recurring = { ...MEETING, is_recurring: true };
    const result = buildMeetingHint([recurring]);
    expect(result).toContain("**Recurring:** Yes");
  });

  it("omits recurring flag when false", () => {
    const result = buildMeetingHint([MEETING]);
    expect(result).not.toContain("Recurring");
  });

  it("omits partner hint when no partner matched", () => {
    const noPartner = { ...MEETING, partner_name: null, partner_id: null };
    const result = buildMeetingHint([noPartner]);
    expect(result).not.toContain("Partner Hint");
    expect(result).toContain("**Attendees:**");
  });

  it("returns empty string when no meetings", () => {
    expect(buildMeetingHint([])).toBe("");
  });
});

// ============================================================
// truncateToWords
// ============================================================

describe("truncateToWords", () => {
  it("returns text unchanged when under word limit", () => {
    expect(truncateToWords("hello world", 10)).toBe("hello world");
  });

  it("returns text unchanged when exactly at word limit", () => {
    expect(truncateToWords("one two three", 3)).toBe("one two three");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(truncateToWords("one two three four five", 3)).toBe("one two three…");
  });

  it("handles empty string", () => {
    expect(truncateToWords("", 10)).toBe("");
  });
});

// ============================================================
// Prompt design: single-engagement partner with unrelated email
// ============================================================

describe("prompt design — new engagement detection", () => {
  it("engagement index provides enough context for topic mismatch detection", () => {
    // Scenario: Spacelift has one engagement about DevOps/OpenTofu.
    // A Solution Spotlight email arrives — completely different initiative.
    // The engagement index must include enough semantic context for the AI
    // to recognize the mismatch and classify as is_new: true.
    const spaceliftEngagement: EngagementWithPartner = {
      id: "eng-spacelift-001",
      name: "Spacelift - DevOps and OpenTofu Collaboration",
      status: "active",
      current_state: "Technical collaboration with AWS IaC team on OpenTofu support. Spacelift integrating with AWS CloudFormation and Terraform workflows. Joint blog post in review.",
      topic: "DevOps and OpenTofu Collaboration",
      goal: "Establish technical and commercial collaboration around DevOps tooling.",
      partner_name: "Spacelift",
      partner_id: "partner-spacelift",
      pillar: "Co-Build",
      program_id: null,
      airtable_record_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-02-15T00:00:00Z",
      closed_at: null,
    };

    const lastSubjects = new Map([["eng-spacelift-001", "Re: OpenTofu integration update"]]);
    const result = buildEngagementIndex([spaceliftEngagement], lastSubjects);

    // The index must include enough information for the AI to see that
    // a "Solution Spotlight" email (Co-Market, Bridge Partners, Marketplace listing)
    // is a completely different initiative than what this engagement describes
    expect(result).toContain('Topic: "DevOps and OpenTofu Collaboration"');
    expect(result).toContain('Goal: "Establish technical and commercial collaboration around DevOps tooling."');
    expect(result).toContain("Context: Technical collaboration with AWS IaC team on OpenTofu support.");
    expect(result).toContain("Pillar: Co-Build");
    expect(result).toContain('Last Subject: "Re: OpenTofu integration update"');
  });

  it("prompt instructs AI to evaluate content match, not engagement count", () => {
    // The decision framework must require content evaluation for ALL partners,
    // regardless of how many engagements they have
    expect(PHASE1_SYSTEM_PROMPT).toContain("Evaluate against ALL engagements");
    expect(PHASE1_SYSTEM_PROMPT).toContain("number of engagements a partner has is IRRELEVANT");

    // New engagement detection must be explicit about what makes engagements distinct
    expect(PHASE1_SYSTEM_PROMPT).toContain("Different project/campaign name");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Different external parties");
    expect(PHASE1_SYSTEM_PROMPT).toContain("Different pillar");
  });
});
