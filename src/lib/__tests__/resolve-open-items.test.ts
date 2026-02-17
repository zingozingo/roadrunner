import { describe, it, expect } from "vitest";
import { extractKeywords, matchResolvedItems } from "../supabase";

// ============================================================
// extractKeywords
// ============================================================

describe("extractKeywords", () => {
  it("extracts significant words, ignoring stop words", () => {
    const kws = extractKeywords("Send the GTM campaign strategy document");
    expect(kws).toContain("send");
    expect(kws).toContain("gtm");
    expect(kws).toContain("campaign");
    expect(kws).toContain("strategy");
    expect(kws).toContain("document");
    expect(kws).not.toContain("the");
  });

  it("lowercases all keywords and joins hyphenated words", () => {
    const kws = extractKeywords("Schedule Follow-Up Meeting");
    expect(kws).toContain("schedule");
    expect(kws).toContain("followup");  // hyphen stripped, joined
    expect(kws).toContain("meeting");
  });

  it("strips punctuation", () => {
    const kws = extractKeywords("Jordan's doc: GTM!");
    expect(kws).toContain("jordans");
    expect(kws).toContain("doc");
    expect(kws).toContain("gtm");
  });

  it("returns empty set for stop-word-only input", () => {
    const kws = extractKeywords("the a an is to of");
    expect(kws.size).toBe(0);
  });
});

// ============================================================
// matchResolvedItems
// ============================================================

describe("matchResolvedItems", () => {
  it("resolves an exact match", () => {
    const items = [
      { description: "Send GTM doc", assignee: "Jordan", due_date: null, resolved: false },
    ];
    const { updatedItems, resolvedCount } = matchResolvedItems(items, ["Send GTM doc"]);

    expect(resolvedCount).toBe(1);
    expect(updatedItems[0].resolved).toBe(true);
  });

  it("resolves a semantic match by keyword overlap", () => {
    const items = [
      { description: "Send GTM campaign strategy document", assignee: "Jordan Spiers", due_date: "2026-02-21", resolved: false },
    ];
    // "GTM campaign document" shares 3/3 resolve keywords with 3/5 item keywords (60%)
    const { updatedItems, resolvedCount } = matchResolvedItems(items, ["GTM campaign document ready"]);

    expect(resolvedCount).toBe(1);
    expect(updatedItems[0].resolved).toBe(true);
  });

  it("does NOT resolve when keywords don't overlap", () => {
    const items = [
      { description: "Send GTM campaign strategy document", assignee: "Jordan", due_date: null, resolved: false },
    ];
    const { updatedItems, resolvedCount } = matchResolvedItems(items, ["scheduled a call with the team"]);

    expect(resolvedCount).toBe(0);
    expect(updatedItems[0].resolved).toBe(false);
  });

  it("skips already-resolved items", () => {
    const items = [
      { description: "Send GTM doc", assignee: "Jordan", due_date: null, resolved: true },
    ];
    const { resolvedCount } = matchResolvedItems(items, ["Send GTM doc"]);

    expect(resolvedCount).toBe(0);
  });

  it("resolves multiple items in one call", () => {
    const items = [
      { description: "Send GTM campaign strategy document", assignee: "Jordan", due_date: null, resolved: false },
      { description: "Schedule follow-up meeting with Ellie", assignee: "Steven", due_date: null, resolved: false },
      { description: "Review security compliance checklist", assignee: null, due_date: null, resolved: false },
    ];
    const { updatedItems, resolvedCount } = matchResolvedItems(items, [
      "Jordan sent the GTM campaign document",
      "Follow-up meeting with Ellie has been scheduled",
    ]);

    expect(resolvedCount).toBe(2);
    expect(updatedItems[0].resolved).toBe(true);
    expect(updatedItems[1].resolved).toBe(true);
    expect(updatedItems[2].resolved).toBe(false);
  });

  it("handles empty items array", () => {
    const { resolvedCount } = matchResolvedItems([], ["Send GTM doc"]);
    expect(resolvedCount).toBe(0);
  });

  it("handles empty resolved descriptions", () => {
    const items = [
      { description: "Send GTM doc", assignee: null, due_date: null, resolved: false },
    ];
    const { resolvedCount } = matchResolvedItems(items, []);
    expect(resolvedCount).toBe(0);
  });

  it("does not mutate original items array", () => {
    const original = [
      { description: "Send GTM doc", assignee: "Jordan", due_date: null, resolved: false },
    ];
    matchResolvedItems(original, ["Send GTM doc"]);

    expect(original[0].resolved).toBe(false);
  });

  it("picks the best match when multiple items partially overlap", () => {
    const items = [
      { description: "Send GTM campaign document", assignee: "Jordan", due_date: null, resolved: false },
      { description: "Send architecture review document", assignee: "Alice", due_date: null, resolved: false },
    ];
    const { updatedItems, resolvedCount } = matchResolvedItems(items, [
      "Jordan sent the GTM campaign document",
    ]);

    expect(resolvedCount).toBe(1);
    expect(updatedItems[0].resolved).toBe(true);  // GTM campaign document
    expect(updatedItems[1].resolved).toBe(false);  // architecture review stays open
  });
});
