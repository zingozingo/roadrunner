import { describe, it, expect } from "vitest";
import { buildForwarderSection } from "../prompt-builder";

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
