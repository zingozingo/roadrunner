import { parseForwardedEmail, parseSenderField, stripExternalTag } from "@/lib/email-parser";
import { storeMessages, createMeetingFromICS, stampPartnerOnMessages, stampPartnerOnMeeting, getMeeting, getPartner } from "@/lib/db";
import { extractICSFromAttachments, parseICSContent } from "@/lib/ics-parser";
import { detectPartnerFromEmail, detectPartnerFromSubject } from "@/lib/partner-detection";
import { stripPRVS, isUserEmail, USER_CONFIG } from "@/lib/user-config";
import { buildNameResolutionMap, resolveNameByEmail } from "@/lib/name-resolver";

// --- Types ---

export interface InboundEmailFields {
  sender: string;
  subject: string;
  bodyPlain: string;
  strippedText: string;
  bodyCalendar: string;
  toHeader: string;
  ccHeader: string;
  rawFormData: FormData | null;
  timestamp: number;
}

export interface InboundResult {
  status: "ok" | "empty_body" | "no_messages";
  stored: number;
  meetingCreated: boolean;
  detectedPartner: string | null;
}

// --- Private helpers ---

/**
 * Smart body selection for forwarded emails.
 *
 * Mailgun's stripped-text removes "quoted" content — which includes forwarded
 * email threads. For forwarded emails, body-plain preserves the full content
 * the email parser needs (From:/Sent:/To:/Subject: header blocks).
 *
 * Strategy:
 * 1. If body-plain has Outlook forward markers that stripped-text lost -> use body-plain
 * 2. If body-plain has Gmail/Apple Mail quote markers stripped-text lost -> use body-plain
 * 3. If body-plain is significantly longer (3x+) -> stripped-text probably lost content
 * 4. Default to stripped-text (cleaner for non-forwarded, direct emails)
 */
function selectEmailBody(strippedText: string, bodyPlain: string): string {
  const stripped = strippedText.trim();
  const plain = bodyPlain.trim();

  if (!stripped && !plain) return "";
  if (!stripped) return plain;
  if (!plain) return stripped;

  // Check if body-plain has Outlook forward markers that stripped-text lost
  const hasForwardMarkers = (text: string) =>
    /^From:\s/m.test(text) && /^Sent:\s/m.test(text);
  const plainHasMarkers = hasForwardMarkers(plain);
  const strippedHasMarkers = hasForwardMarkers(stripped);

  if (plainHasMarkers && !strippedHasMarkers) {
    console.log(
      `[BODY] Using body-plain (${plain.length} chars) — stripped-text lost forwarded content (${stripped.length} chars)`
    );
    return plain;
  }

  // Check if body-plain has Gmail/Apple Mail quote markers that stripped-text lost
  const hasGmailQuote = (text: string) => /^On .+wrote:\s*$/m.test(text);
  const plainHasGmail = hasGmailQuote(plain);
  const strippedHasGmail = hasGmailQuote(stripped);

  if (plainHasGmail && !strippedHasGmail) {
    console.log(
      `[BODY] Using body-plain (${plain.length} chars) — stripped-text lost Gmail-quoted thread content (${stripped.length} chars)`
    );
    return plain;
  }

  // If body-plain is significantly longer, stripped-text probably lost content
  if (plain.length > stripped.length * 3 && plain.length > 200) {
    console.log(
      `[BODY] Using body-plain (${plain.length} chars) — significantly longer than stripped-text (${stripped.length} chars)`
    );
    return plain;
  }

  console.log(`[BODY] Using stripped-text (${stripped.length} chars)`);
  return stripped;
}

// --- Main pipeline ---

/**
 * Process an inbound email through the full pipeline:
 * body selection -> parse -> name resolution -> store -> partner detection -> ICS extraction.
 *
 * This is the core business logic extracted from the inbound webhook route.
 * The route handles HTTP concerns (form parsing, signature verification, response formatting).
 */
export async function processInboundEmail(fields: InboundEmailFields): Promise<InboundResult> {
  const { sender, subject, bodyPlain, strippedText, bodyCalendar, toHeader, ccHeader, rawFormData, timestamp } = fields;

  // Smart body selection — prefers body-plain when forwarded content is detected
  const emailBody = selectEmailBody(strippedText, bodyPlain);

  // Parse forwarder identity from Mailgun envelope sender.
  // When Steven forwards to Relay, Mailgun's "sender" = Steven's address.
  const { senderName: parsedForwarderName, senderEmail: rawForwarderEmail } =
    parseSenderField(sender);

  // Strip Proofpoint PRVS wrapping (prvs=XXXXXX=real@email.com -> real@email.com)
  const strippedForwarderEmail = rawForwarderEmail ? stripPRVS(rawForwarderEmail) : null;

  // When the sender is the PDM (corpmail, PRVS, or direct), use canonical identity.
  // Amazon SES rewrites From: with tracking IDs like {id}@corpmail.amazon.com,
  // which loses the display name — fall back to USER_CONFIG for consistent identity.
  const senderIsUser = strippedForwarderEmail ? isUserEmail(strippedForwarderEmail) : false;
  const forwarderName = senderIsUser ? USER_CONFIG.name : parsedForwarderName;
  const forwarderEmail = senderIsUser ? USER_CONFIG.email : strippedForwarderEmail;

  // Filter the Relay inbound address out of the To header — Claude doesn't need it
  const relayAddress = (process.env.RELAY_EMAIL_ADDRESS ?? "").toLowerCase();
  const filteredTo = toHeader
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !relayAddress || !s.toLowerCase().includes(relayAddress))
    .join(", ");

  if (!emailBody.trim()) {
    console.warn("Inbound webhook received empty email body");
    return { status: "empty_body", stored: 0, meetingCreated: false, detectedPartner: null };
  }

  // Parse forwarded email into individual messages
  const parsed = parseForwardedEmail(emailBody, {
    sender,
    subject,
    timestamp,
  });

  // Stamp forwarder identity onto every parsed message.
  // For To/CC: prefer inner Outlook headers extracted by the parser (set per-message),
  // fall back to Mailgun's outer envelope fields (for direct, non-forwarded emails).
  for (const msg of parsed) {
    msg.forwarder_email = forwarderEmail ?? null;
    msg.forwarder_name = forwarderName ?? null;
    msg.to_header = msg.to_header || filteredTo || null;
    msg.cc_header = msg.cc_header || ccHeader || null;
    // Strip PRVS from sender_email (same issue as forwarder_email)
    if (msg.sender_email) {
      msg.sender_email = stripPRVS(msg.sender_email);
    }
    // forwarder_note is already set by email-parser if a preface was detected
  }

  console.log(`Email parsing: extracted ${parsed.length} message(s) from "${subject}"`);

  if (parsed.length === 0) {
    console.warn("Email parser produced no messages");
    return { status: "no_messages", stored: 0, meetingCreated: false, detectedPartner: null };
  }

  // --- Name resolution: email-first sender name enrichment ---
  // Resolution chain ALWAYS determines display name. Parser-extracted names
  // are fallback only (catalog/participant data is more trustworthy than
  // messy email headers). Parser names that differ from resolved names are
  // logged as learning signals for future participant enrichment.
  const nameMap = await buildNameResolutionMap();
  let namesResolved = 0;
  let namesFallback = 0;
  for (const msg of parsed) {
    if (msg.sender_email) {
      const resolved = resolveNameByEmail(msg.sender_email, nameMap);
      if (resolved) {
        // Log when parser name differs from resolved name (learning signal)
        if (msg.sender_name && msg.sender_name !== resolved.name) {
          console.log(
            `[NAME] Resolved "${resolved.name}" (${resolved.source}) overrides parser "${msg.sender_name}" for ${msg.sender_email}`
          );
        }
        msg.sender_name = resolved.name;
        namesResolved++;
      } else if (msg.sender_name) {
        // No resolution — keep parser name as fallback
        namesFallback++;
      }
      // If both are null, leave null — displayName() will derive from email
    }
  }
  if (namesResolved > 0 || namesFallback > 0) {
    console.log(
      `Name resolution: ${namesResolved} resolved from DB, ${namesFallback} kept from parser`
    );
  }

  console.log(`Parsed ${parsed.length} messages, proceeding to storage (per-message dedup handles duplicates)`);

  // Store in Supabase (unclassified — engagement_id = null)
  const stored = await storeMessages(parsed);
  const storedIds = stored.map((m) => m.id);

  console.log(`Supabase storage: stored ${stored.length} message(s), ids=[${storedIds.join(", ")}]`);

  // --- Mechanical partner detection (no AI) ---
  // Iterate ALL parsed messages — first partner-domain match wins.
  // Fixes threads where parsed[0] is from a non-partner (agency, AWS internal)
  // but later messages contain partner-domain senders.
  let detectedPartner: { partnerId: string; partnerName: string } | null = null;
  try {
    for (const msg of parsed) {
      detectedPartner = await detectPartnerFromEmail(
        msg.sender_email ?? '',
        msg.to_header ?? toHeader ?? null,
        msg.cc_header ?? ccHeader ?? null,
        msg.body_text ?? emailBody ?? null
      );
      if (detectedPartner) break;
    }
    // Fallback: subject-line partner name matching when domain matching finds nothing
    if (!detectedPartner) {
      detectedPartner = await detectPartnerFromSubject(subject);
      if (detectedPartner) {
        console.log(`Partner detection (subject fallback): ${detectedPartner.partnerName}`);
      }
    }
    if (detectedPartner) {
      await stampPartnerOnMessages(storedIds, detectedPartner.partnerId);
      console.log(`Partner detection: ${detectedPartner.partnerName} (${storedIds.length} messages)`);
    } else {
      console.log("Partner detection: no match (user will pick in inbox)");
    }
  } catch (partnerError) {
    console.error("Partner detection failed (non-blocking):", partnerError);
  }

  // --- ICS Meeting Creation (Phase 1) ---
  // Extract ICS from: body-calendar field -> inline body-plain -> file attachment.
  // Non-blocking: failures here never prevent email processing.
  let meetingCreated = false;
  let meetingId: string | null = null;
  try {
    let icsContent: string | null = null;
    let icsSource = "";

    // Path A: body-calendar field (Mailgun provides this for meeting invites)
    if (bodyCalendar && bodyCalendar.includes("BEGIN:VCALENDAR")) {
      icsContent = bodyCalendar;
      icsSource = "body-calendar";
      console.log(`[ICS] Found body-calendar field (${bodyCalendar.length} chars)`);
    }

    // Path B: Inline VCALENDAR in body-plain
    if (!icsContent && bodyPlain.includes("BEGIN:VCALENDAR")) {
      const vcalStart = bodyPlain.indexOf("BEGIN:VCALENDAR");
      const vcalEnd = bodyPlain.indexOf("END:VCALENDAR");
      if (vcalEnd > vcalStart) {
        icsContent = bodyPlain.substring(vcalStart, vcalEnd + "END:VCALENDAR".length);
        icsSource = "body-plain inline";
        console.log(`[ICS] Found inline VCALENDAR in body-plain (${icsContent.length} chars)`);
      }
    }

    // Path C: File attachment (only works with multipart/form-data)
    if (!icsContent && rawFormData) {
      icsContent = await extractICSFromAttachments(rawFormData);
      if (icsContent) {
        icsSource = "file attachment";
        console.log(`[ICS] Found .ics file attachment (${icsContent.length} chars)`);
      }
    }

    // Parse and create meeting record
    if (icsContent) {
      const parsedMeeting = parseICSContent(icsContent);
      if (parsedMeeting) {
        console.log(`[ICS] Parsed meeting: "${parsedMeeting.title}" on ${parsedMeeting.meeting_date} (source: ${icsSource})`);
        meetingId = await createMeetingFromICS(parsedMeeting, storedIds[0]);
        meetingCreated = meetingId !== null;
        console.log(`[ICS] ${meetingCreated ? `Created meeting ${meetingId}` : "Deduped (already exists)"}`);
      } else {
        console.warn(`[ICS] Found calendar data (${icsSource}) but could not parse it`);
      }
    }
  } catch (icsError) {
    console.error("ICS extraction/parsing failed (non-blocking):", icsError);
  }

  // If a meeting was created and we detected a partner from email headers, stamp it on the meeting.
  // If email detection failed but the meeting detected a partner from ICS attendees, backfill it onto the messages.
  if (meetingCreated && meetingId) {
    try {
      if (detectedPartner) {
        // Email headers found the partner — stamp it on the meeting too
        await stampPartnerOnMeeting(meetingId, detectedPartner.partnerId);
      } else {
        // Email headers missed the partner — check if the meeting found one from ICS attendees
        const meeting = await getMeeting(meetingId);

        if (meeting?.partner_id) {
          await stampPartnerOnMessages(storedIds, meeting.partner_id);

          // Look up partner name for logging
          const partner = await getPartner(meeting.partner_id);

          detectedPartner = { partnerId: meeting.partner_id, partnerName: partner?.name ?? "unknown" };
          console.log(`Partner detection (ICS backfill): ${detectedPartner.partnerName} (${storedIds.length} messages)`);
        }
      }
    } catch (err) {
      console.error("Failed to sync partner between meeting and messages:", err);
    }
  }

  return {
    status: "ok",
    stored: stored.length,
    meetingCreated,
    detectedPartner: detectedPartner?.partnerName ?? null,
  };
}
