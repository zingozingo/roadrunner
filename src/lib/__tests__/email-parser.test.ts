import { describe, it, expect } from "vitest";
import { parseForwardedEmail, findGmailQuoteMarkers } from "../email-parser";

// Realistic Outlook forwarded email with 3-message thread
const OUTLOOK_THREAD = `FYI — forwarding this thread about the security review.

________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob Lee <bob@aws.example.com>
Subject: Security Review Next Steps

Hi Bob,

Wanted to follow up on the security review for Project Falcon. We've completed the initial assessment and have a few items that need your team's input before the March 15 deadline.

Can we set up a call this week?

Thanks,
Alice

Sent from my iPhone

________________________________
From: Bob Lee <bob@aws.example.com>
Sent: Monday, February 3, 2025 2:15 PM
To: Alice Chen <alice@partnerco.com>
Subject: Re: Security Review Next Steps

Alice,

Absolutely. How about Thursday at 2pm ET? I'll loop in our solutions architect, Dana, as well.

Also — have you registered for re:Invent yet? There's a partner track session on the new Competency program that might be relevant.

Best,
Bob

________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Tuesday, February 4, 2025 9:00 AM
To: Bob Lee <bob@aws.example.com>; Dana Wright <dana@aws.example.com>
Subject: Re: Security Review Next Steps

Thursday 2pm works! I'll send a calendar invite.

And yes, we're planning to attend re:Invent. Would love to learn more about the Competency program — we've been considering applying.

See you Thursday!
Alice

CONFIDENTIALITY NOTICE
This email and any attachments are confidential and intended only for the addressee.`;

describe("parseForwardedEmail", () => {
  describe("Outlook 3-message thread", () => {
    const messages = parseForwardedEmail(OUTLOOK_THREAD, {
      sender: "Steven Romero <steven@example.com>",
      subject: "Fwd: Security Review Next Steps",
      timestamp: 1738700000,
    });

    it("extracts 3 thread messages (preface is NOT a standalone message)", () => {
      expect(messages.length).toBe(3);
    });

    it("attaches forwarder's note to the first thread message", () => {
      expect(messages[0].forwarder_note).toContain("forwarding this thread");
    });

    it("parses the first thread message (Alice)", () => {
      expect(messages[0].sender_name).toBe("Alice Chen");
      expect(messages[0].sender_email).toBe("alice@partnerco.com");
      expect(messages[0].subject).toBe("Security Review Next Steps");
      expect(messages[0].sent_at).not.toBeNull();
      expect(messages[0].body_text).toContain("Project Falcon");
      expect(messages[0].to_header).toBe("Bob Lee <bob@aws.example.com>");
      expect(messages[0].cc_header).toBeNull();
    });

    it("parses the second thread message (Bob)", () => {
      expect(messages[1].sender_name).toBe("Bob Lee");
      expect(messages[1].sender_email).toBe("bob@aws.example.com");
      expect(messages[1].subject).toBe("Re: Security Review Next Steps");
      expect(messages[1].body_text).toContain("Thursday at 2pm");
      expect(messages[1].body_text).toContain("re:Invent");
      expect(messages[1].to_header).toBe("Alice Chen <alice@partnerco.com>");
      expect(messages[1].cc_header).toBeNull();
    });

    it("parses the third thread message (Alice reply with multiple To recipients)", () => {
      expect(messages[2].sender_name).toBe("Alice Chen");
      expect(messages[2].sender_email).toBe("alice@partnerco.com");
      expect(messages[2].body_text).toContain("calendar invite");
      expect(messages[2].body_text).toContain("Competency program");
      expect(messages[2].to_header).toBe(
        "Bob Lee <bob@aws.example.com>; Dana Wright <dana@aws.example.com>"
      );
      expect(messages[2].cc_header).toBeNull();
    });

    it("strips 'Sent from my iPhone' from Alice's first message", () => {
      expect(messages[0].body_text).not.toContain("Sent from my iPhone");
    });

    it("strips confidentiality notice from Alice's last message", () => {
      expect(messages[2].body_text).not.toContain("CONFIDENTIALITY NOTICE");
    });

    it("preserves body_raw with original content", () => {
      expect(messages[0].body_raw).toContain("Sent from my iPhone");
    });

    it("parses dates into ISO format", () => {
      const sent = messages[0].sent_at!;
      // Should be a valid ISO date
      expect(new Date(sent).toISOString()).toBe(sent);
      // February 3, 2025
      expect(sent).toContain("2025-02-03");
    });
  });

  describe("single message (no forwarded headers)", () => {
    const body = "Hey, just wanted to check in on the initiative status.";
    const messages = parseForwardedEmail(body, {
      sender: "Jane <jane@example.com>",
      subject: "Check in",
      timestamp: 1738700000,
    });

    it("falls back to single message with envelope metadata", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].sender_name).toBe("Jane");
      expect(messages[0].sender_email).toBe("jane@example.com");
      expect(messages[0].subject).toBe("Check in");
      expect(messages[0].body_text).toBe(body);
    });
  });

  describe("empty body", () => {
    it("returns empty array for empty string", () => {
      expect(parseForwardedEmail("")).toEqual([]);
    });

    it("returns empty array for whitespace-only", () => {
      expect(parseForwardedEmail("   \n\n  ")).toEqual([]);
    });
  });

  describe("Date: header variant (non-Outlook clients)", () => {
    const body = `
From: Carlos <carlos@partner.com>
Date: February 5, 2025 3:00 PM
To: Steven <steven@example.com>
Subject: Partnership Update

Here's the latest on the SaaS migration project.`;

    const messages = parseForwardedEmail(body);

    it("parses Date: header just like Sent: header", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].sender_name).toBe("Carlos");
      expect(messages[0].sender_email).toBe("carlos@partner.com");
      expect(messages[0].subject).toBe("Partnership Update");
      expect(messages[0].body_text).toContain("SaaS migration");
      expect(messages[0].to_header).toBe("Steven <steven@example.com>");
      expect(messages[0].cc_header).toBeNull();
    });
  });

  describe("email-only sender (no display name)", () => {
    const body = `
From: noreply@system.com
Sent: February 5, 2025 3:00 PM
To: Steven <steven@example.com>
Subject: Automated Report

Weekly report attached.`;

    const messages = parseForwardedEmail(body);

    it("handles sender with no angle brackets", () => {
      expect(messages[0].sender_name).toBeNull();
      expect(messages[0].sender_email).toBe("noreply@system.com");
    });
  });

  describe("Outlook header with CC line", () => {
    const body = `
________________________________
From: Tanya Green <tanya.green@qualys.com>
Sent: Friday, February 14, 2025 9:15 AM
To: Steven Romero <sterme@amazon.com>
Cc: CJ Martinez <cj@qualys.com>; Brian Park <bpark@amazon.com>
Subject: Re: Qualys - ISV Accelerate Next Steps

Hi Steven and team,

Just confirming our call for Monday at 10am PT to review the integration roadmap.

Thanks,
Tanya`;

    const messages = parseForwardedEmail(body);

    it("parses the header block even when CC line is present", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].sender_name).toBe("Tanya Green");
      expect(messages[0].sender_email).toBe("tanya.green@qualys.com");
      expect(messages[0].subject).toBe("Re: Qualys - ISV Accelerate Next Steps");
      expect(messages[0].body_text).toContain("integration roadmap");
    });

    it("extracts To header from inner Outlook headers", () => {
      expect(messages[0].to_header).toBe("Steven Romero <sterme@amazon.com>");
    });

    it("extracts CC header from inner Outlook headers", () => {
      expect(messages[0].cc_header).toBe(
        "CJ Martinez <cj@qualys.com>; Brian Park <bpark@amazon.com>"
      );
    });
  });

  describe("forwarded email with signature-only preface", () => {
    const body = `Steven Romero | Growth PDM

________________________________
From: John Smith <john@partner.com>
Sent: Monday, February 16, 2026 10:30 AM
To: Romero, Steven <sterme@amazon.com>
Subject: A&I Solutions partnership

Hi Steven, I wanted to reach out about A&I Solutions as a potential software partner.

Thanks,
John`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "FW: A&I Solutions partnership",
    });

    it("creates 1 message (the real email), not 2", () => {
      expect(messages.length).toBe(1);
    });

    it("body_text is the actual forwarded content, not the signature", () => {
      expect(messages[0].body_text).toContain("A&I Solutions");
      expect(messages[0].body_text).not.toContain("Growth PDM");
    });

    it("does not set forwarder_note for signature-only preface", () => {
      expect(messages[0].forwarder_note).toBeUndefined();
    });
  });

  describe("forwarded email with meaningful preface", () => {
    const body = `Please review and follow up on this — high priority partner.

________________________________
From: Jane Doe <jane@partner.com>
Sent: Friday, February 14, 2026 3:00 PM
To: Steven Romero <sterme@amazon.com>
Subject: WAF Integration Update

Here's the latest on the WAF integration.`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "FW: WAF Integration Update",
    });

    it("creates 1 message with forwarder_note set", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].forwarder_note).toContain("high priority partner");
    });

    it("body_text is the forwarded content", () => {
      expect(messages[0].body_text).toContain("WAF integration");
    });
  });

  describe("forwarded email with blank preface", () => {
    const body = `
________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob Lee <bob@aws.example.com>
Subject: Quick Question

Just a quick question about the timeline.`;

    const messages = parseForwardedEmail(body);

    it("creates 1 message, no forwarder_note", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].forwarder_note).toBeUndefined();
      expect(messages[0].body_text).toContain("quick question");
    });
  });

  describe("CRLF line endings (Mailgun production format)", () => {
    // Mailgun delivers body-plain with \r\n line endings.
    // The parser must normalize these before regex matching.
    const CRLF_THREAD = [
      "FYI — forwarding this thread about the partnership.\r\n",
      "\r\n",
      "________________________________\r\n",
      "From: Alice Chen <alice@partnerco.com>\r\n",
      "Sent: Monday, February 3, 2025 10:30 AM\r\n",
      "To: Bob Lee <bob@aws.example.com>\r\n",
      "Subject: Partnership Update\r\n",
      "\r\n",
      "Hi Bob, here's the latest on the partnership.\r\n",
      "\r\n",
      "Thanks,\r\n",
      "Alice\r\n",
      "\r\n",
      "________________________________\r\n",
      "From: Bob Lee <bob@aws.example.com>\r\n",
      "Sent: Monday, February 3, 2025 2:15 PM\r\n",
      "To: Alice Chen <alice@partnerco.com>\r\n",
      "Cc: Dana Wright <dana@aws.example.com>\r\n",
      "Subject: Re: Partnership Update\r\n",
      "\r\n",
      "Great progress! I'll loop in Dana.\r\n",
    ].join("");

    const messages = parseForwardedEmail(CRLF_THREAD, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "Fwd: Partnership Update",
      timestamp: 1738700000,
    });

    it("splits CRLF thread into 2 messages (not fallback single)", () => {
      expect(messages.length).toBe(2);
    });

    it("parses sender from CRLF headers", () => {
      expect(messages[0].sender_name).toBe("Alice Chen");
      expect(messages[0].sender_email).toBe("alice@partnerco.com");
      expect(messages[1].sender_name).toBe("Bob Lee");
    });

    it("extracts To and Cc from CRLF headers", () => {
      expect(messages[0].to_header).toBe("Bob Lee <bob@aws.example.com>");
      expect(messages[0].cc_header).toBeNull();
      expect(messages[1].cc_header).toBe("Dana Wright <dana@aws.example.com>");
    });

    it("extracts clean body_text without CRLF artifacts", () => {
      expect(messages[0].body_text).toContain("latest on the partnership");
      // body_text should not contain \r after normalization
      expect(messages[0].body_text).not.toContain("\r");
    });

    it("attaches forwarder_note from CRLF preface", () => {
      expect(messages[0].forwarder_note).toContain("forwarding this thread");
    });

    it("parses dates from CRLF headers", () => {
      const sent = messages[0].sent_at!;
      expect(new Date(sent).toISOString()).toBe(sent);
      expect(sent).toContain("2025-02-03");
    });
  });

  describe("mixed CRLF and LF line endings", () => {
    // Some clients produce mixed line endings
    const MIXED = [
      "From: Carlos <carlos@partner.com>\r\n",
      "Sent: February 5, 2025 3:00 PM\n",
      "To: Steven <steven@example.com>\r\n",
      "Subject: Mixed Endings\r\n",
      "\n",
      "Body with mixed line endings.\r\n",
    ].join("");

    const messages = parseForwardedEmail(MIXED);

    it("handles mixed CRLF/LF correctly", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].sender_name).toBe("Carlos");
      expect(messages[0].subject).toBe("Mixed Endings");
      expect(messages[0].body_text).toContain("mixed line endings");
    });
  });

  describe("bare CR line endings", () => {
    // Old Mac-style \r-only line endings (rare but possible)
    const BARE_CR = [
      "From: Dana <dana@example.com>\r",
      "Sent: February 6, 2025 11:00 AM\r",
      "To: Steven <steven@example.com>\r",
      "Subject: Bare CR Test\r",
      "\r",
      "Message with bare CR line endings.\r",
    ].join("");

    const messages = parseForwardedEmail(BARE_CR);

    it("normalizes bare CR to LF and parses correctly", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].sender_name).toBe("Dana");
      expect(messages[0].subject).toBe("Bare CR Test");
    });
  });

  describe("multi-message thread with CC on some messages", () => {
    const body = `
________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob Lee <bob@aws.example.com>
Subject: Security Review

Initial review request.

________________________________
From: Bob Lee <bob@aws.example.com>
Sent: Monday, February 3, 2025 2:15 PM
To: Alice Chen <alice@partnerco.com>
Cc: Dana Wright <dana@aws.example.com>
Subject: Re: Security Review

Looping in Dana from our SA team.`;

    const messages = parseForwardedEmail(body);

    it("parses both messages (one without CC, one with CC)", () => {
      expect(messages.length).toBe(2);
    });

    it("first message has no CC", () => {
      expect(messages[0].to_header).toBe("Bob Lee <bob@aws.example.com>");
      expect(messages[0].cc_header).toBeNull();
    });

    it("second message has CC", () => {
      expect(messages[1].to_header).toBe("Alice Chen <alice@partnerco.com>");
      expect(messages[1].cc_header).toBe("Dana Wright <dana@aws.example.com>");
    });
  });

  describe("Gmail single quote → 2 messages", () => {
    const body = `Hi team, here's an update on the Spacelift integration.

We finalized the architecture doc and sent it to their engineering lead.

On Mon, Feb 3, 2025 at 10:30 AM Alice Chen <alice@partnerco.com> wrote:
Thanks for the update! I've reviewed the doc and have a few comments.

Can we schedule a call this week to discuss?

Best,
Alice`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "Re: Spacelift Integration",
      timestamp: 1738700000,
    });

    it("splits into 2 messages", () => {
      expect(messages.length).toBe(2);
    });

    it("newest message has envelope sender", () => {
      expect(messages[0].sender_name).toBe("Steven Romero");
      expect(messages[0].sender_email).toBe("sterme@amazon.com");
      expect(messages[0].body_text).toContain("Spacelift integration");
    });

    it("older message has Gmail-extracted sender", () => {
      expect(messages[1].sender_email).toBe("alice@partnerco.com");
      expect(messages[1].sender_name).toBe("Alice Chen");
      expect(messages[1].body_text).toContain("reviewed the doc");
    });

    it("both messages share the envelope subject", () => {
      expect(messages[0].subject).toBe("Re: Spacelift Integration");
      expect(messages[1].subject).toBe("Re: Spacelift Integration");
    });

    it("parses sent_at from Gmail date", () => {
      expect(messages[1].sent_at).not.toBeNull();
      expect(messages[1].sent_at).toContain("2025-02-03");
    });
  });

  describe("Gmail multi-level → 3 messages", () => {
    const body = `Got it, I'll prepare the demo environment.

On Tue, Feb 4, 2025 at 2:15 PM Bob Lee <bob@partner.com> wrote:
Sounds good. Let me know if you need access to our staging server.

On Mon, Feb 3, 2025 at 10:30 AM Alice Chen <alice@partnerco.com> wrote:
Can we set up a demo for the client next week?`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "Re: Demo Setup",
      timestamp: 1738700000,
    });

    it("splits into 3 messages (newest → oldest)", () => {
      expect(messages.length).toBe(3);
    });

    it("newest message is from envelope sender", () => {
      expect(messages[0].sender_email).toBe("sterme@amazon.com");
      expect(messages[0].body_text).toContain("demo environment");
    });

    it("middle message is from Bob", () => {
      expect(messages[1].sender_email).toBe("bob@partner.com");
      expect(messages[1].body_text).toContain("staging server");
    });

    it("oldest message is from Alice", () => {
      expect(messages[2].sender_email).toBe("alice@partnerco.com");
      expect(messages[2].body_text).toContain("demo for the client");
    });
  });

  describe("Gmail + Outlook hybrid → Outlook wins", () => {
    const body = `
________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob Lee <bob@aws.example.com>
Subject: Security Review

Hi Bob, here's the security review.

On Mon, Jan 27, 2025 at 3:00 PM, Carlos <carlos@vendor.com> wrote:
Here's the initial assessment.`;

    const messages = parseForwardedEmail(body);

    it("uses Outlook parsing (1 message), Gmail quote stays in body", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].sender_email).toBe("alice@partnerco.com");
      expect(messages[0].body_text).toContain("security review");
      // Gmail quote is part of Alice's message body, not split out
      expect(messages[0].body_text).toContain("initial assessment");
    });
  });

  describe("Gmail wrapped lines → 2 messages", () => {
    const body = `Thanks for the update.

On Mon, Feb 3, 2025 at 10:30 AM
  <alice@partnerco.com> wrote:
Here's the latest status on the migration project.`;

    const messages = parseForwardedEmail(body, {
      sender: "Bob Lee <bob@partner.com>",
      subject: "Re: Migration",
      timestamp: 1738700000,
    });

    it("extracts email from wrapped 2nd line", () => {
      expect(messages.length).toBe(2);
      expect(messages[1].sender_email).toBe("alice@partnerco.com");
      expect(messages[1].body_text).toContain("migration project");
    });
  });

  describe("Apple Mail format → 2 messages", () => {
    const body = `Confirmed, I'll be there.

On Dec 10, 2025, at 7:02 PM, Jane Smith <jane@partner.com> wrote:
Can we meet tomorrow at 3pm to discuss the roadmap?`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "Re: Roadmap Discussion",
      timestamp: 1738700000,
    });

    it("parses Apple Mail style quote", () => {
      expect(messages.length).toBe(2);
    });

    it("extracts sender from Apple Mail format", () => {
      expect(messages[1].sender_email).toBe("jane@partner.com");
      expect(messages[1].sender_name).toBe("Jane Smith");
    });

    it("extracts body from quoted message", () => {
      expect(messages[1].body_text).toContain("roadmap");
    });
  });

  describe("CAUTION banner stripped", () => {
    const body = `CAUTION: This email originated from outside of the organization. Do not click links or open attachments unless you recognize the sender.

Hi Steven,

Just wanted to share the partnership proposal.

Thanks,
Alice`;

    const messages = parseForwardedEmail(body, {
      sender: "Alice Chen <alice@partnerco.com>",
      subject: "Partnership Proposal",
    });

    it("strips CAUTION banner from body_text", () => {
      expect(messages[0].body_text).not.toContain("CAUTION");
      expect(messages[0].body_text).toContain("partnership proposal");
    });

    it("preserves body_raw with CAUTION banner", () => {
      expect(messages[0].body_raw).toContain("CAUTION");
    });
  });

  describe("Signature -- delimiter stripped", () => {
    const body = `Hi Steven,

Let's sync on the integration timeline.

--
Alice Chen
VP Engineering, PartnerCo
alice@partnerco.com
+1 (555) 123-4567`;

    const messages = parseForwardedEmail(body, {
      sender: "Alice Chen <alice@partnerco.com>",
      subject: "Integration Timeline",
    });

    it("strips signature block from body_text", () => {
      expect(messages[0].body_text).toContain("integration timeline");
      expect(messages[0].body_text).not.toContain("VP Engineering");
      expect(messages[0].body_text).not.toContain("555");
    });

    it("preserves body_raw with full signature", () => {
      expect(messages[0].body_raw).toContain("VP Engineering");
    });
  });
});
