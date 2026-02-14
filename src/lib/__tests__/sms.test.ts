import { describe, it, expect } from "vitest";
import { buildSMSOptions, buildClassificationSMS } from "../sms";
import type { ClassificationResult, Message, Engagement } from "../types";

// ============================================================
// Fixtures
// ============================================================

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-001",
    engagement_id: null,
    sender_name: "Alice Chen",
    sender_email: "alice@cybershield.com",
    sent_at: "2025-02-03T15:30:00Z",
    subject: "Re: Security Review Next Steps",
    body_text: "Following up.",
    body_raw: "Following up.",
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarded_at: "2025-02-03T16:00:00Z",
    pending_review: true,
    classification_result: null,
    forwarder_email: null,
    forwarder_name: null,
    to_header: null,
    cc_header: null,
    ...overrides,
  };
}

const EXISTING_ENGAGEMENT: Engagement = {
  id: "init-001",
  name: "CyberShield - Security Review",
  status: "active",
  summary: null,
  current_state: null,
  open_items: [],
  partner_name: "CyberShield",
  tags: [],
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-02-01T00:00:00Z",
  closed_at: null,
};

function makeResult(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    content_type: "engagement_email",
    engagement_match: {
      id: "init-001",
      name: "CyberShield - Security Review",
      confidence: 0.73,
      is_new: false,
      partner_name: "CyberShield",
    },
    matched_events: [],
    matched_programs: [],
    suggested_tags: [],
    participants: [],
    current_state: null,
    open_items: [],
    ...overrides,
  };
}

// ============================================================
// buildSMSOptions
// ============================================================

describe("buildSMSOptions", () => {
  it("includes existing engagement match with confidence >= 0.5", () => {
    const result = makeResult();
    const options = buildSMSOptions(result, [EXISTING_ENGAGEMENT]);

    expect(options.length).toBe(2); // match + new
    expect(options[0].label).toBe("CyberShield - Security Review");
    expect(options[0].engagement_id).toBe("init-001");
    expect(options[0].is_new).toBe(false);
    expect(options[0].number).toBe(1);
  });

  it("includes 'New engagement' as fallback when match is existing", () => {
    const result = makeResult();
    const options = buildSMSOptions(result, [EXISTING_ENGAGEMENT]);

    const newOpt = options.find((o) => o.is_new);
    expect(newOpt).toBeDefined();
    expect(newOpt!.label).toBe("New engagement");
  });

  it("puts suggested new engagement first when is_new with confidence >= 0.5", () => {
    const result = makeResult({
      engagement_match: {
        id: null,
        name: "Wiz - Executive Alignment",
        confidence: 0.65,
        is_new: true,
        partner_name: "Wiz",
      },
    });
    const options = buildSMSOptions(result, [EXISTING_ENGAGEMENT]);

    expect(options[0].number).toBe(1);
    expect(options[0].label).toBe("Wiz - Executive Alignment");
    expect(options[0].is_new).toBe(true);
    // Should NOT have a second "New engagement" since is_new is already present
    expect(options.filter((o) => o.is_new)).toHaveLength(1);
  });

  it("skips match with confidence < 0.5", () => {
    const result = makeResult({
      engagement_match: {
        id: "init-001",
        name: "CyberShield - Security Review",
        confidence: 0.3,
        is_new: false,
        partner_name: "CyberShield",
      },
    });
    const options = buildSMSOptions(result, [EXISTING_ENGAGEMENT]);

    // Should only have "New engagement"
    expect(options.length).toBe(1);
    expect(options[0].is_new).toBe(true);
    expect(options[0].label).toBe("New engagement");
  });
});

// ============================================================
// buildClassificationSMS
// ============================================================

describe("buildClassificationSMS", () => {
  it("builds a concise SMS with sender, subject, and options", () => {
    const msg = makeMessage();
    const options = buildSMSOptions(makeResult(), [EXISTING_ENGAGEMENT]);
    const sms = buildClassificationSMS(msg, options);

    expect(sms).toContain("Alice Chen");
    expect(sms).toContain("Security Review Next Steps");
    expect(sms).toContain("1. CyberShield - Security Review");
    expect(sms).toContain("New engagement");
    expect(sms).toContain("Reply #, name, or skip");
  });

  it("stays under 320 characters", () => {
    const msg = makeMessage();
    const options = buildSMSOptions(makeResult(), [EXISTING_ENGAGEMENT]);
    const sms = buildClassificationSMS(msg, options);

    expect(sms.length).toBeLessThanOrEqual(320);
  });

  it("truncates long subjects", () => {
    const msg = makeMessage({
      subject: "Re: FW: Very Long Email Subject That Goes On And On About Multiple Topics Including Security Review",
    });
    const options = buildSMSOptions(makeResult(), []);
    const sms = buildClassificationSMS(msg, options);

    expect(sms).toContain("...");
    expect(sms.length).toBeLessThanOrEqual(320);
  });

  it("handles missing sender name", () => {
    const msg = makeMessage({ sender_name: null });
    const options = buildSMSOptions(makeResult(), []);
    const sms = buildClassificationSMS(msg, options);

    expect(sms).toContain("alice@cybershield.com");
  });

  it("handles missing subject", () => {
    const msg = makeMessage({ subject: null });
    const options = buildSMSOptions(makeResult(), []);
    const sms = buildClassificationSMS(msg, options);

    expect(sms).toContain("(no subject)");
  });
});
