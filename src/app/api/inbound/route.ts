import { NextRequest, NextResponse } from "next/server";
import { stripExternalTag } from "@/lib/email-parser";
import { processInboundEmail, InboundEmailFields } from "@/lib/inbound-pipeline";
import { verifyMailgunSignature, extractFormFields } from "@/lib/mailgun-helpers";

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
