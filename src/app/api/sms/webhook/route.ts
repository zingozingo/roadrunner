import { NextRequest, NextResponse } from "next/server";
import {
  getLatestUnresolvedEngagementApproval,
  resolveApproval,
  createEngagement,
  updateMessageEngagement,
  updateEngagementSummary,
} from "@/lib/supabase";
import { sendSMS } from "@/lib/sms";

/**
 * POST /api/sms/webhook
 * Receives inbound SMS replies from Twilio.
 * Twilio sends application/x-www-form-urlencoded with fields:
 *   From, To, Body, MessageSid, etc.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = (formData.get("From") as string) ?? "";
  const body = (formData.get("Body") as string) ?? "";

  // Validate sender — only accept replies from the configured user phone
  const userPhone = process.env.USER_PHONE_NUMBER;
  if (!userPhone || normalizePhone(from) !== normalizePhone(userPhone)) {
    console.warn(`SMS from unauthorized number: ${from}`);
    return twimlResponse("Unauthorized.");
  }

  const reply = body.trim().toLowerCase();

  // Find the most recent unresolved engagement assignment approval
  const review = await getLatestUnresolvedEngagementApproval();

  if (!review) {
    await sendSMS(userPhone, "No pending reviews right now.");
    return twimlResponse("");
  }

  try {
    // Handle "skip"
    if (reply === "skip") {
      await resolveApproval(review.id, "skipped");
      await sendSMS(userPhone, "Skipped. Message stays in inbox.");
      return twimlResponse("");
    }

    // Handle numeric reply — map to options_sent
    const num = parseInt(reply, 10);
    if (!isNaN(num) && review.options_sent && review.options_sent.length > 0) {
      const option = review.options_sent.find((o) => o.number === num);
      if (option) {
        if (option.is_new) {
          // Create new engagement with the suggested name
          const engagement = await createEngagement({
            name: option.label === "New engagement" ? `Untitled - ${new Date().toLocaleDateString()}` : option.label,
            partner_name: review.classification_result!.engagement_match.partner_name,
            summary: review.classification_result!.current_state,
          });
          await updateMessageEngagement(review.message_id!, engagement.id);
          await resolveApproval(review.id, `created:${engagement.id}:${engagement.name}`);
          await sendSMS(userPhone, `Created: ${engagement.name}`);
        } else if (option.engagement_id) {
          // Assign to existing engagement
          await updateMessageEngagement(review.message_id!, option.engagement_id);
          if (review.classification_result!.current_state) {
            await updateEngagementSummary(
              option.engagement_id,
              review.classification_result!.current_state
            );
          }
          await resolveApproval(review.id, `assigned:${option.engagement_id}:${option.label}`);
          await sendSMS(userPhone, `Assigned to: ${option.label}`);
        }
        return twimlResponse("");
      }
    }

    // Handle free-text reply — create a new engagement with that name
    if (reply.length > 0) {
      // Strip "new:" prefix if present
      const name = reply.startsWith("new:")
        ? body.trim().slice(4).trim()
        : body.trim();

      if (name.length === 0) {
        await sendSMS(userPhone, "Name can't be empty. Reply #, name, or skip.");
        return twimlResponse("");
      }

      const engagement = await createEngagement({
        name,
        partner_name: review.classification_result!.engagement_match.partner_name,
        summary: review.classification_result!.current_state,
      });
      await updateMessageEngagement(review.message_id!, engagement.id);
      await resolveApproval(review.id, `created:${engagement.id}:${engagement.name}`);
      await sendSMS(userPhone, `Created: ${engagement.name}`);
      return twimlResponse("");
    }

    await sendSMS(userPhone, "Didn't understand. Reply #, name, or skip.");
    return twimlResponse("");
  } catch (error) {
    console.error("SMS webhook error:", error);
    await sendSMS(userPhone, "Something went wrong. Try again or check the dashboard.");
    return twimlResponse("");
  }
}

/**
 * Return a minimal TwiML response.
 * Twilio expects XML back, but an empty <Response/> works for "don't auto-reply".
 * We send replies manually via the API for more control.
 */
function twimlResponse(message: string): NextResponse {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^1/, "");
}
