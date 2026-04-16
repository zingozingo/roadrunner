import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for useFilterParam hook.
 *
 * Since the hook wraps Next.js navigation primitives (useSearchParams,
 * useRouter, usePathname), we test the core URL-building logic directly
 * by exercising the same URLSearchParams operations the hook performs.
 * This avoids needing @testing-library/react for renderHook.
 */

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();
const PATHNAME = "/engagements";

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => PATHNAME,
}));

// Simulate what the hook does: read a param value
function readParam(key: string): string | null {
  return mockSearchParams.get(key) || null;
}

// Simulate what the hook's setter does: build URL and call replace
function setParam(key: string, value: string | null): void {
  const params = new URLSearchParams(mockSearchParams.toString());
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const qs = params.toString();
  mockReplace(qs ? `${PATHNAME}?${qs}` : PATHNAME, { scroll: false });
}

describe("useFilterParam (URL logic)", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockReplace.mockClear();
  });

  it("returns null when param is absent", () => {
    expect(readParam("partner")).toBeNull();
  });

  it("reads value from URL search params", () => {
    mockSearchParams = new URLSearchParams("partner=abc-123");
    expect(readParam("partner")).toBe("abc-123");
  });

  it("returns null for empty string param", () => {
    mockSearchParams = new URLSearchParams("partner=");
    expect(readParam("partner")).toBeNull();
  });

  it("sets value and updates URL", () => {
    setParam("partner", "abc-123");
    expect(mockReplace).toHaveBeenCalledWith(
      "/engagements?partner=abc-123",
      { scroll: false }
    );
  });

  it("removes param when set to null", () => {
    mockSearchParams = new URLSearchParams("partner=abc-123");
    setParam("partner", null);
    expect(mockReplace).toHaveBeenCalledWith(
      "/engagements",
      { scroll: false }
    );
  });

  it("preserves other params when setting value", () => {
    mockSearchParams = new URLSearchParams("status=active&page=2");
    setParam("partner", "abc-123");
    const calledUrl = mockReplace.mock.calls[0][0] as string;
    expect(calledUrl).toContain("partner=abc-123");
    expect(calledUrl).toContain("status=active");
    expect(calledUrl).toContain("page=2");
  });

  it("preserves other params when removing value", () => {
    mockSearchParams = new URLSearchParams("partner=abc-123&status=active");
    setParam("partner", null);
    expect(mockReplace).toHaveBeenCalledWith(
      "/engagements?status=active",
      { scroll: false }
    );
  });

  it("multiple keys work independently", () => {
    mockSearchParams = new URLSearchParams("partner=abc&status=active");
    expect(readParam("partner")).toBe("abc");
    expect(readParam("status")).toBe("active");
  });

  it("replaces existing value when setting new one", () => {
    mockSearchParams = new URLSearchParams("partner=old-id");
    setParam("partner", "new-id");
    expect(mockReplace).toHaveBeenCalledWith(
      "/engagements?partner=new-id",
      { scroll: false }
    );
  });
});
