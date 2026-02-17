import { describe, it, expect } from "vitest";
import { stripPRVS, isCorpmailAddress, isUserEmail, USER_CONFIG } from "../user-config";

describe("stripPRVS", () => {
  it("strips PRVS wrapping from an email", () => {
    expect(stripPRVS("prvs=abc123=sterme@amazon.com")).toBe("sterme@amazon.com");
  });

  it("handles uppercase PRVS prefix", () => {
    expect(stripPRVS("PRVS=abc123=sterme@amazon.com")).toBe("sterme@amazon.com");
  });

  it("returns plain email unchanged", () => {
    expect(stripPRVS("sterme@amazon.com")).toBe("sterme@amazon.com");
  });

  it("returns empty string unchanged", () => {
    expect(stripPRVS("")).toBe("");
  });

  it("handles long hash values", () => {
    expect(stripPRVS("prvs=0123456789abcdef=user@example.com")).toBe("user@example.com");
  });
});

describe("isCorpmailAddress", () => {
  it("matches SES corpmail tracking ID", () => {
    expect(isCorpmailAddress("0100019c6800d387-6136888a-0a38-4bdc-b1a8-226845ffccf3-000000@corpmail.amazon.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isCorpmailAddress("abc@CORPMAIL.AMAZON.COM")).toBe(true);
  });

  it("rejects normal amazon.com email", () => {
    expect(isCorpmailAddress("sterme@amazon.com")).toBe(false);
  });

  it("rejects unrelated email", () => {
    expect(isCorpmailAddress("alice@cybershield.com")).toBe(false);
  });
});

describe("isUserEmail", () => {
  it("matches primary email", () => {
    expect(isUserEmail("sterme@amazon.com")).toBe(true);
  });

  it("matches alias", () => {
    expect(isUserEmail("sromero@amazon.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUserEmail("STERME@AMAZON.COM")).toBe(true);
    expect(isUserEmail("Sromero@Amazon.com")).toBe(true);
  });

  it("matches PRVS-wrapped email", () => {
    expect(isUserEmail("prvs=abc123=sterme@amazon.com")).toBe(true);
  });

  it("matches SES corpmail address", () => {
    expect(isUserEmail("0100019c6800d387-6136888a-0a38-4bdc-b1a8-226845ffccf3-000000@corpmail.amazon.com")).toBe(true);
  });

  it("matches PRVS-wrapped alias", () => {
    expect(isUserEmail("prvs=xyz789=sromero@amazon.com")).toBe(true);
  });

  it("rejects unrelated email", () => {
    expect(isUserEmail("alice@cybershield.com")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isUserEmail("")).toBe(false);
  });
});

describe("USER_CONFIG", () => {
  it("has expected fields", () => {
    expect(USER_CONFIG.name).toBe("Steven Romero");
    expect(USER_CONFIG.email).toBe("sterme@amazon.com");
    expect(USER_CONFIG.role).toContain("PDM");
    expect(USER_CONFIG.segment).toContain("Security");
  });
});
