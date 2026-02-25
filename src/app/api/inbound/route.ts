import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parseForwardedEmail, parseSenderField, stripExternalTag } from "@/lib/email-parser";
import { storeMessages, createMeetingFromICS } from "@/lib/supabase";
import { extractICSFromAttachments, parseICSContent } from "@/lib/ics-parser";
import { processSingleMessage } from "@/lib/classifier";
import { stripPRVS, isUserEmail, USER_CONFIG } from "@/lib/user-config";
import { buildNameResolutionMap, resolveNameByEmail, resolveOrgByDomain } from "@/lib/name-resolver";

/**
 * Verify Mailgun webhook signature.
 * Mailgun signs with HMAC-SHA256: hex(HMAC(signing_key, timestamp + token)) === signature
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.error("MAILGUN_WEBHOOK_SIGNING_KEY is not configured");
    return false;
  }

  const hmac = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");

  if (hmac !== signature) {
    console.warn("Signature mismatch debug:", {
      timestamp,
      token: token.substring(0, 8) + "...",
      expected: hmac,
      received: signature,
      keyPrefix: signingKey.substring(0, 4) + "...",
    });
  }

  return hmac === signature;
}

/**
 * Try to extract form fields from the request.
 * Attempts formData() first, then falls back to text-based URL-encoded parsing.
 * Returns null if both fail.
 *
 * When formData() succeeds, the raw FormData is preserved so callers can
 * access File objects (e.g., ICS attachments) that aren't in the string map.
 */
async function extractFormFields(
  request: NextRequest
): Promise<{ fields: Map<string, string>; method: string; rawFormData: FormData | null } | null> {
  // Attempt 1: request.formData() — works for multipart/form-data and
  // application/x-www-form-urlencoded in Node.js runtime
  try {
    const cloned = request.clone();
    const formData = await cloned.formData();
    const fields = new Map<string, string>();
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        fields.set(key, value);
      }
    });
    if (fields.size > 0) {
      return { fields, method: "formData", rawFormData: formData };
    }
    // formData() succeeded but returned no string fields — fall through
    console.warn("formData() returned 0 string fields, trying text fallback");
  } catch (e) {
    console.warn("formData() threw:", e instanceof Error ? e.message : e);
  }

  // Attempt 2: Read raw body and parse as URL-encoded
  try {
    const text = await request.text();
    if (text.length > 0) {
      const params = new URLSearchParams(text);
      const fields = new Map<string, string>();
      params.forEach((value, key) => {
        fields.set(key, value);
      });
      if (fields.size > 0) {
        return { fields, method: "urlencoded-fallback", rawFormData: null };
      }
    }
    console.warn("Text body fallback also produced 0 fields, length:", text.length);
  } catch (e) {
    console.warn("Text body fallback threw:", e instanceof Error ? e.message : e);
  }

  return null;
}

/**
 * Smart body selection for forwarded emails.
 *
 * Mailgun's stripped-text removes "quoted" content — which includes forwarded
 * email threads. For forwarded emails, body-plain preserves the full content
 * the email parser needs (From:/Sent:/To:/Subject: header blocks).
 *
 * Strategy:
 * 1. If body-plain has Outlook forward markers that stripped-text lost → use body-plain
 * 2. If body-plain is significantly longer (3x+) → stripped-text probably lost content
 * 3. Default to stripped-text (cleaner for non-forwarded, direct emails)
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

/**
 * POST /api/inbound
 * Receives Mailgun inbound email webhooks (multipart form data).
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Inbound webhook hit:", {
      contentType: request.headers.get("content-type"),
      url: request.url,
    });

    // Parse form fields with fallback
    const extracted = await extractFormFields(request);

    if (!extracted) {
      console.error("Could not extract any form fields from request");
      return NextResponse.json({
        error: "Could not parse request body",
        contentType: request.headers.get("content-type"),
      }, { status: 400 });
    }

    const { fields, method: parseMethod, rawFormData } = extracted;
    console.log(`Parsed ${fields.size} fields via ${parseMethod}`);

    // Extract Mailgun signature fields
    const timestamp = fields.get("timestamp") ?? null;
    const token = fields.get("token") ?? null;
    const signature = fields.get("signature") ?? null;

    // Signature verification — hard gate
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    let signatureValid: boolean | null = null;

    if (!signingKey) {
      // No key configured
      if (process.env.NODE_ENV === "production") {
        console.error("MAILGUN_WEBHOOK_SIGNING_KEY not configured in production — rejecting");
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
      }
      console.warn("MAILGUN_WEBHOOK_SIGNING_KEY not configured — allowing in development");
    } else if (!timestamp || !token || !signature) {
      // Key configured but Mailgun signature fields missing — reject
      console.error("Signature fields missing — rejecting", {
        hasTimestamp: !!timestamp,
        hasToken: !!token,
        hasSignature: !!signature,
        availableFields: Array.from(fields.keys()),
      });
      return NextResponse.json({ error: "Missing signature fields" }, { status: 403 });
    } else {
      // Replay protection: reject timestamps older than 5 minutes
      const tsSeconds = parseInt(timestamp, 10);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ageSeconds = nowSeconds - tsSeconds;
      if (Number.isNaN(tsSeconds) || Math.abs(ageSeconds) > 300) {
        console.error("Replay protection: timestamp too old or invalid", {
          timestamp,
          ageSeconds,
          nowSeconds,
        });
        return NextResponse.json({ error: "Stale or invalid timestamp" }, { status: 403 });
      }

      // HMAC verification
      signatureValid = verifyMailgunSignature(timestamp, token, signature);
      if (!signatureValid) {
        console.error("Signature verification failed — rejecting");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
      console.log("Signature check: PASS");
    }

    // Extract email fields from Mailgun's payload
    const sender = fields.get("sender") ?? fields.get("from") ?? "";
    const subject = stripExternalTag(fields.get("subject") ?? "");
    const bodyPlain = fields.get("body-plain") ?? "";
    const strippedText = fields.get("stripped-text") ?? "";
    const bodyCalendar = fields.get("body-calendar") ?? "";
    const toHeader = fields.get("To") ?? "";
    const ccHeader = fields.get("Cc") ?? "";

    // Smart body selection — prefers body-plain when forwarded content is detected
    const emailBody = selectEmailBody(strippedText, bodyPlain);

    // Parse forwarder identity from Mailgun envelope sender.
    // When Steven forwards to Relay, Mailgun's "sender" = Steven's address.
    const { senderName: parsedForwarderName, senderEmail: rawForwarderEmail } =
      parseSenderField(sender);

    // Strip Proofpoint PRVS wrapping (prvs=XXXXXX=real@email.com → real@email.com)
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
      console.warn("Inbound webhook received empty email body", {
        availableFields: Array.from(fields.keys()),
      });
      return NextResponse.json({ message: "Empty email body, skipped" });
    }

    // Parse forwarded email into individual messages
    const forwardTimestamp = timestamp ? parseInt(timestamp, 10) : Math.floor(Date.now() / 1000);
    const parsed = parseForwardedEmail(emailBody, {
      sender,
      subject,
      timestamp: forwardTimestamp,
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
      return NextResponse.json({ message: "No messages extracted" });
    }

    // --- Name resolution: enrich sender names from DB before storage ---
    // Built once, reused for all messages and passed to classification.
    const nameMap = await buildNameResolutionMap();
    let namesEnriched = 0;
    for (const msg of parsed) {
      if (msg.sender_email) {
        // Only enrich if sender_name is null (parser couldn't extract or nulled garbage)
        if (!msg.sender_name) {
          const resolved = resolveNameByEmail(msg.sender_email, nameMap);
          if (resolved) {
            msg.sender_name = resolved.name;
            namesEnriched++;
          }
        }
      }
    }
    if (namesEnriched > 0) {
      console.log(`Name resolution: enriched ${namesEnriched} sender name(s) from DB`);
    }

    console.log(`Parsed ${parsed.length} messages, proceeding to storage (per-message dedup handles duplicates)`);

    // Store in Supabase (unclassified — engagement_id = null)
    const stored = await storeMessages(parsed);
    const storedIds = stored.map((m) => m.id);

    console.log(`Supabase storage: stored ${stored.length} message(s), ids=[${storedIds.join(", ")}]`);

    // --- ICS Meeting Creation (Phase 1) ---
    // Extract ICS from: body-calendar field → inline body-plain → file attachment.
    // Non-blocking: failures here never prevent email processing.
    let meetingCreated = false;
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
          const meetingId = await createMeetingFromICS(parsedMeeting, storedIds[0]);
          meetingCreated = meetingId !== null;
          console.log(`[ICS] ${meetingCreated ? `Created meeting ${meetingId}` : "Deduped (already exists)"}`);
        } else {
          console.warn(`[ICS] Found calendar data (${icsSource}) but could not parse it`);
        }
      }
    } catch (icsError) {
      console.error("ICS extraction/parsing failed (non-blocking):", icsError);
    }

    // Trigger classification — Claude responds in 2-3s, well within
    // Vercel's serverless timeout.
    // Pass the forwarder note from the first parsed message (if the email-parser detected one)
    const forwarderNote = parsed[0]?.forwarder_note ?? null;
    let classified = false;
    try {
      const result = await processSingleMessage(storedIds, forwarderNote, nameMap);
      classified = result !== null;
      console.log(`Classification: ${classified ? "success" : "no result"}`);
    } catch (classifyError) {
      // Classification failure shouldn't fail the webhook — messages are stored
      // and can be batch-classified later via POST /api/classify
      console.error("Post-ingest classification failed:", classifyError);
    }

    return NextResponse.json({
      message: "ok",
      stored: stored.length,
      classified,
      meetingCreated,
      signatureValid,
      parseMethod,
    });
  } catch (error) {
    // Always return 200-range to Mailgun to prevent retry floods.
    console.error("Inbound webhook error:", error);
    return NextResponse.json({
      message: "Error processing email, but acknowledged",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
