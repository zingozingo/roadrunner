import type { Message, Meeting, Partner, Engagement, Phase1Result } from "./types";
import { getActiveEngagements, getPartners, getSupabaseClient } from "./db";
import { buildEmailSection } from "./prompt-builder";
import { USER_CONFIG } from "./user-config";

// ============================================================
// Phase 1 system prompt — lightweight routing only
// ============================================================

export const PHASE1_SYSTEM_PROMPT = `You are Relay, a routing classifier for an AWS Partner Development Manager's (PDM's) email system.

## Core Assumption

Every email you receive has been intentionally forwarded by the PDM because it is relevant to their partner work. Your job is to determine WHICH engagement it belongs to — not whether it's relevant.

## Your Task

Route this email to the correct engagement. There are exactly three outcomes:

1. **Existing engagement** — The email matches an active engagement. Return its ID.
2. **New engagement** — The email involves a known partner but a genuinely new initiative not covered by any existing engagement. Return is_new: true with a suggested name.
3. **Unclear** — You cannot confidently determine the routing. Return confidence below 0.70 so a human can review it.

## Decision Framework

Follow these steps in order. Stop when you have a confident answer.

**Step 1: Check the forwarder note.**
If the PDM included a note, treat it as high-authority context for routing.

**Step 2: Match the sender and participants.**
Compare the email's From, To, and CC addresses against the participant lists in the engagement index. A sender who is a known participant in exactly ONE engagement is a strong routing signal.

**Step 3: Match by partner.**
Use the Partner Catalog to identify which partner the sender belongs to (match by email domain). If the partner has only one active engagement, and the email content is consistent with it, route there.

**Step 4: Disambiguate within a partner.**
If the partner has multiple engagements, use these signals (strongest first):
  a. **Participant overlap** — Is the sender or any CC'd address unique to one engagement?
  b. **Topic alignment** — Does the email's subject and content align with a specific engagement's topic?
  c. **Pillar alignment** — Is the email about selling (Co-Sell), building/integrating (Co-Build), or marketing/events (Co-Market)?
  d. **Linked entities** — Does the email reference a program or event name that's linked to a specific engagement?
  e. **Subject continuity** — Does the subject line continue a thread matching an engagement's last subject?

**Step 5: Handle internal and third-party senders.**
Emails from @amazon.com or third-party domains (not matching any partner) will reference the partner and engagement context by name in their content. Use topic, participant overlap, and subject matching to route these.

**Step 6: Identify new engagements.**
If the email clearly involves a known partner but discusses a genuinely different initiative than any of that partner's existing engagements, this is a new engagement — not a low-confidence match. Set is_new: true with a suggested name in "Partner - Initiative" format.

**Step 7: When uncertain, flag for review.**
If you cannot confidently determine the engagement, set confidence below 0.70. Do not guess. The human review queue exists for this purpose.

## Content Type

Classify the email's content type for downstream processing:

- **engagement_email** — Standard email correspondence
- **meeting_invite** — Calendar invitation or ICS attachment. A "Meeting Data" section may provide structured attendees and a partner hint — use these as matching signals.
- **mixed** — Contains both email discussion and calendar data
- **noise** — Auto-reply, out-of-office, newsletter, or non-actionable content. This should be rare given curated input. Confidence 1.0.

## Confidence Calibration

- **0.95–1.0:** Sender is a known participant in exactly one engagement, AND topic/subject aligns
- **0.85–0.94:** Partner identified + topic clearly aligns with one engagement, or strong subject continuity
- **0.70–0.84:** Partner identified but topic alignment is partial, or sender appears in multiple engagements
- **Below 0.70:** Cannot determine routing — multiple plausible matches, or no clear partner/topic signal
- **New engagement:** 0.85+ when partner is clear and initiative is clearly distinct from existing engagements

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
}`;

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

  const engagementIds = engagements.map((e) => e.id);

  // Fetch enrichment data in parallel
  const [lastSubjects, participantMap, entityLinksMap] = await Promise.all([
    getLastSubjects(engagements),
    getEngagementParticipants(engagementIds),
    getEngagementEntityLinks(engagementIds),
  ]);

  const parts: string[] = [];

  parts.push(buildCompactForwarder(forwarderNote));
  parts.push(buildEngagementIndex(engagements, lastSubjects, participantMap, entityLinksMap));
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
  lastSubjects: Map<string, string>,
  participantMap: Map<string, string[]> = new Map(),
  entityLinksMap: Map<string, { type: string; name: string }[]> = new Map()
): string {
  const lines: string[] = ["## Engagement Index"];

  if (engagements.length === 0) {
    lines.push("None yet.");
    lines.push("");
    return lines.join("\n");
  }

  // Group engagements by partner_name
  const groups = new Map<string, Engagement[]>();
  for (const eng of engagements) {
    const key = eng.partner_name || "Unassigned";
    const group = groups.get(key) ?? [];
    group.push(eng);
    groups.set(key, group);
  }

  const forwarderEmail = USER_CONFIG.email.toLowerCase();

  for (const [partnerName, partnerEngs] of groups) {
    lines.push("");
    lines.push(`### ${partnerName} (${partnerEngs.length} engagement${partnerEngs.length === 1 ? "" : "s"})`);

    for (const eng of partnerEngs) {
      lines.push("");
      lines.push(`"${eng.name}" (id: ${eng.id})`);

      // Pillar + Topic line
      const metaParts: string[] = [];
      if (eng.pillar) metaParts.push(`Pillar: ${eng.pillar}`);
      if (eng.topic) metaParts.push(`Topic: "${eng.topic}"`);
      if (metaParts.length > 0) lines.push(metaParts.join(" | "));

      // Participants (capped at 8, forwarder excluded, partner domains first)
      const allEmails = participantMap.get(eng.id) ?? [];
      const filtered = allEmails.filter((e) => e.toLowerCase() !== forwarderEmail);
      if (filtered.length > 0) {
        // Sort: non-amazon emails first (partner/third-party), then amazon
        const sorted = [...filtered].sort((a, b) => {
          const aIsAws = isAwsDomain(a);
          const bIsAws = isAwsDomain(b);
          if (aIsAws !== bIsAws) return aIsAws ? 1 : -1;
          return a.localeCompare(b);
        });
        const capped = sorted.slice(0, 8);
        const overflow = sorted.length - capped.length;
        const suffix = overflow > 0 ? `, +${overflow} more` : "";
        lines.push(`Participants: ${capped.join(", ")}${suffix}`);
      }

      // Entity links (programs and events)
      const links = entityLinksMap.get(eng.id) ?? [];
      const programs = links.filter((l) => l.type === "program").map((l) => l.name);
      const events = links.filter((l) => l.type === "event").map((l) => l.name);
      if (programs.length > 0) lines.push(`Programs: ${programs.join(", ")}`);
      if (events.length > 0) lines.push(`Events: ${events.join(", ")}`);

      // Last subject
      const subject = lastSubjects.get(eng.id) ?? "(none)";
      lines.push(`Last Subject: "${subject}"`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/** Check if an email belongs to an AWS domain (amazon.com, amazon.co.uk, amazon.ch, etc.) */
function isAwsDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === "amazon.com" || domain.startsWith("amazon.");
}

export function buildCompactPartnerCatalog(partners: Partner[]): string {
  const lines: string[] = ["## Partner Catalog"];

  const partnersWithDomains = partners.filter((p) => {
    const emails = (p.partner_contacts ?? [])
      .map((c) => c.email)
      .filter((e): e is string => e !== null && e !== "—");
    return emails.length > 0;
  });

  if (partnersWithDomains.length === 0) {
    lines.push("None yet.");
    lines.push("");
    return lines.join("\n");
  }

  for (const p of partnersWithDomains) {
    const emailSource = (p.partner_contacts ?? [])
      .map((c) => c.email)
      .filter((e): e is string => e !== null && e !== "—");

    const domains = [
      ...new Set(
        emailSource
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
 * Fetch participant emails grouped by engagement ID.
 * Returns a Map<engagementId, email[]> with distinct emails per engagement.
 */
async function getEngagementParticipants(
  engagementIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (engagementIds.length === 0) return result;

  const db = getSupabaseClient();

  // Fetch participant_links for these engagements
  const { data: links, error: linksError } = await db
    .from("participant_links")
    .select("entity_id, participant_id")
    .eq("entity_type", "engagement")
    .in("entity_id", engagementIds);

  if (linksError || !links || links.length === 0) return result;

  // Fetch participant emails
  const participantIds = [...new Set(links.map((l: { participant_id: string }) => l.participant_id))];
  const { data: participants, error: pError } = await db
    .from("participants")
    .select("id, email")
    .in("id", participantIds);

  if (pError || !participants) return result;

  const emailMap = new Map<string, string>();
  for (const p of participants) {
    if (p.email) emailMap.set(p.id, p.email);
  }

  // Group by engagement
  for (const link of links) {
    const email = emailMap.get(link.participant_id);
    if (!email) continue;
    const existing = result.get(link.entity_id) ?? [];
    if (!existing.includes(email)) existing.push(email);
    result.set(link.entity_id, existing);
  }

  return result;
}

/**
 * Fetch entity links (programs, events) for engagements with resolved names.
 * Returns a Map<engagementId, {type, name}[]>.
 */
async function getEngagementEntityLinks(
  engagementIds: string[]
): Promise<Map<string, { type: string; name: string }[]>> {
  const result = new Map<string, { type: string; name: string }[]>();
  if (engagementIds.length === 0) return result;

  const db = getSupabaseClient();

  const { data: links, error } = await db
    .from("entity_links")
    .select("source_id, target_type, target_id, context")
    .eq("source_type", "engagement")
    .in("source_id", engagementIds);

  if (error || !links || links.length === 0) return result;

  // Resolve names: try programs and events tables
  const programIds = links.filter((l: { target_type: string }) => l.target_type === "program").map((l: { target_id: string }) => l.target_id);
  const eventIds = links.filter((l: { target_type: string }) => l.target_type === "event").map((l: { target_id: string }) => l.target_id);

  const nameMap = new Map<string, string>();

  if (programIds.length > 0) {
    const { data: progs } = await db.from("programs").select("id, name").in("id", programIds);
    for (const p of progs ?? []) nameMap.set(p.id, p.name);
  }
  if (eventIds.length > 0) {
    const { data: evts } = await db.from("events").select("id, name").in("id", eventIds);
    for (const e of evts ?? []) nameMap.set(e.id, e.name);
  }

  // Group by engagement
  for (const link of links) {
    const name = nameMap.get(link.target_id) ?? link.context ?? link.target_id;
    const existing = result.get(link.source_id) ?? [];
    existing.push({ type: link.target_type, name });
    result.set(link.source_id, existing);
  }

  return result;
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
