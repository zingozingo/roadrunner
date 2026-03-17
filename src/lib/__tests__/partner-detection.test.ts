import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPartnerContactDomains = vi.hoisted(() =>
  vi.fn<[], Promise<Map<string, { partnerId: string; partnerName: string }>>>()
);

vi.mock("../db", () => ({
  getPartnerContactDomains: mockGetPartnerContactDomains,
}));

import {
  extractEmailAddresses,
  detectPartnerFromEmail,
  AWS_DOMAINS,
} from "../partner-detection";

// ============================================================
// extractEmailAddresses
// ============================================================

describe("extractEmailAddresses", () => {
  it("extracts bare email address", () => {
    expect(extractEmailAddresses("alice@acme.com")).toEqual(["alice@acme.com"]);
  });

  it("extracts from Name <email> format", () => {
    expect(extractEmailAddresses("Alice Smith <alice@acme.com>")).toEqual([
      "alice@acme.com",
    ]);
  });

  it("extracts from comma-separated list", () => {
    expect(
      extractEmailAddresses("alice@acme.com, bob@partner.io")
    ).toEqual(["alice@acme.com", "bob@partner.io"]);
  });

  it("extracts from semicolon-separated list", () => {
    expect(
      extractEmailAddresses("alice@acme.com; bob@partner.io")
    ).toEqual(["alice@acme.com", "bob@partner.io"]);
  });

  it("extracts from mixed Name <email> and bare formats", () => {
    expect(
      extractEmailAddresses("Alice <alice@acme.com>, bob@partner.io")
    ).toEqual(["alice@acme.com", "bob@partner.io"]);
  });

  it("deduplicates email addresses", () => {
    expect(
      extractEmailAddresses("alice@acme.com, Alice <alice@acme.com>")
    ).toEqual(["alice@acme.com"]);
  });

  it("lowercases email addresses", () => {
    expect(extractEmailAddresses("ALICE@ACME.COM")).toEqual(["alice@acme.com"]);
  });

  it("returns empty array for empty string", () => {
    expect(extractEmailAddresses("")).toEqual([]);
  });

  it("returns empty array for text with no emails", () => {
    expect(extractEmailAddresses("hello world")).toEqual([]);
  });

  it("extracts emails embedded in body text", () => {
    const body = "Please contact alice@acme.com for details. CC bob@partner.io.";
    expect(extractEmailAddresses(body)).toEqual([
      "alice@acme.com",
      "bob@partner.io",
    ]);
  });
});

// ============================================================
// AWS_DOMAINS
// ============================================================

describe("AWS_DOMAINS", () => {
  it("includes amazon.com", () => {
    expect(AWS_DOMAINS.has("amazon.com")).toBe(true);
  });

  it("includes amazon.co.uk", () => {
    expect(AWS_DOMAINS.has("amazon.co.uk")).toBe(true);
  });

  it("includes amazonaws.com", () => {
    expect(AWS_DOMAINS.has("amazonaws.com")).toBe(true);
  });

  it("includes amazon.de, amazon.fr, amazon.co.jp, amazon.es, amazon.it", () => {
    expect(AWS_DOMAINS.has("amazon.de")).toBe(true);
    expect(AWS_DOMAINS.has("amazon.fr")).toBe(true);
    expect(AWS_DOMAINS.has("amazon.co.jp")).toBe(true);
    expect(AWS_DOMAINS.has("amazon.es")).toBe(true);
    expect(AWS_DOMAINS.has("amazon.it")).toBe(true);
  });

  it("does not include non-AWS domains", () => {
    expect(AWS_DOMAINS.has("acme.com")).toBe(false);
    expect(AWS_DOMAINS.has("google.com")).toBe(false);
  });
});

// ============================================================
// detectPartnerFromEmail
// ============================================================

describe("detectPartnerFromEmail", () => {
  const acmePartner = { partnerId: "p-acme", partnerName: "Acme Corp" };
  const widgetPartner = { partnerId: "p-widget", partnerName: "Widget Inc" };

  beforeEach(() => {
    const domainMap = new Map<string, { partnerId: string; partnerName: string }>();
    domainMap.set("acme.com", acmePartner);
    domainMap.set("widget.io", widgetPartner);
    mockGetPartnerContactDomains.mockResolvedValue(domainMap);
  });

  it("matches partner from sender email", async () => {
    const result = await detectPartnerFromEmail(
      "alice@acme.com",
      null,
      null,
      null
    );
    expect(result).toEqual(acmePartner);
  });

  it("matches partner from to header", async () => {
    const result = await detectPartnerFromEmail(
      "steven@amazon.com",
      "alice@acme.com",
      null,
      null
    );
    expect(result).toEqual(acmePartner);
  });

  it("matches partner from cc header", async () => {
    const result = await detectPartnerFromEmail(
      "steven@amazon.com",
      "bob@amazon.com",
      "alice@acme.com",
      null
    );
    expect(result).toEqual(acmePartner);
  });

  it("matches partner from body text", async () => {
    const result = await detectPartnerFromEmail(
      "steven@amazon.com",
      null,
      null,
      "Contact alice@acme.com for details"
    );
    expect(result).toEqual(acmePartner);
  });

  it("skips AWS domains and matches partner domain", async () => {
    const result = await detectPartnerFromEmail(
      "steven@amazon.com",
      "Alice <alice@acme.com>",
      null,
      null
    );
    expect(result).toEqual(acmePartner);
  });

  it("returns null when no partner domains match", async () => {
    const result = await detectPartnerFromEmail(
      "steven@amazon.com",
      "bob@amazon.co.uk",
      null,
      null
    );
    expect(result).toBeNull();
  });

  it("returns null when only unknown domains present", async () => {
    const result = await detectPartnerFromEmail(
      "someone@unknown.org",
      null,
      null,
      null
    );
    expect(result).toBeNull();
  });

  it("prioritizes sender over to/cc", async () => {
    const result = await detectPartnerFromEmail(
      "alice@acme.com",
      "bob@widget.io",
      null,
      null
    );
    expect(result).toEqual(acmePartner);
  });

  it("handles Name <email> format in headers", async () => {
    const result = await detectPartnerFromEmail(
      "steven@amazon.com",
      "Alice Smith <alice@acme.com>, Bob <bob@amazon.com>",
      null,
      null
    );
    expect(result).toEqual(acmePartner);
  });

  it("returns null for empty sender with no headers", async () => {
    const result = await detectPartnerFromEmail("", null, null, null);
    expect(result).toBeNull();
  });
});
