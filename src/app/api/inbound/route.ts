import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parseForwardedEmail } from "@/lib/email-parser";
import { storeMessages } from "@/lib/supabase";
import { processSingleMessage } from "@/lib/classifier";

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

  return hmac === signature;
}

/**
 * POST /api/inbound
 * Receives Mailgun inbound email webhooks (multipart form data).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract Mailgun signature fields
    const timestamp = formData.get("timestamp") as string | null;
    const token = formData.get("token") as string | null;
    const signature = formData.get("signature") as string | null;

    if (!timestamp || !token || !signature) {
      console.warn("Inbound webhook missing signature fields");
      return NextResponse.json(
        { error: "Missing signature fields" },
        { status: 406 }
      );
    }

    if (!verifyMailgunSignature(timestamp, token, signature)) {
      console.warn("Inbound webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 406 }
      );
    }

    // Extract email fields from Mailgun's multipart payload
    const sender = (formData.get("sender") as string) ?? "";
    const subject = (formData.get("subject") as string) ?? "";
    const bodyPlain = (formData.get("body-plain") as string) ?? "";
    const strippedText = (formData.get("stripped-text") as string) ?? "";

    // Prefer stripped-text (Mailgun's cleaned version), fall back to body-plain
    const emailBody = strippedText || bodyPlain;

    if (!emailBody.trim()) {
      console.warn("Inbound webhook received empty email body");
      return NextResponse.json({ message: "Empty email body, skipped" });
    }

    // Parse forwarded email into individual messages
    const parsed = parseForwardedEmail(emailBody, {
      sender,
      subject,
      timestamp: parseInt(timestamp, 10),
    });

    if (parsed.length === 0) {
      console.warn("Email parser produced no messages");
      return NextResponse.json({ message: "No messages extracted" });
    }

    // Store in Supabase (unclassified — initiative_id = null)
    const stored = await storeMessages(parsed);
    const storedIds = stored.map((m) => m.id);

    console.log(
      `Inbound: stored ${stored.length} message(s) from "${subject}"`
    );

    // Trigger classification synchronously — Claude responds in 2-3s,
    // well within Vercel's serverless timeout. We want the classification
    // result available immediately for potential SMS notifications (Chunk 4).
    let classified = false;
    try {
      const result = await processSingleMessage(storedIds);
      classified = result !== null;
    } catch (classifyError) {
      // Classification failure shouldn't fail the webhook — messages are stored
      // and can be batch-classified later via POST /api/classify
      console.error("Post-ingest classification failed:", classifyError);
    }

    return NextResponse.json({
      message: "ok",
      stored: stored.length,
      classified,
    });
  } catch (error) {
    // Always return 200-range to Mailgun to prevent retry floods,
    // UNLESS it's a signature issue (already handled above as 406).
    console.error("Inbound webhook error:", error);
    return NextResponse.json({
      message: "Error processing email, but acknowledged",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
