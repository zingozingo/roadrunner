import { NextRequest, NextResponse } from "next/server";
import {
  getLatestUnresolvedInitiativeApproval,
  resolveApproval,
  createInitiative,
  updateMessageInitiative,
  updateInitiativeSummary,
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

  // Find the most recent unresolved initiative assignment approval
  const review = await getLatestUnresolvedInitiativeApproval();

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
          // Create new initiative with the suggested name
          const initiative = await createInitiative({
            name: option.label === "New initiative" ? `Untitled - ${new Date().toLocaleDateString()}` : option.label,
            partner_name: review.classification_result!.initiative_match.partner_name,
            summary: review.classification_result!.summary_update,
          });
          await updateMessageInitiative(review.message_id!, initiative.id);
          await resolveApproval(review.id, `created:${initiative.id}:${initiative.name}`);
          await sendSMS(userPhone, `Created: ${initiative.name}`);
        } else if (option.initiative_id) {
          // Assign to existing initiative
          await updateMessageInitiative(review.message_id!, option.initiative_id);
          if (review.classification_result!.summary_update) {
            await updateInitiativeSummary(
              option.initiative_id,
              review.classification_result!.summary_update
            );
          }
          await resolveApproval(review.id, `assigned:${option.initiative_id}:${option.label}`);
          await sendSMS(userPhone, `Assigned to: ${option.label}`);
        }
        return twimlResponse("");
      }
    }

    // Handle free-text reply — create a new initiative with that name
    if (reply.length > 0) {
      // Strip "new:" prefix if present
      const name = reply.startsWith("new:")
        ? body.trim().slice(4).trim()
        : body.trim();

      if (name.length === 0) {
        await sendSMS(userPhone, "Name can't be empty. Reply #, name, or skip.");
        return twimlResponse("");
      }

      const initiative = await createInitiative({
        name,
        partner_name: review.classification_result!.initiative_match.partner_name,
        summary: review.classification_result!.summary_update,
      });
      await updateMessageInitiative(review.message_id!, initiative.id);
      await resolveApproval(review.id, `created:${initiative.id}:${initiative.name}`);
      await sendSMS(userPhone, `Created: ${initiative.name}`);
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
