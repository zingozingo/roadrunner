import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { stripExternalTag } from "@/lib/email-parser";
import { processInboundEmail, InboundEmailFields } from "@/lib/inbound-pipeline";

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
 * POST /api/inbound
 * Receives Mailgun inbound email webhooks (multipart form data).
 * Route handles: HTTP parsing, signature verification, replay protection.
 * Business logic delegated to processInboundEmail().
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

    // Build pipeline input from extracted Mailgun fields
    const pipelineFields: InboundEmailFields = {
      sender: fields.get("sender") ?? fields.get("from") ?? "",
      subject: stripExternalTag(fields.get("subject") ?? ""),
      bodyPlain: fields.get("body-plain") ?? "",
      strippedText: fields.get("stripped-text") ?? "",
      bodyCalendar: fields.get("body-calendar") ?? "",
      toHeader: fields.get("To") ?? "",
      ccHeader: fields.get("Cc") ?? "",
      rawFormData,
      timestamp: timestamp ? parseInt(timestamp, 10) : Math.floor(Date.now() / 1000),
    };

    // Run email processing pipeline
    const result = await processInboundEmail(pipelineFields);

    // Map pipeline status to response
    const statusMessages: Record<string, string> = {
      ok: "ok",
      empty_body: "Empty email body, skipped",
      no_messages: "No messages extracted",
    };

    return NextResponse.json({
      message: statusMessages[result.status],
      stored: result.stored,
      meetingCreated: result.meetingCreated,
      detectedPartner: result.detectedPartner,
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
