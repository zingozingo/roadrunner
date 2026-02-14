import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parseForwardedEmail, parseSenderField } from "@/lib/email-parser";
import { storeMessages, checkDuplicateMessage } from "@/lib/supabase";
import { processSingleMessage } from "@/lib/classifier";
import { ForwarderContext } from "@/lib/claude";

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
 */
async function extractFormFields(
  request: NextRequest
): Promise<{ fields: Map<string, string>; method: string } | null> {
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
      return { fields, method: "formData" };
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
        return { fields, method: "urlencoded-fallback" };
      }
    }
    console.warn("Text body fallback also produced 0 fields, length:", text.length);
  } catch (e) {
    console.warn("Text body fallback threw:", e instanceof Error ? e.message : e);
  }

  return null;
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

    const { fields, method: parseMethod } = extracted;
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
    const subject = fields.get("subject") ?? "";
    const bodyPlain = fields.get("body-plain") ?? "";
    const strippedText = fields.get("stripped-text") ?? "";
    const toHeader = fields.get("To") ?? "";
    const ccHeader = fields.get("Cc") ?? "";

    // Prefer stripped-text (Mailgun's cleaned version), fall back to body-plain
    const emailBody = strippedText || bodyPlain;

    // Parse forwarder identity from Mailgun envelope sender.
    // When Steven forwards to Relay, Mailgun's "sender" = Steven's address.
    const { senderName: forwarderName, senderEmail: forwarderEmail } =
      parseSenderField(sender);

    // Build forwarder context for classification
    const forwarderContext: ForwarderContext | undefined =
      forwarderName && forwarderEmail
        ? { name: forwarderName, email: forwarderEmail }
        : forwarderEmail
          ? { name: forwarderEmail, email: forwarderEmail }
          : undefined;

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
    }

    console.log(`Email parsing: extracted ${parsed.length} message(s) from "${subject}"`);

    if (parsed.length === 0) {
      console.warn("Email parser produced no messages");
      return NextResponse.json({ message: "No messages extracted" });
    }

    // Dedup check: skip if first message already exists
    const first = parsed[0];
    if (first.sender_email && first.subject) {
      const bodyPrefix = (first.body_text || "").slice(0, 100);
      const isDuplicate = await checkDuplicateMessage(
        first.sender_email,
        first.subject,
        bodyPrefix
      );
      if (isDuplicate) {
        console.log(`Duplicate detected: "${first.subject}" from ${first.sender_email}`);
        return NextResponse.json({
          message: "Duplicate message, skipped",
          duplicate: true,
        });
      }
    }

    // Store in Supabase (unclassified — engagement_id = null)
    const stored = await storeMessages(parsed);
    const storedIds = stored.map((m) => m.id);

    console.log(`Supabase storage: stored ${stored.length} message(s), ids=[${storedIds.join(", ")}]`);

    // Trigger classification — Claude responds in 2-3s, well within
    // Vercel's serverless timeout.
    let classified = false;
    try {
      const result = await processSingleMessage(storedIds, forwarderContext);
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
