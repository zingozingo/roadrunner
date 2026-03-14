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
    if (table === "relationships") return mockTableData(table, relationships);
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

  it("builds map from relationship contacts JSONB", async () => {
    setupMockTables(
      [],
      [
        {
          contacts: [
            { name: "Dana Wright", email: "dana@amazon.com", title: null, role: "Lead Contact" },
            { name: null, email: "team@amazon.com", title: null, role: "Team Member" },
          ],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("dana@amazon.com")).toEqual({
      name: "Dana Wright",
      source: "relationship",
    });
    // team@amazon.com has no name, so NOT added
    expect(map.emailToName.has("team@amazon.com")).toBe(false);
  });

  it("builds map from partner partner_contacts JSONB", async () => {
    setupMockTables([], [], [
      {
        name: "CyberShield",
        aws_team: [],
        partner_contacts: [
          { name: "Eve Torres", email: "eve@cybershield.io", title: "CTO", role: "Alliance Lead" },
        ],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("eve@cybershield.io")).toEqual({
      name: "Eve Torres",
      source: "partner",
    });
  });

  it("respects priority: relationship wins over participant and partner", async () => {
    setupMockTables(
      [{ email: "alice@partner.com", name: "Alice (Participant)" }],
      [
        {
          contacts: [
            { name: "Alice (Relationship)", email: "alice@partner.com", title: null, role: "Lead Contact" },
          ],
        },
      ],
      [
        {
          name: "PartnerCo",
          aws_team: [],
          partner_contacts: [
            { name: "Alice (Partner)", email: "alice@partner.com", title: null, role: "Alliance Lead" },
          ],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("alice@partner.com")).toEqual({
      name: "Alice (Relationship)",
      source: "relationship",
    });
  });

  it("respects priority: partner wins over participant", async () => {
    setupMockTables(
      [{ email: "bob@aws.com", name: "Bob (Participant)" }],
      [],
      [
        {
          name: "AWS",
          aws_team: [
            { name: "Bob (Partner)", email: "bob@aws.com", title: null, role: "PSA" },
          ],
          partner_contacts: [],
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
          contacts: [
            { name: "Bob (Relationship)", email: "bob@aws.com", title: null, role: "Lead Contact" },
          ],
        },
      ],
      [
        {
          name: "AWS",
          aws_team: [
            { name: "Bob (Partner)", email: "bob@aws.com", title: null, role: "PSA" },
          ],
          partner_contacts: [],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("bob@aws.com")).toEqual({
      name: "Bob (Relationship)",
      source: "relationship",
    });
  });

  it("catalog name wins over participant name for same email", async () => {
    setupMockTables(
      [{ email: "crisresl@amazon.com", name: "Cris R" }],
      [
        {
          contacts: [
            { name: "Cristian Restrepo Lopez", email: "crisresl@amazon.com", title: null, role: "Lead Contact" },
          ],
        },
      ],
      []
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("crisresl@amazon.com")).toEqual({
      name: "Cristian Restrepo Lopez",
      source: "relationship",
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

  it("builds domain→org map from partner_contacts JSONB emails", async () => {
    setupMockTables([], [], [
      {
        name: "NinjaOne",
        aws_team: [],
        partner_contacts: [
          { name: "John", email: "john@ninjaone.com", title: null, role: "Contact" },
          { name: "Jane", email: "jane@ninjaone.com", title: null, role: "Contact" },
        ],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("ninjaone.com")).toBe("NinjaOne");
  });

  it("builds domain→org map from partner_contacts alliance lead email domain", async () => {
    setupMockTables([], [], [
      {
        name: "CyberShield",
        aws_team: [],
        partner_contacts: [
          { name: "Eve Torres", email: "eve@cybershield.io", title: null, role: "Alliance Lead" },
        ],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("cybershield.io")).toBe("CyberShield");
  });

  it("resolves account_manager from aws_team JSONB", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        aws_team: [
          { name: "Sam Wilson", email: "sam@acme.com", title: null, role: "Account Manager" },
        ],
        partner_contacts: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("sam@acme.com")).toEqual({
      name: "Sam Wilson",
      source: "partner",
    });
  });

  it("resolves psa from aws_team JSONB", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        aws_team: [
          { name: "Tina Fey", email: "tina@acme.com", title: null, role: "PSA" },
        ],
        partner_contacts: [],
      },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("tina@acme.com")).toEqual({
      name: "Tina Fey",
      source: "partner",
    });
  });

  it("resolves pmm from aws_team JSONB", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        aws_team: [
          { name: "Ray Park", email: "ray@acme.com", title: null, role: "PMM" },
        ],
        partner_contacts: [],
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
        aws_team: [
          { name: "B Psa", email: "psa@psadomain.com", title: null, role: "PSA" },
          { name: "C AM", email: "am@amdomain.com", title: null, role: "Account Manager" },
          { name: "D PMM", email: "pmm@pmmdomain.com", title: null, role: "PMM" },
        ],
        partner_contacts: [
          { name: "A Lead", email: "lead@multicontact.com", title: null, role: "Alliance Lead" },
        ],
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
          aws_team: [
            { name: "Sam Wilson", email: "sam@acme.com", title: null, role: "Account Manager" },
          ],
          partner_contacts: [],
        },
      ]
    );

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("sam@acme.com")).toEqual({
      name: "Sam Wilson",
      source: "partner",
    });
  });

  it("skips JSONB contacts where email or name is null", async () => {
    setupMockTables([], [], [
      {
        name: "Acme Corp",
        aws_team: [
          { name: null, email: "orphan@acme.com", title: null, role: "PSA" },
          { name: "No Email AM", email: null, title: null, role: "Account Manager" },
        ],
        partner_contacts: [],
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
        aws_team: [],
        partner_contacts: [
          { name: "Joe", email: "joe@gmail.com", title: null, role: "Alliance Lead" },
          { name: "Jane", email: "jane@yahoo.com", title: null, role: "Contact" },
          { name: "Jill", email: "jill@outlook.com", title: null, role: "Contact" },
        ],
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
      ["bob@aws.com", { name: "Bob Lee", source: "relationship" }],
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
