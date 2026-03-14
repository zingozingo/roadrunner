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

Follow these steps in order.

**Step 1: Check the forwarder note.**
If the PDM included a note, treat it as high-authority context for routing.

**Step 2: Identify the partner.**
Use the Partner Catalog to identify which partner the sender belongs to (match by email domain). For @amazon.com or third-party senders, identify the partner from email content (partner names, engagement references, participant names).

**Step 3: Evaluate against ALL engagements for that partner.**
For EVERY engagement belonging to the identified partner, evaluate whether the email's content matches that engagement. Use these signals:
  a. **Topic alignment** — Does the email describe the SAME initiative, project, or workstream as the engagement's Topic field? Topic is a stable identifier (e.g., "Security Competency Technical Validation").
  b. **Context alignment** — Does the email's content connect to the situation described in the engagement's Context field? Context is the current narrative state (e.g., "Steven is coordinating the technical review with the security team"). An email about scheduling a prep call might not match the Topic strongly, but it connects directly to the Context.
  c. **Participant overlap** — Is the sender or any CC'd address a known participant in this engagement?
  d. **Pillar alignment** — Is the email about selling (Co-Sell), building/integrating (Co-Build), or marketing/events (Co-Market)? Does it match the engagement's pillar?
  e. **Linked entities** — Does the email reference a program or event name that's linked to this engagement?
  f. **Subject continuity** — Does the subject line continue a thread matching this engagement's last subject?
  g. **External parties** — Are different third-party companies involved? (e.g., Bridge Partners vs. AWS IaC team = different engagements)

The number of engagements a partner has is IRRELEVANT to routing. A partner with one engagement still requires content evaluation — the email might describe a completely different initiative.

**Step 4: Route based on evaluation.**
- If exactly ONE engagement clearly matches (strong topic and context alignment + supporting signals) → route to it.
- If NO engagement matches the email's content → this is a new engagement. Set is_new: true (see Step 5).
- If MULTIPLE engagements could match → use the strongest combination of signals to pick one, or flag for review if genuinely ambiguous.

**Step 5: Identify new engagements.**
If the email involves a known partner but describes an initiative, project, campaign, or workstream that does NOT match any existing engagement's described activity, this is a new engagement — not a low-confidence match to the closest one.

Signs of a new engagement:
- Different project/campaign name (e.g., "Solution Spotlight" vs. "OpenTofu Collaboration")
- Different external parties involved (e.g., Bridge Partners vs. AWS IaC team)
- Different pillar (Co-Market campaign vs. Co-Build integration)
- Different AWS program referenced
- Fundamentally different objective or workstream

NOT a new engagement (do not create new for these):
- A new email thread about the same initiative — different subject line, but the work described matches an existing engagement's topic and context. Route to the existing engagement.
- A sub-task or scheduling email for an existing workstream — "Can we set up a call about the technical review?" belongs to the engagement that owns the technical review.
- An email that mentions multiple existing engagements — route to the PRIMARY one (the engagement whose topic/context most directly matches the email's main subject). Do not create a new engagement as an escape hatch for ambiguity.
- A follow-up or status update on existing work — even if the tone, participants, or framing has shifted, if the underlying initiative is the same, it belongs to the existing engagement.

Set is_new: true with confidence 0.85+ when the partner is clear and the initiative is clearly distinct. Use "Partner - Initiative" format for the suggested name.

**Step 6: When uncertain, flag for review.**
If you cannot confidently determine the engagement, set confidence below 0.70. Do not guess. The human review queue exists for this purpose.

## Content Type

Classify the email's content type for downstream processing:

- **engagement_email** — Standard email correspondence
- **meeting_invite** — Calendar invitation or ICS attachment. A "Meeting Data" section may provide structured attendees and a partner hint — use these as matching signals.
- **mixed** — Contains both email discussion and calendar data
- **noise** — Auto-reply, out-of-office, newsletter, or non-actionable content. This should be rare given curated input. Confidence 1.0.

## Confidence Calibration

- **0.95–1.0:** Strong topic and context alignment with one engagement AND participant overlap confirms it
- **0.85–0.94:** Clear topic and context alignment with one engagement, or strong subject continuity with supporting signals
- **0.70–0.84:** Partner identified but topic alignment is weak or partial, or multiple engagements could plausibly match
- **Below 0.70:** Cannot determine routing — no clear topic or context match, or genuinely ambiguous between engagements
- **New engagement:** 0.85+ when partner is clear and the email's initiative is clearly distinct from ALL existing engagements for that partner

IMPORTANT: Partner identification alone (matching the sender's domain) is NEVER sufficient for high confidence. You must also confirm that the email's content matches the engagement's topic and context.

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
  engagements: (Engagement & { partner_name?: string | null })[],
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
  const groups = new Map<string, (Engagement & { partner_name?: string | null })[]>();
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

      // Goal
      if (eng.goal) lines.push(`Goal: "${eng.goal}"`);

      // Context — truncated current_state for semantic understanding
      if (eng.current_state) {
        const truncated = truncateToWords(eng.current_state, 150);
        lines.push(`Context: ${truncated}`);
      }

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

  // Fetch engagement_participants for these engagements
  const { data: links, error: linksError } = await db
    .from("engagement_participants")
    .select("engagement_id, participant_id")
    .in("engagement_id", engagementIds);

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
    const existing = result.get(link.engagement_id) ?? [];
    if (!existing.includes(email)) existing.push(email);
    result.set(link.engagement_id, existing);
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
async function getMeetingsForMessages(
  messages: Message[]
): Promise<(Meeting & { partner_name: string | null })[]> {
  const messageIds = messages.map((m) => m.id);
  if (messageIds.length === 0) return [];

  const db = getSupabaseClient();
  const { data, error } = await db
    .from("meetings")
    .select("*")
    .in("message_id", messageIds);

  if (error || !data) return [];

  const meetings = data as Meeting[];

  // Resolve partner names
  const partnerIds = new Set<string>();
  for (const m of meetings) {
    if (m.partner_id) partnerIds.add(m.partner_id);
  }

  const partnerNames = new Map<string, string>();
  if (partnerIds.size > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);
    for (const p of partners ?? []) {
      const row = p as { id: string; name: string };
      partnerNames.set(row.id, row.name);
    }
  }

  return meetings.map((m) => ({
    ...m,
    partner_name: m.partner_id ? partnerNames.get(m.partner_id) ?? null : null,
  }));
}

/**
 * Build a compact meeting data section for Phase 1 context.
 * Includes attendee list and partner hint from ICS attendee domain matching.
 */
export function buildMeetingHint(meetings: (Meeting & { partner_name?: string | null })[]): string {
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

/**
 * Truncate text to approximately N words. If truncated, appends "…"
 */
export function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

// Exported for testing
export { buildCompactForwarder, getLastSubjects, getMeetingsForMessages };
