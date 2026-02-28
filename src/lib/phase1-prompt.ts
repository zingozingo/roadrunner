import type { Message, Meeting, Partner, Engagement, Phase1Result } from "./types";
import { getActiveEngagements, getPartners, getSupabaseClient } from "./supabase";
import { buildEmailSection } from "./prompt-builder";
import { USER_CONFIG } from "./user-config";

// ============================================================
// Phase 1 system prompt — lightweight routing only
// ============================================================

export const PHASE1_SYSTEM_PROMPT = `You are Relay Match, a routing classifier for an AWS Partner Development Manager's email inbox.

Your ONLY job: determine which existing engagement this forwarded email belongs to, or whether it's noise or a new initiative.

## Definitions

**Engagement** — A tracked work initiative. One partner + one goal. Example: "Acme Security - FedRAMP Certification". A single partner can have MULTIPLE concurrent engagements with different topics — for example, one partner might have an integration project, a marketing campaign, and a competency pursuit all active simultaneously.

**Noise** — Auto-replies, out-of-office, newsletters, marketing blasts, internal distribution list digests, calendar notifications with no actionable content.

## Instructions

1. Read the email content carefully.
2. Compare against the engagement index provided. Match by partner name, topic alignment, and email domain.
3. Use the partner catalog to identify which partner the sender belongs to (match by email domain).
4. Return your classification.

## Matching Rules

- **Match by partner AND topic.** Both must align. A partner name match alone is NOT sufficient — the email's subject and content must also align with the engagement's topic. If a partner has multiple engagements, compare the email against EACH engagement's topic to find the right one, or determine it's a new initiative.
- **Domain matching.** Use the partner catalog's domain list to identify which partner the sender works for. If a sender's domain matches a partner, that identifies the partner — but you must still match by topic to select the correct engagement for that partner.
- **Subject line matching.** If the email's subject line closely matches or continues a thread from an existing engagement (similar subject, same participants), that's a strong match signal. The engagement index includes the topic and last email subject for each engagement — use both for matching.
- **New engagement for existing partner.** If the email discusses a clearly different initiative, campaign, program, or workstream than any existing engagement for the same partner, this IS a new engagement. Set is_new: true. The partner already having engagements does not prevent creating new ones — what matters is whether THIS email's topic matches an EXISTING engagement's topic.
- **New engagement for new partner.** If the sender's domain doesn't match any partner, or the content introduces an entirely new initiative, set is_new: true. The email must have substantive content — a vague intro or forward without context is not enough for a new engagement.
- **Noise detection.** Auto-replies, OOO, newsletters, marketing blasts, calendar notifications = noise. Return content_type "noise" with confidence 1.0.
- **Meeting invites.** ICS attachments and calendar invitations are content_type "meeting_invite". Still match them to an engagement by topic/partner. A "Meeting Data" section may provide structured attendees and a pre-resolved partner hint from calendar data — use these for higher-confidence matching.
- **Mixed content.** Emails discussing multiple engagements: content_type "mixed", match to the primary one.
- **Ambiguous partner match.** If the email could belong to multiple engagements for the same partner and you cannot determine which one, set confidence below 0.70 to flag for human review.

## Confidence Calibration

- 0.95–1.0: Direct thread continuation (same subject line, same participants as an existing engagement's last email) OR email explicitly names the engagement
- 0.85–0.94: Same partner + same topic area + clear contextual alignment between email content and engagement topic
- 0.70–0.84: Same partner but topic alignment is partial or unclear
- Below 0.70: Could match multiple engagements for the same partner, or partner matches but topic is clearly different from all existing engagements (flag for review)
- Noise: always 1.0

IMPORTANT: Same partner + different topic = NEW engagement (is_new: true), NOT a low-confidence match to an existing engagement. Do not route an email about "Solution Spotlight Campaign" to an engagement about "OpenTofu Integration" just because they share the same partner.

## Response Format

Return ONLY valid JSON. No markdown, no preamble.

{
  "content_type": "engagement_email" | "meeting_invite" | "mixed" | "noise",
  "engagement_match": {
    "id": "uuid of existing engagement, or null if new/noise",
    "name": "existing engagement name, or suggested name if new",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "company name or null",
    "partner_id": "uuid from partner catalog or null"
  }
}

If noise: content_type "noise", engagement_match with null id, confidence 1.0, is_new false.
If new: engagement_match with null id, is_new true, suggested name in "Partner - Initiative" format.`;

// ============================================================
// Compact context builder for Phase 1
// ============================================================

/**
 * Build the full Phase 1 user message: compact forwarder, engagement index,
 * partner catalog, and the email(s) to classify.
 */
export async function buildPhase1Context(
  messages: Message[],
  forwarderNote?: string | null
): Promise<string> {
  const [engagements, partners] = await Promise.all([
    getActiveEngagements(),
    getPartners(),
  ]);

  // Fetch the latest message subject per engagement in one query
  const lastSubjects = await getLastSubjects(engagements);

  const parts: string[] = [];

  parts.push(buildCompactForwarder(forwarderNote));
  parts.push(buildEngagementIndex(engagements, lastSubjects));
  parts.push(buildCompactPartnerCatalog(partners));
  parts.push(buildEmailSection(messages));

  // If any message has a linked meeting, append structured meeting data
  const meetings = await getMeetingsForMessages(messages);
  if (meetings.length > 0) {
    parts.push(buildMeetingHint(meetings));
  }

  return parts.join("\n");
}

// ============================================================
// Parse Phase 1 response
// ============================================================

export function parsePhase1Response(raw: string): Phase1Result {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Ensure required fields have defaults
  if (!parsed.engagement_match) {
    parsed.engagement_match = {
      id: null,
      name: "",
      confidence: 0,
      is_new: false,
      partner_name: null,
      partner_id: null,
    };
  }
  if (parsed.engagement_match.partner_id === undefined) {
    parsed.engagement_match.partner_id = null;
  }

  return parsed as Phase1Result;
}

// ============================================================
// Internal builders
// ============================================================

function buildCompactForwarder(forwarderNote?: string | null): string {
  const lines = [
    "## Forwarder",
    `${USER_CONFIG.name} | ${USER_CONFIG.email} | ${USER_CONFIG.role}`,
  ];
  if (forwarderNote) {
    lines.push(`Note: ${forwarderNote}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function buildEngagementIndex(
  engagements: Engagement[],
  lastSubjects: Map<string, string>
): string {
  const lines: string[] = ["## Engagement Index"];

  if (engagements.length === 0) {
    lines.push("None yet.");
    lines.push("");
    return lines.join("\n");
  }

  for (const eng of engagements) {
    const parts: string[] = [];
    if (eng.partner_name) parts.push(`Partner: ${eng.partner_name}`);

    const subject = lastSubjects.get(eng.id) ?? "(none)";
    const meta = parts.length > 0 ? ` — ${parts.join(" | ")}` : "";
    const topicStr = eng.topic ? ` | Topic: "${eng.topic}"` : "";

    lines.push(
      `- "${eng.name}" (id: ${eng.id})${meta}${topicStr} | Last Subject: "${subject}"`
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function buildCompactPartnerCatalog(partners: Partner[]): string {
  const lines: string[] = ["## Partner Catalog"];

  const partnersWithDomains = partners.filter((p) => {
    if (!p.partner_contact_emails || p.partner_contact_emails.length === 0) return false;
    return p.partner_contact_emails.some((e) => e.includes("@"));
  });

  if (partnersWithDomains.length === 0) {
    lines.push("None yet.");
    lines.push("");
    return lines.join("\n");
  }

  for (const p of partnersWithDomains) {
    const domains = [
      ...new Set(
        (p.partner_contact_emails ?? [])
          .map((e) => e.split("@")[1]?.toLowerCase())
          .filter(Boolean)
      ),
    ];
    if (domains.length > 0) {
      lines.push(`- "${p.name}" (id: ${p.id}) — Domains: ${domains.join(", ")}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Fetch the most recent email subject for each engagement.
 * Single query: get the latest message per engagement_id via ordering + dedup.
 */
async function getLastSubjects(engagements: Engagement[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (engagements.length === 0) return result;

  const db = getSupabaseClient();
  const engagementIds = engagements.map((e) => e.id);

  // Fetch latest message per engagement — ordered by sent_at DESC, pick first per group
  const { data, error } = await db
    .from("messages")
    .select("engagement_id, subject, sent_at")
    .in("engagement_id", engagementIds)
    .order("sent_at", { ascending: false });

  if (error || !data) return result;

  // Take the first (most recent) subject per engagement_id
  for (const row of data) {
    if (row.engagement_id && row.subject && !result.has(row.engagement_id)) {
      result.set(row.engagement_id, row.subject);
    }
  }

  return result;
}

/**
 * Query meetings linked to the given messages (by message_id).
 * Used to provide structured attendee data for meeting invites.
 */
async function getMeetingsForMessages(messages: Message[]): Promise<Meeting[]> {
  const messageIds = messages.map((m) => m.id);
  if (messageIds.length === 0) return [];

  const db = getSupabaseClient();
  const { data, error } = await db
    .from("meetings")
    .select("*")
    .in("message_id", messageIds);

  if (error || !data) return [];
  return data as Meeting[];
}

/**
 * Build a compact meeting data section for Phase 1 context.
 * Includes attendee list and partner hint from ICS attendee domain matching.
 */
export function buildMeetingHint(meetings: Meeting[]): string {
  if (meetings.length === 0) return "";

  const lines: string[] = ["## Meeting Data (from calendar invite)\n"];

  for (const m of meetings) {
    if (m.partner_name) {
      const idPart = m.partner_id ? ` (id: ${m.partner_id})` : "";
      lines.push(`**Partner Hint:** ${m.partner_name}${idPart}`);
    }
    if (m.organizer_email) {
      lines.push(`**Organizer:** ${m.organizer_email}`);
    }
    if (m.attendees && m.attendees.length > 0) {
      lines.push("**Attendees:**");
      for (const a of m.attendees) {
        const name = a.name ? `${a.name} ` : "";
        lines.push(`- ${name}<${a.email}>`);
      }
    }
    if (m.is_recurring) {
      lines.push("**Recurring:** Yes");
    }
  }

  lines.push("");
  return lines.join("\n");
}

// Exported for testing
export { buildCompactForwarder, getLastSubjects, getMeetingsForMessages };
