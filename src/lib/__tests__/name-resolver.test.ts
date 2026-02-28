import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NameResolutionMap } from "../name-resolver";

// ============================================================
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ============================================================

const { mockFrom } = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
  };
});

vi.mock("../db", () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

import {
  buildNameResolutionMap,
  resolveNameByEmail,
  resolveOrgByDomain,
} from "../name-resolver";

// ============================================================
// Helpers
// ============================================================

function mockTableData(table: string, data: Record<string, unknown>[]) {
  return {
    select: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function setupMockTables(
  participants: Record<string, unknown>[] = [],
  relationships: Record<string, unknown>[] = [],
  partners: Record<string, unknown>[] = []
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "participants") return mockTableData(table, participants);
    if (table === "aws_relationships") return mockTableData(table, relationships);
    if (table === "partners") return mockTableData(table, partners);
    return mockTableData(table, []);
  });
}

// ============================================================
// Tests
// ============================================================

describe("buildNameResolutionMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds map from participant data", async () => {
    setupMockTables([
      { email: "alice@partner.com", name: "Alice Chen" },
      { email: "bob@aws.com", name: "Bob Lee" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("alice@partner.com")).toEqual({
      name: "Alice Chen",
      source: "participant",
    });
    expect(map.emailToName.get("bob@aws.com")).toEqual({
      name: "Bob Lee",
      source: "participant",
    });
  });

  it("builds map from aws_relationship primary contacts", async () => {
    setupMockTables(
      [],
      [
        {
          primary_contact_name: "Dana Wright",
          primary_contact_email: "dana@amazon.com",
          aws_contact_emails: ["team@amazon.com"],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("dana@amazon.com")).toEqual({
      name: "Dana Wright",
      source: "aws_relationship",
    });
    // aws_contact_emails without names are NOT added
    expect(map.emailToName.has("team@amazon.com")).toBe(false);
  });

  it("builds map from partner alliance leads", async () => {
    setupMockTables([], [], [
      {
        name: "CyberShield",
        alliance_lead: "Eve Torres",
        alliance_lead_email: "eve@cybershield.io",
        partner_contact_emails: ["support@cybershield.io"],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("eve@cybershield.io")).toEqual({
      name: "Eve Torres",
      source: "partner",
    });
  });

  it("respects priority: aws_relationship wins over participant and partner", async () => {
    setupMockTables(
      [{ email: "alice@partner.com", name: "Alice (Participant)" }],
      [
        {
          primary_contact_name: "Alice (Relationship)",
          primary_contact_email: "alice@partner.com",
          aws_contact_emails: [],
        },
      ],
      [
        {
          name: "PartnerCo",
          alliance_lead: "Alice (Partner)",
          alliance_lead_email: "alice@partner.com",
          partner_contact_emails: [],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("alice@partner.com")).toEqual({
      name: "Alice (Relationship)",
      source: "aws_relationship",
    });
  });

  it("respects priority: partner wins over participant", async () => {
    setupMockTables(
      [{ email: "bob@aws.com", name: "Bob (Participant)" }],
      [],
      [
        {
          name: "AWS",
          alliance_lead: "Bob (Partner)",
          alliance_lead_email: "bob@aws.com",
          partner_contact_emails: [],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("bob@aws.com")).toEqual({
      name: "Bob (Partner)",
      source: "partner",
    });
  });

  it("respects priority: relationship wins over partner (no participants)", async () => {
    setupMockTables(
      [],
      [
        {
          primary_contact_name: "Bob (Relationship)",
          primary_contact_email: "bob@aws.com",
          aws_contact_emails: [],
        },
      ],
      [
        {
          name: "AWS",
          alliance_lead: "Bob (Partner)",
          alliance_lead_email: "bob@aws.com",
          partner_contact_emails: [],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("bob@aws.com")).toEqual({
      name: "Bob (Relationship)",
      source: "aws_relationship",
    });
  });

  it("catalog name wins over participant name for same email", async () => {
    // Simulates: crisresl@amazon.com is in aws_relationships as "Cristian Restrepo Lopez"
    // AND in participants as "Cris R" — catalog (aws_relationship) must win
    setupMockTables(
      [{ email: "crisresl@amazon.com", name: "Cris R" }],
      [
        {
          primary_contact_name: "Cristian Restrepo Lopez",
          primary_contact_email: "crisresl@amazon.com",
          aws_contact_emails: [],
        },
      ],
      []
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("crisresl@amazon.com")).toEqual({
      name: "Cristian Restrepo Lopez",
      source: "aws_relationship",
    });
  });

  it("skips participants with null email or name", async () => {
    setupMockTables([
      { email: null, name: "No Email" },
      { email: "noname@test.com", name: null },
      { email: "valid@test.com", name: "Valid Person" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.size).toBe(1);
    expect(map.emailToName.has("valid@test.com")).toBe(true);
  });

  it("builds domain→org map from partner contact emails", async () => {
    setupMockTables([], [], [
      {
        name: "NinjaOne",
        alliance_lead: null,
        alliance_lead_email: null,
        partner_contact_emails: ["john@ninjaone.com", "jane@ninjaone.com"],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("ninjaone.com")).toBe("NinjaOne");
  });

  it("builds domain→org map from alliance lead email domain", async () => {
    setupMockTables([], [], [
      {
        name: "CyberShield",
        alliance_lead: "Eve Torres",
        alliance_lead_email: "eve@cybershield.io",
        partner_contact_emails: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("cybershield.io")).toBe("CyberShield");
  });

  it("resolves account_manager_email → account_manager name", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        alliance_lead: null,
        alliance_lead_email: null,
        psa: null,
        psa_email: null,
        account_manager: "Sam Wilson",
        account_manager_email: "sam@acme.com",
        pmm: null,
        pmm_email: null,
        partner_contact_emails: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("sam@acme.com")).toEqual({
      name: "Sam Wilson",
      source: "partner",
    });
  });

  it("resolves psa_email → psa name", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        alliance_lead: null,
        alliance_lead_email: null,
        psa: "Tina Fey",
        psa_email: "tina@acme.com",
        account_manager: null,
        account_manager_email: null,
        pmm: null,
        pmm_email: null,
        partner_contact_emails: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("tina@acme.com")).toEqual({
      name: "Tina Fey",
      source: "partner",
    });
  });

  it("resolves pmm_email → pmm name", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        alliance_lead: null,
        alliance_lead_email: null,
        psa: null,
        psa_email: null,
        account_manager: null,
        account_manager_email: null,
        pmm: "Ray Park",
        pmm_email: "ray@acme.com",
        partner_contact_emails: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("ray@acme.com")).toEqual({
      name: "Ray Park",
      source: "partner",
    });
  });

  it("all partner contact emails contribute to domain→org map", async () => {
    setupMockTables([], [], [
      {
        name: "MultiContact Inc",
        alliance_lead: "A Lead",
        alliance_lead_email: "lead@multicontact.com",
        psa: "B Psa",
        psa_email: "psa@psadomain.com",
        account_manager: "C AM",
        account_manager_email: "am@amdomain.com",
        pmm: "D PMM",
        pmm_email: "pmm@pmmdomain.com",
        partner_contact_emails: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("multicontact.com")).toBe("MultiContact Inc");
    expect(map.domainToOrg.get("psadomain.com")).toBe("MultiContact Inc");
    expect(map.domainToOrg.get("amdomain.com")).toBe("MultiContact Inc");
    expect(map.domainToOrg.get("pmmdomain.com")).toBe("MultiContact Inc");
  });

  it("partner contacts (all roles) beat participants", async () => {
    setupMockTables(
      [{ email: "sam@acme.com", name: "Sam (Participant)" }],
      [],
      [
        {
          name: "Acme Corp",
          alliance_lead: null,
          alliance_lead_email: null,
          psa: null,
          psa_email: null,
          account_manager: "Sam Wilson",
          account_manager_email: "sam@acme.com",
          pmm: null,
          pmm_email: null,
          partner_contact_emails: [],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("sam@acme.com")).toEqual({
      name: "Sam Wilson",
      source: "partner",
    });
  });

  it("skips partner contact pairs where email or name is null", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        alliance_lead: null,
        alliance_lead_email: null,
        psa: null,
        psa_email: "orphan@acme.com",  // email present but name null
        account_manager: "No Email AM",
        account_manager_email: null,     // name present but email null
        pmm: null,
        pmm_email: null,
        partner_contact_emails: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.has("orphan@acme.com")).toBe(false);
    expect(map.emailToName.size).toBe(0);
  });

  it("excludes personal email domains from domain→org map", async () => {
    setupMockTables([], [], [
      {
        name: "SomePartner",
        alliance_lead: "Joe",
        alliance_lead_email: "joe@gmail.com",
        partner_contact_emails: ["jane@yahoo.com", "jill@outlook.com"],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.has("gmail.com")).toBe(false);
    expect(map.domainToOrg.has("yahoo.com")).toBe(false);
    expect(map.domainToOrg.has("outlook.com")).toBe(false);
  });

  it("handles empty tables gracefully", async () => {
    setupMockTables([], [], []);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.size).toBe(0);
    expect(map.domainToOrg.size).toBe(0);
  });

  it("normalizes email keys to lowercase", async () => {
    setupMockTables([
      { email: "Alice@Partner.COM", name: "Alice Chen" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.has("alice@partner.com")).toBe(true);
    expect(map.emailToName.has("Alice@Partner.COM")).toBe(false);
  });
});

describe("resolveNameByEmail", () => {
  const map: NameResolutionMap = {
    emailToName: new Map([
      ["alice@partner.com", { name: "Alice Chen", source: "participant" }],
      ["bob@aws.com", { name: "Bob Lee", source: "aws_relationship" }],
    ]),
    domainToOrg: new Map(),
  };

  it("returns resolved name for known email", () => {
    expect(resolveNameByEmail("alice@partner.com", map)).toEqual({
      name: "Alice Chen",
      source: "participant",
    });
  });

  it("returns null for unknown email", () => {
    expect(resolveNameByEmail("unknown@test.com", map)).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(resolveNameByEmail("Alice@Partner.COM", map)).toEqual({
      name: "Alice Chen",
      source: "participant",
    });
  });

  it("returns null for empty string", () => {
    expect(resolveNameByEmail("", map)).toBeNull();
  });
});

describe("resolveOrgByDomain", () => {
  const map: NameResolutionMap = {
    emailToName: new Map(),
    domainToOrg: new Map([
      ["ninjaone.com", "NinjaOne"],
      ["cybershield.io", "CyberShield"],
    ]),
  };

  it("returns org for known domain", () => {
    expect(resolveOrgByDomain("john@ninjaone.com", map)).toBe("NinjaOne");
  });

  it("returns null for unknown domain", () => {
    expect(resolveOrgByDomain("john@unknown.com", map)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveOrgByDomain("", map)).toBeNull();
  });

  it("returns null for invalid email without @", () => {
    expect(resolveOrgByDomain("not-an-email", map)).toBeNull();
  });

  it("matches domain case-insensitively (domain extracted as lowercase)", () => {
    expect(resolveOrgByDomain("john@NinjaOne.COM", map)).toBe("NinjaOne");
  });
});
