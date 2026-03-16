import { describe, it, expect } from "vitest";
import {
  parseContact,
  parseRoleContact,
  parseContactList,
  renderContact,
  renderContactList,
} from "../contact-parser";
import { normalizeEmail } from "../db/participants";

describe("parseContact", () => {
  it("parses full format: Name <email> (Title)", () => {
    const result = parseContact("Alice Chen <alice@cybershield.com> (CTO)");
    expect(result).toEqual({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: "CTO",
    });
  });

  it("parses missing email with em-dash placeholder", () => {
    const result = parseContact("Alice Chen <—> (CTO)");
    expect(result).toEqual({ name: "Alice Chen", email: null, title: "CTO" });
  });

  it("parses missing title with em-dash placeholder", () => {
    const result = parseContact("Alice Chen <alice@cybershield.com> (—)");
    expect(result).toEqual({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: null,
    });
  });

  it("parses missing both email and title", () => {
    const result = parseContact("Alice Chen <—> (—)");
    expect(result).toEqual({ name: "Alice Chen", email: null, title: null });
  });

  it("parses name and email only (no title parens)", () => {
    const result = parseContact("Alice Chen <alice@cybershield.com>");
    expect(result).toEqual({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: null,
    });
  });

  it("parses name only", () => {
    const result = parseContact("Alice Chen");
    expect(result).toEqual({ name: "Alice Chen", email: null, title: null });
  });

  it("returns all nulls for empty string", () => {
    expect(parseContact("")).toEqual({ name: null, email: null, title: null });
  });

  it("returns all nulls for whitespace-only", () => {
    expect(parseContact("   ")).toEqual({
      name: null,
      email: null,
      title: null,
    });
  });

  it("handles extra whitespace", () => {
    const result = parseContact(
      "  Alice Chen   <alice@cybershield.com>   (CTO)  "
    );
    expect(result).toEqual({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: "CTO",
    });
  });

  it("handles multi-word titles", () => {
    const result = parseContact(
      "Alice Chen <alice@cybershield.com> (VP of Engineering)"
    );
    expect(result).toEqual({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: "VP of Engineering",
    });
  });
});

describe("parseRoleContact", () => {
  it("attaches role to parsed contact", () => {
    const result = parseRoleContact(
      "Alice Chen <alice@cybershield.com> (CTO)",
      "Alliance Lead"
    );
    expect(result).toEqual({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: "CTO",
      role: "Alliance Lead",
    });
  });
});

describe("parseContactList", () => {
  it("parses multi-line contact list", () => {
    const raw =
      "Alice Chen <alice@cybershield.com> (CTO)\nBob Lee <bob@cybershield.com> (Engineer)";
    const result = parseContactList(raw, "Contact");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alice Chen");
    expect(result[0].role).toBe("Contact");
    expect(result[1].name).toBe("Bob Lee");
  });

  it("skips empty lines", () => {
    const raw = "Alice Chen <alice@cybershield.com> (CTO)\n\n\nBob Lee <bob@cybershield.com> (Engineer)";
    const result = parseContactList(raw, "Contact");
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty string", () => {
    expect(parseContactList("", "Contact")).toEqual([]);
  });

  it("returns empty array for whitespace-only", () => {
    expect(parseContactList("   ", "Contact")).toEqual([]);
  });

  it("handles single item", () => {
    const result = parseContactList(
      "Alice Chen <alice@cybershield.com> (CTO)",
      "Contact"
    );
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("alice@cybershield.com");
  });

  it("splits semicolon-delimited contacts", () => {
    const raw =
      "Caroline Calcaterra <carolinec@knowbe4.com> (Alliance Lead); Harley Algie <harleya@knowbe4.com> (Contact); Kelly Hannon <kellyh@knowbe4.com> (Contact)";
    const result = parseContactList(raw, "Contact");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: "Caroline Calcaterra",
      email: "carolinec@knowbe4.com",
      title: "Alliance Lead",
      role: "Contact",
    });
    expect(result[1]).toEqual({
      name: "Harley Algie",
      email: "harleya@knowbe4.com",
      title: "Contact",
      role: "Contact",
    });
    expect(result[2]).toEqual({
      name: "Kelly Hannon",
      email: "kellyh@knowbe4.com",
      title: "Contact",
      role: "Contact",
    });
  });

  it("handles mixed newline and semicolon delimiters", () => {
    const raw =
      "Alice Chen <alice@cybershield.com> (CTO); Bob Lee <bob@cybershield.com> (Engineer)\nCarol Wu <carol@cybershield.com> (PM)";
    const result = parseContactList(raw, "Contact");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Alice Chen");
    expect(result[1].name).toBe("Bob Lee");
    expect(result[2].name).toBe("Carol Wu");
  });

  it("handles semicolons with empty segments", () => {
    const raw = "Alice Chen <alice@cybershield.com> (CTO);;; Bob Lee <bob@cybershield.com>";
    const result = parseContactList(raw, "Contact");
    expect(result).toHaveLength(2);
  });
});

describe("renderContact", () => {
  it("renders full contact", () => {
    const result = renderContact({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: "CTO",
    });
    expect(result).toBe("Alice Chen <alice@cybershield.com> (CTO)");
  });

  it("renders em-dash for null email", () => {
    const result = renderContact({
      name: "Alice Chen",
      email: null,
      title: "CTO",
    });
    expect(result).toBe("Alice Chen <—> (CTO)");
  });

  it("renders em-dash for null title", () => {
    const result = renderContact({
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: null,
    });
    expect(result).toBe("Alice Chen <alice@cybershield.com> (—)");
  });

  it("renders em-dashes for null email and title", () => {
    const result = renderContact({
      name: "Alice Chen",
      email: null,
      title: null,
    });
    expect(result).toBe("Alice Chen <—> (—)");
  });

  it("renders without name when name is null", () => {
    const result = renderContact({
      name: null,
      email: "alice@cybershield.com",
      title: null,
    });
    expect(result).toBe("<alice@cybershield.com> (—)");
  });

  it("round-trips correctly", () => {
    const original = {
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: "CTO",
    };
    const rendered = renderContact(original);
    const parsed = parseContact(rendered);
    expect(parsed).toEqual(original);
  });

  it("round-trips with null email", () => {
    const original = { name: "Alice Chen", email: null, title: "CTO" };
    const rendered = renderContact(original);
    const parsed = parseContact(rendered);
    expect(parsed).toEqual(original);
  });

  it("round-trips with null title", () => {
    const original = {
      name: "Alice Chen",
      email: "alice@cybershield.com",
      title: null,
    };
    const rendered = renderContact(original);
    const parsed = parseContact(rendered);
    expect(parsed).toEqual(original);
  });
});

describe("renderContactList", () => {
  it("renders newline-separated contacts", () => {
    const contacts = [
      {
        name: "Alice Chen",
        email: "alice@cybershield.com",
        title: "CTO",
        role: "Contact",
      },
      {
        name: "Bob Lee",
        email: "bob@cybershield.com",
        title: "Engineer",
        role: "Contact",
      },
    ];
    const result = renderContactList(contacts);
    expect(result).toBe(
      "Alice Chen <alice@cybershield.com> (CTO)\nBob Lee <bob@cybershield.com> (Engineer)"
    );
  });

  it("returns empty string for empty array", () => {
    expect(renderContactList([])).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("strips trailing dot from email", () => {
    expect(normalizeEmail("harleya@knowbe4.com.")).toBe("harleya@knowbe4.com");
  });

  it("strips multiple trailing dots", () => {
    expect(normalizeEmail("user@domain.com...")).toBe("user@domain.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@domain.com  ")).toBe("user@domain.com");
  });

  it("handles clean email unchanged", () => {
    expect(normalizeEmail("user@domain.com")).toBe("user@domain.com");
  });

  it("strips trailing dot and whitespace together", () => {
    expect(normalizeEmail(" harleya@knowbe4.com. ")).toBe("harleya@knowbe4.com");
  });
});
