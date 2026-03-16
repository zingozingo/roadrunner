import { describe, it, expect } from "vitest";
import {
  getDisplayRole,
  getDisplayOrgType,
  sortContactsByRole,
  isNamedRole,
  isClassifierRole,
  CLASSIFIER_ROLES,
} from "../contact-display";

describe("getDisplayRole", () => {
  it("returns AT-sourced role when present", () => {
    expect(getDisplayRole("PSA", "Solutions Architect", "internal")).toBe("PSA");
  });

  it("returns Alliance Lead over title", () => {
    expect(getDisplayRole("Alliance Lead", "VP of Partnerships", "partner")).toBe("Alliance Lead");
  });

  it("returns title when role is a classifier role", () => {
    expect(getDisplayRole("aws_stakeholder", "Solutions Architect", "internal")).toBe("Solutions Architect");
  });

  it("returns title when role is 'Contact'", () => {
    expect(getDisplayRole("Contact", "Head of AWS Alliances", "partner")).toBe("Head of AWS Alliances");
  });

  it("returns org_type label when classifier role and no title", () => {
    expect(getDisplayRole("aws_stakeholder", null, "internal")).toBe("AWS");
  });

  it("returns org_type label when 'Contact' role and no title", () => {
    expect(getDisplayRole("Contact", null, "partner")).toBe("Partner");
  });

  it("returns org_type label when null role and null title", () => {
    expect(getDisplayRole(null, null, "third_party")).toBe("Third Party");
  });

  it("returns title when role is null", () => {
    expect(getDisplayRole(null, "CTO", null)).toBe("CTO");
  });

  it("returns null when everything is null", () => {
    expect(getDisplayRole(null, null, null)).toBeNull();
  });

  it("suppresses all known classifier roles", () => {
    for (const role of CLASSIFIER_ROLES) {
      expect(getDisplayRole(role, null, "internal")).toBe("AWS");
    }
  });

  it("suppresses unknown classifier roles via underscore heuristic", () => {
    expect(getDisplayRole("partner_contact", "CTO", "partner")).toBe("CTO");
  });

  it("returns title when role is partner_contact", () => {
    expect(getDisplayRole("partner_contact", "Head of Alliances", "partner")).toBe("Head of Alliances");
  });

  it("returns org_type when partner_contact and no title", () => {
    expect(getDisplayRole("partner_contact", null, "partner")).toBe("Partner");
  });

  it("returns org_type when third_party role and no title", () => {
    expect(getDisplayRole("third_party", null, "third_party")).toBe("Third Party");
  });
});

describe("getDisplayOrgType", () => {
  it("maps internal to AWS", () => {
    expect(getDisplayOrgType("internal")).toBe("AWS");
  });

  it("maps partner to Partner", () => {
    expect(getDisplayOrgType("partner")).toBe("Partner");
  });

  it("maps third_party to Third Party", () => {
    expect(getDisplayOrgType("third_party")).toBe("Third Party");
  });

  it("maps null to Unknown", () => {
    expect(getDisplayOrgType(null)).toBe("Unknown");
  });

  it("maps unrecognized to Unknown", () => {
    expect(getDisplayOrgType("other")).toBe("Unknown");
  });
});

describe("sortContactsByRole", () => {
  it("sorts named roles by priority", () => {
    const contacts = [
      { role: "Contact", name: "E" },
      { role: "PMM", name: "D" },
      { role: "Alliance Lead", name: "A" },
      { role: "Account Manager", name: "C" },
      { role: "PSA", name: "B" },
    ];
    const sorted = sortContactsByRole(contacts);
    expect(sorted.map((c) => c.role)).toEqual([
      "Alliance Lead",
      "PSA",
      "Account Manager",
      "PMM",
      "Contact",
    ]);
  });

  it("puts unknown roles at priority 50 (between PMM and Contact)", () => {
    const contacts = [
      { role: "Contact" },
      { role: "New Special Role" },
      { role: "PSA" },
    ];
    const sorted = sortContactsByRole(contacts);
    expect(sorted.map((c) => c.role)).toEqual([
      "PSA",
      "New Special Role",
      "Contact",
    ]);
  });

  it("treats null role as default priority", () => {
    const contacts = [
      { role: "Contact" },
      { role: null },
      { role: "Alliance Lead" },
    ];
    const sorted = sortContactsByRole(contacts);
    expect(sorted.map((c) => c.role)).toEqual([
      "Alliance Lead",
      null,
      "Contact",
    ]);
  });

  it("does not mutate the original array", () => {
    const original = [{ role: "Contact" }, { role: "PSA" }];
    const sorted = sortContactsByRole(original);
    expect(original[0].role).toBe("Contact");
    expect(sorted[0].role).toBe("PSA");
  });
});

describe("isClassifierRole", () => {
  it("returns true for partner_contact", () => {
    expect(isClassifierRole("partner_contact")).toBe(true);
  });

  it("returns true for aws_stakeholder", () => {
    expect(isClassifierRole("aws_stakeholder")).toBe(true);
  });

  it("returns true for third_party", () => {
    expect(isClassifierRole("third_party")).toBe(true);
  });

  it("returns true for cc_recipient", () => {
    expect(isClassifierRole("cc_recipient")).toBe(true);
  });

  it("returns false for Alliance Lead", () => {
    expect(isClassifierRole("Alliance Lead")).toBe(false);
  });

  it("returns false for PSA", () => {
    expect(isClassifierRole("PSA")).toBe(false);
  });

  it("returns false for Contact", () => {
    expect(isClassifierRole("Contact")).toBe(false);
  });

  it("returns false for PMM", () => {
    expect(isClassifierRole("PMM")).toBe(false);
  });
});

describe("isNamedRole", () => {
  it("returns true for PSA", () => {
    expect(isNamedRole("PSA")).toBe(true);
  });

  it("returns true for Alliance Lead", () => {
    expect(isNamedRole("Alliance Lead")).toBe(true);
  });

  it("returns true for Account Manager", () => {
    expect(isNamedRole("Account Manager")).toBe(true);
  });

  it("returns false for classifier role aws_stakeholder", () => {
    expect(isNamedRole("aws_stakeholder")).toBe(false);
  });

  it("returns false for classifier role primary_contact", () => {
    expect(isNamedRole("primary_contact")).toBe(false);
  });

  it("returns false for Contact (generic)", () => {
    expect(isNamedRole("Contact")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isNamedRole(null)).toBe(false);
  });

  it("returns false for partner_contact (underscore heuristic)", () => {
    expect(isNamedRole("partner_contact")).toBe(false);
  });

  it("returns false for third_party (underscore heuristic)", () => {
    expect(isNamedRole("third_party")).toBe(false);
  });

  it("returns true for unknown non-classifier role", () => {
    expect(isNamedRole("Technical Lead")).toBe(true);
  });
});
