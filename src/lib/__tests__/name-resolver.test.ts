import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NameResolutionMap } from "../name-resolver";

// ============================================================
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ============================================================

const { mockGetAllParticipants } = vi.hoisted(() => {
  return {
    mockGetAllParticipants: vi.fn(),
  };
});

vi.mock("../db/participants", () => ({
  getAllParticipantsForNameResolution: mockGetAllParticipants,
}));

import {
  buildNameResolutionMap,
  resolveNameByEmail,
  resolveOrgByDomain,
} from "../name-resolver";

// ============================================================
// Helpers
// ============================================================

/**
 * The new buildNameResolutionMap() queries only the "participants" table
 * with columns: email, name, organization, source.
 *
 * Source mapping:
 *   participant.source === "airtable_sync" → ResolvedName.source = "partner"
 *   anything else                          → ResolvedName.source = "participant"
 *
 * Domain→org comes from participant.organization field.
 */

interface ParticipantRow {
  email: string | null;
  name: string | null;
  organization?: string | null;
  source?: string | null;
}

function setupParticipants(rows: ParticipantRow[]) {
  mockGetAllParticipants.mockResolvedValue(rows);
}

// ============================================================
// Tests
// ============================================================

describe("buildNameResolutionMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds map from participant data", async () => {
    setupParticipants([
      { email: "alice@partner.com", name: "Alice Chen", source: "ai_extracted" },
      { email: "bob@aws.com", name: "Bob Lee", source: "ai_extracted" },
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

  it("maps airtable_sync source to 'partner' resolved source", async () => {
    setupParticipants([
      { email: "dana@amazon.com", name: "Dana Wright", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("dana@amazon.com")).toEqual({
      name: "Dana Wright",
      source: "partner",
    });
  });

  it("maps non-airtable_sync sources to 'participant' resolved source", async () => {
    setupParticipants([
      { email: "eve@cybershield.io", name: "Eve Torres", source: "ai_extracted", organization: "CyberShield" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("eve@cybershield.io")).toEqual({
      name: "Eve Torres",
      source: "participant",
    });
  });

  it("first entry wins for duplicate emails (airtable_sync wins when first)", async () => {
    setupParticipants([
      { email: "alice@partner.com", name: "Alice (Catalog)", source: "airtable_sync" },
      { email: "alice@partner.com", name: "Alice (AI)", source: "ai_extracted" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("alice@partner.com")).toEqual({
      name: "Alice (Catalog)",
      source: "partner",
    });
  });

  it("first entry wins for duplicate emails (ai_extracted wins when first)", async () => {
    setupParticipants([
      { email: "bob@aws.com", name: "Bob (AI)", source: "ai_extracted" },
      { email: "bob@aws.com", name: "Bob (Catalog)", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("bob@aws.com")).toEqual({
      name: "Bob (AI)",
      source: "participant",
    });
  });

  it("catalog name wins when listed first for same email", async () => {
    setupParticipants([
      { email: "crisresl@amazon.com", name: "Cristian Restrepo Lopez", source: "airtable_sync" },
      { email: "crisresl@amazon.com", name: "Cris R", source: "ai_extracted" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("crisresl@amazon.com")).toEqual({
      name: "Cristian Restrepo Lopez",
      source: "partner",
    });
  });

  it("skips participants with null email or name", async () => {
    setupParticipants([
      { email: null, name: "No Email" },
      { email: "noname@test.com", name: null },
      { email: "valid@test.com", name: "Valid Person" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.size).toBe(1);
    expect(map.emailToName.has("valid@test.com")).toBe(true);
  });

  it("builds domain→org map from participant organization field", async () => {
    setupParticipants([
      { email: "john@ninjaone.com", name: "John", organization: "NinjaOne", source: "airtable_sync" },
      { email: "jane@ninjaone.com", name: "Jane", organization: "NinjaOne", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("ninjaone.com")).toBe("NinjaOne");
  });

  it("builds domain→org from organization field", async () => {
    setupParticipants([
      { email: "eve@cybershield.io", name: "Eve Torres", organization: "CyberShield", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("cybershield.io")).toBe("CyberShield");
  });

  it("resolves airtable_sync contacts as 'partner' source", async () => {
    setupParticipants([
      { email: "sam@acme.com", name: "Sam Wilson", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("sam@acme.com")).toEqual({
      name: "Sam Wilson",
      source: "partner",
    });
  });

  it("resolves ai_extracted contacts as 'participant' source", async () => {
    setupParticipants([
      { email: "tina@acme.com", name: "Tina Fey", source: "ai_extracted" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("tina@acme.com")).toEqual({
      name: "Tina Fey",
      source: "participant",
    });
  });

  it("resolves contacts with null source as 'participant'", async () => {
    setupParticipants([
      { email: "ray@acme.com", name: "Ray Park", source: null },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("ray@acme.com")).toEqual({
      name: "Ray Park",
      source: "participant",
    });
  });

  it("all participant org fields contribute to domain→org map", async () => {
    setupParticipants([
      { email: "lead@multicontact.com", name: "A Lead", organization: "MultiContact Inc", source: "airtable_sync" },
      { email: "psa@psadomain.com", name: "B Psa", organization: "MultiContact Inc", source: "airtable_sync" },
      { email: "am@amdomain.com", name: "C AM", organization: "MultiContact Inc", source: "airtable_sync" },
      { email: "pmm@pmmdomain.com", name: "D PMM", organization: "MultiContact Inc", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.get("multicontact.com")).toBe("MultiContact Inc");
    expect(map.domainToOrg.get("psadomain.com")).toBe("MultiContact Inc");
    expect(map.domainToOrg.get("amdomain.com")).toBe("MultiContact Inc");
    expect(map.domainToOrg.get("pmmdomain.com")).toBe("MultiContact Inc");
  });

  it("airtable_sync source beats ai_extracted when first", async () => {
    setupParticipants([
      { email: "sam@acme.com", name: "Sam Wilson", source: "airtable_sync" },
      { email: "sam@acme.com", name: "Sam (Participant)", source: "ai_extracted" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.get("sam@acme.com")).toEqual({
      name: "Sam Wilson",
      source: "partner",
    });
  });

  it("skips participants where email or name is null", async () => {
    setupParticipants([
      { email: "orphan@acme.com", name: null, source: "airtable_sync" },
      { email: null, name: "No Email AM", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.has("orphan@acme.com")).toBe(false);
    expect(map.emailToName.size).toBe(0);
  });

  it("excludes personal email domains from domain→org map", async () => {
    setupParticipants([
      { email: "joe@gmail.com", name: "Joe", organization: "SomePartner", source: "airtable_sync" },
      { email: "jane@yahoo.com", name: "Jane", organization: "SomePartner", source: "airtable_sync" },
      { email: "jill@outlook.com", name: "Jill", organization: "SomePartner", source: "airtable_sync" },
    ]);

    const map = await buildNameResolutionMap();

    expect(map.domainToOrg.has("gmail.com")).toBe(false);
    expect(map.domainToOrg.has("yahoo.com")).toBe(false);
    expect(map.domainToOrg.has("outlook.com")).toBe(false);
  });

  it("handles empty tables gracefully", async () => {
    setupParticipants([]);

    const map = await buildNameResolutionMap();

    expect(map.emailToName.size).toBe(0);
    expect(map.domainToOrg.size).toBe(0);
  });

  it("normalizes email keys to lowercase", async () => {
    setupParticipants([
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
      ["bob@aws.com", { name: "Bob Lee", source: "partner" }],
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
