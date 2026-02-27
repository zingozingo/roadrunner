import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, Engagement, Partner } from "../types";

// ============================================================
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ============================================================

const {
  mockGetActiveEngagements,
  mockGetPartners,
  mockFrom,
} = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockIn = vi.fn().mockReturnValue({ order: mockOrder });
  const mockSelect = vi.fn().mockReturnValue({ in: mockIn });

  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return {
    mockGetActiveEngagements: vi.fn().mockResolvedValue([]),
    mockGetPartners: vi.fn().mockResolvedValue([]),
    mockFrom,
  };
});

vi.mock("../supabase", () => ({
  getActiveEngagements: mockGetActiveEngagements,
  getPartners: mockGetPartners,
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
  parsePhase1Response,
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

const ENGAGEMENT_A: Engagement = {
  id: "eng-001",
  name: "CyberShield - Security Review",
  status: "active",
  current_state: "Pursuing Security Competency.",
  topic: null,
  goal: null,
  engagement_type: null,
  partner_name: "CyberShield",
  partner_id: "partner-001",
  pillar: "Co-Sell",
  airtable_record_id: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  closed_at: null,
};

const ENGAGEMENT_B: Engagement = {
  id: "eng-002",
  name: "NinjaOne - NFL Partnership",
  status: "active",
  current_state: null,
  topic: null,
  goal: null,
  engagement_type: null,
  partner_name: "NinjaOne",
  partner_id: "partner-002",
  pillar: null,
  airtable_record_id: null,
  created_at: "2026-01-20T00:00:00Z",
  updated_at: "2026-02-15T00:00:00Z",
  closed_at: null,
};

const PARTNER_WITH_DOMAINS: Partner = {
  id: "partner-001",
  name: "CyberShield",
  segment: "security",
  focus_area: [],
  alliance_lead: "Steven Romero",
  alliance_lead_email: "sterme@amazon.com",
  psa: null,
  psa_email: null,
  account_manager: null,
  account_manager_email: null,
  pmm: null,
  pmm_email: null,
  spms_id: null,
  partner_contact_emails: ["alice@cybershield.com", "bob@cybershield.com", "carol@cybershield.io"],
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
  alliance_lead: null,
  alliance_lead_email: null,
  psa: null,
  psa_email: null,
  account_manager: null,
  account_manager_email: null,
  pmm: null,
  pmm_email: null,
  spms_id: null,
  partner_contact_emails: null,
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
  partner_contact_emails: [],
};

// ============================================================
// Tests
// ============================================================

describe("PHASE1_SYSTEM_PROMPT", () => {
  it("contains subject line matching guidance", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("Subject line matching");
  });

  it("specifies JSON response format", () => {
    expect(PHASE1_SYSTEM_PROMPT).toContain("Return ONLY valid JSON");
    expect(PHASE1_SYSTEM_PROMPT).toContain("content_type");
    expect(PHASE1_SYSTEM_PROMPT).toContain("engagement_match");
  });
});

describe("buildEngagementIndex", () => {
  it("produces one line per engagement with correct fields", () => {
    const lastSubjects = new Map([
      ["eng-001", "Re: Security Review Next Steps"],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A], lastSubjects);

    expect(result).toContain('"CyberShield - Security Review"');
    expect(result).toContain("id: eng-001");
    expect(result).toContain("Partner: CyberShield");
    expect(result).toContain('Subject: "Re: Security Review Next Steps"');
  });

  it("includes last_subject from most recent message", () => {
    const lastSubjects = new Map([
      ["eng-001", "Re: FedRAMP timeline"],
      ["eng-002", "NFL sponsorship update"],
    ]);
    const result = buildEngagementIndex([ENGAGEMENT_A, ENGAGEMENT_B], lastSubjects);

    expect(result).toContain('Subject: "Re: FedRAMP timeline"');
    expect(result).toContain('Subject: "NFL sponsorship update"');
  });

  it("shows (none) when engagement has no messages", () => {
    const result = buildEngagementIndex([ENGAGEMENT_A], new Map());
    expect(result).toContain('Subject: "(none)"');
  });

  it("returns 'None yet' when no engagements exist", () => {
    const result = buildEngagementIndex([], new Map());
    expect(result).toContain("None yet.");
  });
});

describe("buildCompactPartnerCatalog", () => {
  it("includes partners with domains", () => {
    const result = buildCompactPartnerCatalog([PARTNER_WITH_DOMAINS]);
    expect(result).toContain('"CyberShield"');
    expect(result).toContain("id: partner-001");
    expect(result).toContain("Domains:");
    expect(result).toContain("cybershield.com");
  });

  it("deduplicates domains from multiple emails", () => {
    const result = buildCompactPartnerCatalog([PARTNER_WITH_DOMAINS]);
    // cybershield.com appears twice in emails but should only appear once
    const domainMatches = result.match(/cybershield\.com/g);
    expect(domainMatches).toHaveLength(1);
    // cybershield.io should also appear
    expect(result).toContain("cybershield.io");
  });

  it("excludes partners with no contact emails", () => {
    const result = buildCompactPartnerCatalog([PARTNER_WITH_DOMAINS, PARTNER_NO_EMAILS]);
    expect(result).toContain("CyberShield");
    expect(result).not.toContain("GhostCorp");
  });

  it("excludes partners with empty contact emails array", () => {
    const result = buildCompactPartnerCatalog([PARTNER_EMPTY_EMAILS]);
    expect(result).not.toContain("EmptyDomains");
  });

  it("returns 'None yet' when no partners have domains", () => {
    const result = buildCompactPartnerCatalog([PARTNER_NO_EMAILS, PARTNER_EMPTY_EMAILS]);
    expect(result).toContain("None yet.");
  });
});

describe("buildPhase1Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveEngagements.mockResolvedValue([ENGAGEMENT_A]);
    mockGetPartners.mockResolvedValue([PARTNER_WITH_DOMAINS]);
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

  it("does NOT include current_state or open_items", async () => {
    const result = await buildPhase1Context([makeMessage()]);
    expect(result).not.toContain("Current state:");
    expect(result).not.toContain("Open items:");
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
