import { describe, it, expect } from "vitest";
import { parseForwardedEmail, findGmailQuoteMarkers, stripExternalTag, parseSenderField, cleanMessageBody } from "../email-parser";

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

  describe("Gmail single quote → 2 messages (chronological)", () => {
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

    it("oldest message (Alice) is first after chronological sort", () => {
      expect(messages[0].sender_email).toBe("alice@partnerco.com");
      expect(messages[0].sender_name).toBe("Alice Chen");
      expect(messages[0].body_text).toContain("reviewed the doc");
      expect(messages[0].sent_at).not.toBeNull();
      expect(messages[0].sent_at).toContain("2025-02-03");
    });

    it("newest message (Steven) is last", () => {
      expect(messages[1].sender_name).toBe("Steven Romero");
      expect(messages[1].sender_email).toBe("sterme@amazon.com");
      expect(messages[1].body_text).toContain("Spacelift integration");
    });

    it("both messages share the envelope subject", () => {
      expect(messages[0].subject).toBe("Re: Spacelift Integration");
      expect(messages[1].subject).toBe("Re: Spacelift Integration");
    });
  });

  describe("Gmail multi-level → 3 messages (chronological)", () => {
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

    it("splits into 3 messages", () => {
      expect(messages.length).toBe(3);
    });

    it("oldest message (Alice) is first", () => {
      expect(messages[0].sender_email).toBe("alice@partnerco.com");
      expect(messages[0].body_text).toContain("demo for the client");
    });

    it("middle message is from Bob", () => {
      expect(messages[1].sender_email).toBe("bob@partner.com");
      expect(messages[1].body_text).toContain("staging server");
    });

    it("newest message (Steven) is last", () => {
      expect(messages[2].sender_email).toBe("sterme@amazon.com");
      expect(messages[2].body_text).toContain("demo environment");
    });
  });

  describe("Gmail + Outlook hybrid → two-pass splits both", () => {
    const body = `
________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob Lee <bob@aws.example.com>
Subject: Security Review

Hi Bob, here's the security review.

On Mon, Jan 27, 2025 at 3:00 PM Carlos Ruiz <carlos@vendor.com> wrote:
Here's the initial assessment.`;

    const messages = parseForwardedEmail(body);

    it("splits into 2 messages (Outlook primary + Gmail sub-split)", () => {
      expect(messages.length).toBe(2);
    });

    it("older message (Carlos, from Gmail marker) is first", () => {
      expect(messages[0].sender_email).toBe("carlos@vendor.com");
      expect(messages[0].body_text).toContain("initial assessment");
      expect(messages[0].body_text).not.toContain("security review");
    });

    it("newer message (Alice, from Outlook header) is second", () => {
      expect(messages[1].sender_email).toBe("alice@partnerco.com");
      expect(messages[1].body_text).toContain("security review");
      expect(messages[1].body_text).not.toContain("initial assessment");
    });
  });

  describe("Gmail wrapped lines → 2 messages (chronological)", () => {
    const body = `Thanks for the update.

On Mon, Feb 3, 2025 at 10:30 AM
  <alice@partnerco.com> wrote:
Here's the latest status on the migration project.`;

    const messages = parseForwardedEmail(body, {
      sender: "Bob Lee <bob@partner.com>",
      subject: "Re: Migration",
      timestamp: 1738700000,
    });

    it("extracts email from wrapped 2nd line, oldest first", () => {
      expect(messages.length).toBe(2);
      expect(messages[0].sender_email).toBe("alice@partnerco.com");
      expect(messages[0].body_text).toContain("migration project");
      expect(messages[1].sender_email).toBe("bob@partner.com");
    });
  });

  describe("Apple Mail format → 2 messages (chronological)", () => {
    const body = `Confirmed, I'll be there.

On Dec 10, 2025, at 7:02 PM, Jane Smith <jane@partner.com> wrote:
Can we meet tomorrow at 3pm to discuss the roadmap?`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "Re: Roadmap Discussion",
      timestamp: 1765454400, // Dec 11, 2025 — after Jane's Dec 10
    });

    it("parses Apple Mail style quote", () => {
      expect(messages.length).toBe(2);
    });

    it("older message (Jane) is first after chronological sort", () => {
      expect(messages[0].sender_email).toBe("jane@partner.com");
      expect(messages[0].sender_name).toBe("Jane Smith");
      expect(messages[0].body_text).toContain("roadmap");
    });

    it("newer message (Steven) is second", () => {
      expect(messages[1].sender_email).toBe("sterme@amazon.com");
      expect(messages[1].body_text).toContain("Confirmed");
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

  // ================================================================
  // Two-pass architecture tests
  // ================================================================

  describe("Two-pass: Outlook + Gmail inside → splits both levels", () => {
    const body = `Steven Romero | Growth PDM

________________________________
From: Marcin Wyszynski <marcinw@spacelift.io>
Sent: Tuesday, January 7, 2026 9:00 AM
To: Julia Irion <juliai@spacelift.io>; Steven Romero <sterme@amazon.com>
Subject: Re: Spacelift ISV Accelerate

CAUTION: This email originated from outside of the organization. Do not click links or open attachments.

Hi folks, now that we're presumably all back from the holidays, I wanted to follow up on this thread.

Best,
Marcin

On Wed, Dec 10, 2025 at 7:02 PM Julia Irion <juliai@spacelift.io> wrote:
Hi all, Hope everyone had a great re:Invent! I wanted to connect regarding the ISV Accelerate program.

--
Julia Irion
Head of Channel & Alliances, Spacelift`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "FW: Spacelift ISV Accelerate",
    });

    it("produces 2 messages from the Outlook+Gmail split", () => {
      expect(messages.length).toBe(2);
    });

    it("Julia's older message is first (chronological)", () => {
      expect(messages[0].sender_email).toBe("juliai@spacelift.io");
      expect(messages[0].sender_name).toBe("Julia Irion");
      expect(messages[0].body_text).toContain("re:Invent");
      expect(messages[0].body_text).toContain("ISV Accelerate");
    });

    it("Marcin's newer message is second", () => {
      expect(messages[1].sender_email).toBe("marcinw@spacelift.io");
      expect(messages[1].sender_name).toBe("Marcin Wyszynski");
      expect(messages[1].body_text).toContain("follow up on this thread");
    });

    it("strips CAUTION banner from Marcin's message", () => {
      expect(messages[1].body_text).not.toContain("CAUTION");
    });

    it("strips Julia's signature from her message", () => {
      expect(messages[0].body_text).not.toContain("Head of Channel");
    });

    it("Marcin's body does NOT contain Julia's quoted text", () => {
      expect(messages[1].body_text).not.toContain("re:Invent");
      expect(messages[1].body_text).not.toContain("Julia Irion");
    });

    it("does not set forwarder_note for signature-only preface", () => {
      expect(messages[0].forwarder_note).toBeUndefined();
      expect(messages[1].forwarder_note).toBeUndefined();
    });
  });

  describe("Three-level deep: Outlook → Gmail → Gmail", () => {
    const body = `
________________________________
From: Charlie <charlie@co.com>
Sent: Wednesday, March 5, 2025 3:00 PM
To: Steven <sterme@amazon.com>
Subject: Re: Deep Thread

Charlie's message here.

On Tue, Mar 4, 2025 at 2:00 PM Bob Smith <bob@co.com> wrote:
Bob's reply to Alice.

On Mon, Mar 3, 2025 at 10:00 AM Alice Jones <alice@co.com> wrote:
Alice started this thread.`;

    const messages = parseForwardedEmail(body);

    it("produces 3 messages from nested splits", () => {
      expect(messages.length).toBe(3);
    });

    it("sorts chronologically: Alice, Bob, Charlie", () => {
      expect(messages[0].sender_email).toBe("alice@co.com");
      expect(messages[0].body_text).toContain("started this thread");
      expect(messages[1].sender_email).toBe("bob@co.com");
      expect(messages[1].body_text).toContain("reply to Alice");
      expect(messages[2].sender_email).toBe("charlie@co.com");
      expect(messages[2].body_text).toContain("Charlie's message");
    });

    it("each message body is clean (no quotes from other messages)", () => {
      expect(messages[2].body_text).not.toContain("reply to Alice");
      expect(messages[2].body_text).not.toContain("started this thread");
      expect(messages[1].body_text).not.toContain("started this thread");
    });
  });

  describe("Generic separator: ---- Original Message ----", () => {
    const body = `
________________________________
From: Bob Lee <bob@partner.com>
Sent: Monday, February 10, 2025 11:00 AM
To: Steven <sterme@amazon.com>
Subject: FW: Status Update

Here's the forwarded thread.

---- Original Message ----
The original message content from the partner about the project timeline.`;

    const messages = parseForwardedEmail(body);

    it("splits at generic separator", () => {
      expect(messages.length).toBe(2);
    });

    it("parent has Bob's content", () => {
      const bobMsg = messages.find(m => m.sender_email === "bob@partner.com");
      expect(bobMsg).toBeDefined();
      expect(bobMsg!.body_text).toContain("forwarded thread");
      expect(bobMsg!.body_text).not.toContain("project timeline");
    });

    it("child has the original message content", () => {
      const childMsg = messages.find(m => m.sender_email === null);
      expect(childMsg).toBeDefined();
      expect(childMsg!.body_text).toContain("project timeline");
    });
  });

  describe("Recursive depth limit (6+ levels stops at 5)", () => {
    // Build a deeply nested Gmail thread (6 levels)
    let body = "Level 6 content.\n";
    for (let i = 5; i >= 1; i--) {
      body = `Level ${i} content.\n\nOn Mon, Jan ${i}, 2025 at ${i}:00 PM Person${i} <p${i}@co.com> wrote:\n${body}`;
    }
    body = `Top level content.\n\n${body}`;

    const messages = parseForwardedEmail(body, {
      sender: "Top <top@co.com>",
      subject: "Deep Thread",
      timestamp: 1738700000,
    });

    it("caps at max depth (does not exceed 6 total messages)", () => {
      // 5 levels of recursion + 1 top level = at most 6 messages
      // Level 6 content gets merged into level 5's body
      expect(messages.length).toBeLessThanOrEqual(6);
      expect(messages.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Empty parent: quote marker at start of body", () => {
    const body = `
________________________________
From: Alice <alice@co.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob <bob@co.com>
Subject: Re: Discussion

On Mon, Feb 3, 2025 at 9:00 AM Bob Smith <bob@co.com> wrote:
Hey Alice, what do you think about the proposal?`;

    const messages = parseForwardedEmail(body);

    it("does not create an empty parent message", () => {
      // Alice's body is empty (all content is Bob's quote)
      // Should produce Bob's message, possibly Alice's empty one is dropped
      for (const msg of messages) {
        expect(msg.body_text.trim().length).toBeGreaterThan(0);
      }
    });

    it("Bob's quoted message is extracted", () => {
      const bobMsg = messages.find(m => m.sender_email === "bob@co.com");
      expect(bobMsg).toBeDefined();
      expect(bobMsg!.body_text).toContain("proposal");
    });
  });

  describe("Signature stripped per-message in two-pass", () => {
    const body = `
________________________________
From: Marcin <marcinw@spacelift.io>
Sent: Tuesday, January 7, 2026 9:00 AM
To: Steven <sterme@amazon.com>
Subject: Re: Integration

Marcin's main message here.

--
Marcin Wyszynski
CTO, Spacelift

On Wed, Dec 10, 2025 at 7:02 PM Julia Irion <juliai@spacelift.io> wrote:
Julia's original message about the integration.

--
Julia Irion
Head of Channel & Alliances, Spacelift`;

    const messages = parseForwardedEmail(body);

    it("strips Marcin's signature from his message", () => {
      const marcin = messages.find(m => m.sender_email === "marcinw@spacelift.io");
      expect(marcin).toBeDefined();
      expect(marcin!.body_text).toContain("main message");
      expect(marcin!.body_text).not.toContain("CTO");
    });

    it("strips Julia's signature from her message", () => {
      const julia = messages.find(m => m.sender_email === "juliai@spacelift.io");
      expect(julia).toBeDefined();
      expect(julia!.body_text).toContain("original message");
      expect(julia!.body_text).not.toContain("Head of Channel");
    });
  });

  describe("Chronological: messages without dates go at end", () => {
    const body = `
________________________________
From: Alice <alice@co.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob <bob@co.com>
Subject: Thread

Alice's message.

---- Original Message ----
Undated original content.`;

    const messages = parseForwardedEmail(body);

    it("dated message comes before undated message", () => {
      expect(messages.length).toBe(2);
      // Alice has a date, generic separator child does not
      expect(messages[0].sent_at).not.toBeNull();
      expect(messages[1].sent_at).toBeNull();
    });
  });

  describe("forwarder preface: multi-line corporate signature stripped", () => {
    const body = `Steven Romero
Partner Development Manager
Amazon Web Services
sterme@amazon.com
(206) 555-1234

________________________________
From: John Smith <john@partner.com>
Sent: Monday, February 16, 2026 10:30 AM
To: Romero, Steven <sterme@amazon.com>
Subject: Partnership Update

Hi Steven, let's discuss the partnership.`;

    const messages = parseForwardedEmail(body, {
      sender: "Steven Romero <sterme@amazon.com>",
      subject: "FW: Partnership Update",
    });

    it("does not set forwarder_note for a full corporate signature", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].forwarder_note).toBeUndefined();
    });
  });

  describe("forwarder preface: signature with closing stripped", () => {
    const body = `Thanks,
Steven Romero

________________________________
From: Alice Chen <alice@partnerco.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Bob Lee <bob@aws.example.com>
Subject: Quick Question

Just a quick question about the timeline.`;

    const messages = parseForwardedEmail(body);

    it("does not set forwarder_note for closing + name", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].forwarder_note).toBeUndefined();
    });
  });

  describe("forwarder preface: real note preserved alongside signature lines", () => {
    const body = `Please review and follow up on this — high priority partner. We need to close this before end of quarter.

Steven Romero
sterme@amazon.com

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

    it("preserves the typed note and strips the signature lines", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].forwarder_note).toContain("high priority partner");
      expect(messages[0].forwarder_note).not.toContain("sterme@amazon.com");
    });
  });

  describe("forwarder preface: phone number and URL lines stripped", () => {
    const body = `Steven Romero | Growth PDM
Amazon Web Services
(206) 555-1234
https://aws.amazon.com

________________________________
From: Partner <partner@co.com>
Sent: Monday, February 3, 2025 10:30 AM
To: Steven <sterme@amazon.com>
Subject: Update

Update on the project.`;

    const messages = parseForwardedEmail(body);

    it("strips all signature lines including phone and URL", () => {
      expect(messages.length).toBe(1);
      expect(messages[0].forwarder_note).toBeUndefined();
    });
  });
});

describe("stripExternalTag", () => {
  it("strips [EXTERNAL] prefix", () => {
    expect(stripExternalTag("[EXTERNAL] Re: Partnership Update")).toBe("Re: Partnership Update");
  });

  it("strips [EXT] prefix", () => {
    expect(stripExternalTag("[EXT] Fwd: Meeting Notes")).toBe("Fwd: Meeting Notes");
  });

  it("strips External : prefix", () => {
    expect(stripExternalTag("External : Security Review")).toBe("Security Review");
  });

  it("strips [External Email] prefix", () => {
    expect(stripExternalTag("[External Email] Partnership Proposal")).toBe("Partnership Proposal");
  });

  it("is case-insensitive", () => {
    expect(stripExternalTag("[external] Test Subject")).toBe("Test Subject");
    expect(stripExternalTag("[EXTERNAL] Test Subject")).toBe("Test Subject");
    expect(stripExternalTag("[External] Test Subject")).toBe("Test Subject");
  });

  it("preserves subjects without external tags", () => {
    expect(stripExternalTag("Re: Normal Subject")).toBe("Re: Normal Subject");
    expect(stripExternalTag("FW: Partnership Update")).toBe("FW: Partnership Update");
  });

  it("handles empty string", () => {
    expect(stripExternalTag("")).toBe("");
  });

  it("only strips from the beginning", () => {
    expect(stripExternalTag("Re: [EXTERNAL] Deep Subject")).toBe("Re: [EXTERNAL] Deep Subject");
  });
});

describe("parseSenderField", () => {
  it("handles Outlook mailto double-bracket format", () => {
    const result = parseSenderField("Sturgess, CJ <sturgeci@amazon.com<mailto:sturgeci@amazon.com>>");
    expect(result).toEqual({ senderName: "CJ Sturgess", senderEmail: "sturgeci@amazon.com" });
  });

  it("handles Tim Wikander mailto format", () => {
    const result = parseSenderField("Tim Wikander <tim.wikander@opswat.com<mailto:tim.wikander@opswat.com>>");
    expect(result).toEqual({ senderName: "Tim Wikander", senderEmail: "tim.wikander@opswat.com" });
  });

  it("handles normal Name <email> format", () => {
    const result = parseSenderField("John Doe <john@example.com>");
    expect(result).toEqual({ senderName: "John Doe", senderEmail: "john@example.com" });
  });

  it("handles bare angle-bracket email (no name)", () => {
    const result = parseSenderField("<john@example.com>");
    expect(result).toEqual({ senderName: null, senderEmail: "john@example.com" });
  });

  it("handles bare email address", () => {
    const result = parseSenderField("john@example.com");
    expect(result).toEqual({ senderName: null, senderEmail: "john@example.com" });
  });

  it("flips comma-inverted names from Outlook headers", () => {
    const result = parseSenderField("Inglis, Matt <mjinglis@amazon.com<mailto:mjinglis@amazon.com>>");
    expect(result).toEqual({ senderName: "Matt Inglis", senderEmail: "mjinglis@amazon.com" });
  });

  it("flips comma-inverted names with apostrophes", () => {
    const result = parseSenderField("O'Brien, Pat <pat@co.com<mailto:pat@co.com>>");
    expect(result).toEqual({ senderName: "Pat O'Brien", senderEmail: "pat@co.com" });
  });

  it("does NOT flip company names with Inc/LLC", () => {
    const result = parseSenderField("ACME, Inc. <sales@acme.com>");
    expect(result).toEqual({ senderName: "ACME, Inc.", senderEmail: "sales@acme.com" });
  });

  it("treats name-equals-email as no-name", () => {
    const result = parseSenderField("john@example.com <john@example.com>");
    expect(result).toEqual({ senderName: null, senderEmail: "john@example.com" });
  });

  it("handles plain name without email", () => {
    const result = parseSenderField("John Doe");
    expect(result).toEqual({ senderName: "John Doe", senderEmail: null });
  });

  it("nulls alias-as-name when name equals email local part", () => {
    const result = parseSenderField("Crisresl <crisresl@amazon.com>");
    expect(result).toEqual({ senderName: null, senderEmail: "crisresl@amazon.com" });
  });

  it("nulls alias-as-name case-insensitively", () => {
    const result = parseSenderField("MJINGLIS <mjinglis@amazon.com>");
    expect(result).toEqual({ senderName: null, senderEmail: "mjinglis@amazon.com" });
  });

  it("keeps legitimate single-word name that differs from local part", () => {
    const result = parseSenderField("Madonna <info@music.com>");
    expect(result).toEqual({ senderName: "Madonna", senderEmail: "info@music.com" });
  });

  it("nulls message-ID-like name (long hex string)", () => {
    const result = parseSenderField("abc123def456ghi789 <abc123def456ghi789@mail.gmail.com>");
    expect(result).toEqual({ senderName: null, senderEmail: "abc123def456ghi789@mail.gmail.com" });
  });

  it("nulls message-ID with dashes and dots", () => {
    const result = parseSenderField("a1b2c3d4-e5f6-7890-abcd-ef1234567890 <noreply@example.com>");
    expect(result).toEqual({ senderName: null, senderEmail: "noreply@example.com" });
  });

  it("keeps short alphanumeric names that aren't message-IDs", () => {
    const result = parseSenderField("Bob123 <bob@example.com>");
    expect(result).toEqual({ senderName: "Bob123", senderEmail: "bob@example.com" });
  });
});

// ============================================================
// cleanMessageBody tests
// ============================================================

describe("cleanMessageBody", () => {
  it("strips corporate signature block at bottom (3+ consecutive signature lines)", () => {
    const body = `Hi team,

Here's the update on the migration project. We've completed phase 1.

Best regards,

Steven Romero
Partner Development Manager | AWS
(206) 555-1234
sterme@amazon.com`;

    const result = cleanMessageBody(body);
    expect(result).toContain("migration project");
    expect(result).not.toContain("Partner Development Manager");
    expect(result).not.toContain("(206) 555-1234");
    expect(result).not.toContain("sterme@amazon.com");
  });

  it("strips Exclaimer/Mimecast tracking URLs", () => {
    const body = `Please review the attached document.

https://protect-us.mimecast.com/s/abc123def456?domain=example.com

Looking forward to your feedback.`;

    const result = cleanMessageBody(body);
    expect(result).toContain("review the attached document");
    expect(result).not.toContain("mimecast.com");
  });

  it("strips image placeholders", () => {
    const body = `Here's the diagram:

[image001.png]

As you can see, the architecture uses three tiers.

[cid:image002@01D8A9]`;

    const result = cleanMessageBody(body);
    expect(result).toContain("diagram");
    expect(result).toContain("three tiers");
    expect(result).not.toContain("[image001.png]");
    expect(result).not.toContain("[cid:image002@01D8A9]");
  });

  it("preserves short reply content, only strips noise", () => {
    const body = `Thanks, will review today.

Sent from my iPhone`;

    const result = cleanMessageBody(body, { skipSignatureStrip: true });
    expect(result).toContain("Thanks, will review today.");
    expect(result).not.toContain("Sent from my iPhone");
  });

  it("preserves real content interspersed with phone numbers", () => {
    const body = `Call me at (206) 555-1234 to discuss the project details.

The deadline is next Friday and we need to finalize the architecture.`;

    const result = cleanMessageBody(body);
    // Phone number is in body text, not at the bottom as part of a signature
    expect(result).toContain("(206) 555-1234");
    expect(result).toContain("deadline is next Friday");
  });

  it("does NOT strip fewer than 3 consecutive signature-like lines at bottom", () => {
    const body = `Let's discuss tomorrow.

Best regards,
Alice`;

    const result = cleanMessageBody(body);
    // Only 2 lines match (salutation + name) — below threshold
    expect(result).toContain("discuss tomorrow");
    expect(result).toContain("Best regards");
  });

  it("strips blocks of 3+ consecutive URL-only lines (HTML artifacts)", () => {
    const body = `Check out our resources:

https://example.com/page1
https://example.com/page2
https://example.com/page3
https://example.com/page4

Let me know if you have questions.`;

    const result = cleanMessageBody(body);
    expect(result).toContain("resources");
    expect(result).toContain("questions");
    expect(result).not.toContain("example.com/page1");
  });

  it("is idempotent — running twice produces the same result", () => {
    const body = `Update on the project.

Steven Romero
Partner Development Manager | AWS
(206) 555-1234
sterme@amazon.com
https://protect-us.mimecast.com/s/xyz789`;

    const once = cleanMessageBody(body);
    const twice = cleanMessageBody(once);
    expect(twice).toBe(once);
  });

  it("strips unsubscribe footers", () => {
    const body = `Newsletter content here.

To unsubscribe from these emails, click here.`;

    const result = cleanMessageBody(body);
    expect(result).toContain("Newsletter content");
    expect(result).not.toContain("unsubscribe");
  });
});
