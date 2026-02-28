import { describe, it, expect } from "vitest";
import { messageFingerprint } from "../db";
import { ParsedMessage } from "../types";

function makeParsedMessage(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    sender_name: "Alice Chen",
    sender_email: "alice@partnerco.com",
    sent_at: "2025-02-03T10:30:00.000Z",
    subject: "Test Subject",
    body_text: "This is the body text of the message.",
    body_raw: "This is the body text of the message.",
    ...overrides,
  };
}

describe("messageFingerprint", () => {
  it("produces a consistent fingerprint", () => {
    const msg = makeParsedMessage();
    const fp1 = messageFingerprint(msg);
    const fp2 = messageFingerprint(msg);
    expect(fp1).toBe(fp2);
    expect(fp1).toContain("|");
  });

  it("is case-insensitive for sender email", () => {
    const fp1 = messageFingerprint(makeParsedMessage({ sender_email: "Alice@Example.COM" }));
    const fp2 = messageFingerprint(makeParsedMessage({ sender_email: "alice@example.com" }));
    expect(fp1).toBe(fp2);
  });

  it("truncates body to 100 chars", () => {
    const longBody = "A".repeat(200);
    const fp = messageFingerprint(makeParsedMessage({ body_text: longBody }));
    // The body portion (after |) should be 100 chars
    const bodyPart = fp.split("|")[1];
    expect(bodyPart.length).toBe(100);
  });

  it("handles null sender_email", () => {
    const fp = messageFingerprint(makeParsedMessage({ sender_email: null }));
    expect(fp.startsWith("|")).toBe(true);
    expect(fp.length).toBeGreaterThan(1);
  });

  it("same-content messages produce matching fingerprints", () => {
    const msg1 = makeParsedMessage({
      sender_email: "alice@partnerco.com",
      body_text: "Hey, wanted to follow up on the security review.",
    });
    const msg2 = makeParsedMessage({
      sender_email: "alice@partnerco.com",
      body_text: "Hey, wanted to follow up on the security review.",
      // Different metadata shouldn't affect fingerprint
      sender_name: "Alice C.",
      subject: "Different Subject",
    });
    expect(messageFingerprint(msg1)).toBe(messageFingerprint(msg2));
  });

  it("different senders produce different fingerprints", () => {
    const fp1 = messageFingerprint(makeParsedMessage({ sender_email: "alice@co.com" }));
    const fp2 = messageFingerprint(makeParsedMessage({ sender_email: "bob@co.com" }));
    expect(fp1).not.toBe(fp2);
  });
});
