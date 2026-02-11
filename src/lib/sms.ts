import twilio from "twilio";
import {
  ClassificationResult,
  Message,
  Engagement,
  SMSOption,
} from "./types";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    }
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

/**
 * Send a raw SMS message via Twilio.
 */
export async function sendSMS(to: string, body: string): Promise<string> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("Missing TWILIO_PHONE_NUMBER");

  const message = await getClient().messages.create({ to, from, body });
  return message.sid;
}

/**
 * Build SMS options from a classification result.
 * Returns the numbered options list used in the SMS and stored in approval_queue.
 */
export function buildSMSOptions(
  result: ClassificationResult,
  existingEngagements: Engagement[]
): SMSOption[] {
  const options: SMSOption[] = [];
  let num = 1;

  // If Claude suggested a new engagement with decent confidence, offer it first
  if (
    result.engagement_match.is_new &&
    result.engagement_match.confidence >= 0.5
  ) {
    options.push({
      number: num++,
      label: result.engagement_match.name,
      engagement_id: null,
      is_new: true,
    });
  }

  // Add existing engagement matches with confidence >= 0.5
  // If the primary match is existing and decent confidence, include it
  if (
    !result.engagement_match.is_new &&
    result.engagement_match.id &&
    result.engagement_match.confidence >= 0.5
  ) {
    options.push({
      number: num++,
      label: result.engagement_match.name,
      engagement_id: result.engagement_match.id,
      is_new: false,
    });
  }

  // Pad with other active engagements if we have room (max 3 total options before "New")
  // Only add if the primary match didn't fill all slots
  if (options.length < 3) {
    const usedIds = new Set(
      options.filter((o) => o.engagement_id).map((o) => o.engagement_id)
    );
    for (const init of existingEngagements) {
      if (usedIds.has(init.id)) continue;
      if (options.length >= 3) break;
      // Only add recent/relevant engagements — skip for now to keep SMS short
      // The AI match is the best we have; padding with unrelated engagements confuses more than helps
    }
  }

  // Always add "New engagement" as last numbered option
  if (!options.some((o) => o.is_new)) {
    options.push({
      number: num++,
      label: "New engagement",
      engagement_id: null,
      is_new: true,
    });
  }

  return options;
}

/**
 * Build the SMS text for a classification prompt.
 * Target: under 320 chars (2 SMS segments).
 */
export function buildClassificationSMS(
  message: Message,
  options: SMSOption[]
): string {
  const sender = message.sender_name || message.sender_email || "Unknown";
  // Truncate subject to keep SMS short
  const subject = message.subject
    ? message.subject.length > 40
      ? message.subject.slice(0, 37) + "..."
      : message.subject
    : "(no subject)";

  const lines: string[] = [];
  lines.push(`New from ${sender}`);
  lines.push(`"${subject}"`);

  for (const opt of options) {
    const conf =
      opt.engagement_id || opt.is_new
        ? ""
        : "";
    // Show confidence only for AI-matched options (not the generic "New engagement" fallback)
    lines.push(`${opt.number}. ${opt.label}${conf}`);
  }

  lines.push(`Reply #, name, or skip`);

  return lines.join("\n");
}

/**
 * Send the classification prompt SMS for a pending review.
 * Returns the Twilio message SID.
 */
export async function sendClassificationPrompt(
  message: Message,
  result: ClassificationResult,
  existingEngagements: Engagement[]
): Promise<{ sid: string; options: SMSOption[] }> {
  const userPhone = process.env.USER_PHONE_NUMBER;
  if (!userPhone) throw new Error("Missing USER_PHONE_NUMBER");

  const options = buildSMSOptions(result, existingEngagements);
  const body = buildClassificationSMS(message, options);

  const sid = await sendSMS(userPhone, body);
  return { sid, options };
}
