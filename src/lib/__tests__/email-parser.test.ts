import { describe, it, expect } from "vitest";
import { parseForwardedEmail } from "../email-parser";

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

    it("extracts the forwarder's preface + 3 thread messages = 4 total", () => {
      expect(messages.length).toBe(4);
    });

    it("first message is the forwarder's own note", () => {
      expect(messages[0].sender_name).toBe("Steven Romero");
      expect(messages[0].sender_email).toBe("steven@example.com");
      expect(messages[0].body_text).toContain("forwarding this thread");
      expect(messages[0].subject).toBe("Fwd: Security Review Next Steps");
    });

    it("parses the first thread message (Alice)", () => {
      expect(messages[1].sender_name).toBe("Alice Chen");
      expect(messages[1].sender_email).toBe("alice@partnerco.com");
      expect(messages[1].subject).toBe("Security Review Next Steps");
      expect(messages[1].sent_at).not.toBeNull();
      expect(messages[1].body_text).toContain("Project Falcon");
    });

    it("parses the second thread message (Bob)", () => {
      expect(messages[2].sender_name).toBe("Bob Lee");
      expect(messages[2].sender_email).toBe("bob@aws.example.com");
      expect(messages[2].subject).toBe("Re: Security Review Next Steps");
      expect(messages[2].body_text).toContain("Thursday at 2pm");
      expect(messages[2].body_text).toContain("re:Invent");
    });

    it("parses the third thread message (Alice reply)", () => {
      expect(messages[3].sender_name).toBe("Alice Chen");
      expect(messages[3].sender_email).toBe("alice@partnerco.com");
      expect(messages[3].body_text).toContain("calendar invite");
      expect(messages[3].body_text).toContain("Competency program");
    });

    it("strips 'Sent from my iPhone' from Alice's first message", () => {
      expect(messages[1].body_text).not.toContain("Sent from my iPhone");
    });

    it("strips confidentiality notice from Alice's last message", () => {
      expect(messages[3].body_text).not.toContain("CONFIDENTIALITY NOTICE");
    });

    it("preserves body_raw with original content", () => {
      expect(messages[1].body_raw).toContain("Sent from my iPhone");
    });

    it("parses dates into ISO format", () => {
      const sent = messages[1].sent_at!;
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
});
