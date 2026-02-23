import type {
  Message,
  Engagement,
  Meeting,
  Participant,
  Event,
  Program,
  AwsRelationship,
  Partner,
  Phase1Result,
  CombinedClassificationResult,
} from "./types";
import {
  buildForwarderSection,
  buildEventsSection,
  buildProgramsSection,
  buildRelationshipsSection,
} from "./prompt-builder";

// ============================================================
// Phase 2 system prompt — deep analysis with full thread history
// ============================================================

export const PHASE2_SYSTEM_PROMPT = `You are Relay Analyst, an AI that analyzes emails for an AWS Partner Development Manager (PDM). You are given the FULL history of an engagement and a NEW email to incorporate.

## Your Job

Analyze the NEW email (clearly marked below) in the context of the engagement's history. Produce:
1. An updated current_state summary
2. New open items (if any)
3. Identification of resolved open items (if any)
4. A participant list extracted from the NEW email
5. Matched events, programs, and AWS relationships
6. Suggested tags
7. A pillar classification

## Thread Awareness

The source emails below are the COMPLETE conversation history for this engagement. The NEW email is clearly marked with ">>> NEW EMAIL — CLASSIFY THIS <<<". Rules:

- Extract information ONLY from the NEW email for open_items, participants, and entity matches
- Use the history emails for CONTEXT ONLY — to understand what has already been discussed, who the key players are, and what the engagement's trajectory looks like
- Do NOT re-extract participants or open items from history emails — those have already been processed

## current_state Instructions

You are given the engagement's existing current_state as an anchor. Your job is to EVOLVE it.

**For existing engagements:**
- Read the existing current_state carefully — it represents the accumulated knowledge so far
- If the NEW email contains material information (decisions, scope changes, new stakeholders, status updates, blockers), update the relevant parts while preserving the rest
- If the NEW email is routine (scheduling ack, brief reply, "thanks"), make minimal or no changes to current_state
- Never drop important context just because a new email arrived
- Keep it 3-5 sentences for typical engagements, up to 7 for complex multi-workstream engagements with extensive history

**For new engagements (no history):**
- If this engagement has no history (new engagement), write a fresh briefing based on the email content. Use the partner name from the engagement context for consistent naming.

**Temporal awareness:**
- Compare the NEW email's date against the engagement's last_activity date
- If the NEW email is OLDER than the existing state (late-arriving forward), be conservative — incorporate only facts not already captured, don't overwrite newer information with older
- If the NEW email is newer, update state normally

**Style rules:**
- Write concretely: names, specifics, outcomes. "Brian sent the architecture diagram to the security team on Feb 15" not "stakeholders are facilitating comprehensive collaboration"
- Use first names only — full details are in the participants field
- No fabricated dates or timelines
- No bullet points or markdown formatting
- No vague filler ("various stakeholders", "ongoing discussions", "comprehensive approach")

Return null if this is noise (shouldn't normally happen in Phase 2, but handle gracefully).

## open_items Instructions

Extract ONLY concrete, actionable commitments from the NEW email. These should be items worth mentioning in a status update to leadership — blockers and commitments, not granular tasks.

**What qualifies:**
- Explicit commitments: "I'll send the architecture doc by Friday"
- Clear blockers: "We're blocked on security review approval"
- Deadlines: "POC must be complete before re:Invent"
- Requests with specific asks: "Can you connect us with the CloudFormation team?"

**What does NOT qualify:**
- Vague intentions: "Let's circle back on this"
- Pleasantries: "Looking forward to working together"
- Granular tasks: "I'll update the spreadsheet" (unless it's a key deliverable)
- Things already captured in existing open_items

**Assignee:** Use first name. If a team, use "Acme team" or "AWS team". If unknown, null.

**Due date:** ONLY if explicitly stated ("by Friday", "due March 15", "before re:Invent"). Convert relative dates using the email's date. Never fabricate from "soon" or "ASAP".

**Existing open items:** You can see them in the engagement context with their resolved/unresolved status. Do NOT re-extract existing items. Only return genuinely NEW items from the NEW email.

## resolved_open_items Instructions

If the NEW email indicates that an existing open item has been completed (e.g., "I sent the document", "the meeting is scheduled", "security review passed"), include that item's description in resolved_open_items.

Match by meaning, not exact wording. "Jordan sent the GTM doc" resolves "Send GTM campaign strategy document". When in doubt, do NOT resolve — let the user handle it.

## Participants

Extract all people mentioned in the NEW email (From, To, CC headers and body). Each person appears ONCE — merge header info with body/signature info.

**Roles (use this vocabulary):**
- "forwarder" — the PDM (always include, always this role)
- "partner_contact" — someone from the partner company
- "aws_stakeholder" — an AWS employee (not the PDM)
- "executive" — a VP/C-level/Director explicitly involved (from either side)
- "technical_contact" — an engineer, architect, or technical lead
- "third_party" — someone from neither AWS nor the partner

Set email to null only if truly unavailable. The forwarder is identified in the context — always include them once with role "forwarder", do not duplicate if they appear in headers.

## Entity Matching

**Events:** Match ONLY to events in the provided list, by ID. Never invent events. Meetings, calls, demos, and partner-specific gatherings are NOT events — they are engagement workflow (mention in current_state only). Relationships: relevant_to, preparation_for, deadline, presenting_at, sponsoring.

**Programs:** Match ONLY to programs in the provided list, by ID. Never invent programs. Relationships: implements, qualifies_for, enrolled_in, graduating, blocked_by.

**AWS Relationships:** Match when people from a known AWS relationship appear in the NEW email. Match by email address or name against the provided list. Relationships: involved_in, consulted, introduced, escalated_to.

If nothing matches for any category, return an empty array. Empty arrays are always better than fabricated matches.

## Pillar Inference

Classify the engagement's primary pillar based on ALL available context (history + new email):

- **Co-Sell** — Revenue-focused: deals, pipeline, marketplace listings, customer introductions, GTM motions, account mapping
- **Co-Build** — Technical: integrations, certifications, competencies, technical validations, POCs, architecture reviews
- **Co-Market** — Awareness: events, content, webinars, campaigns, case studies, press releases, speaking slots

Return null if unclear. It's fine to not classify early-stage engagements.

## Engagement Naming (new engagements only)

If this is a new engagement, suggest a name in the format: "Partner Name - Descriptive Initiative"
Examples: "Acme Security - FedRAMP Certification", "NinjaOne - NFL Sports League Partnership"
Keep it concise but specific enough to distinguish from other engagements with the same partner.

## Response Format

Return ONLY valid JSON. No markdown code blocks, no preamble.

The content_type and engagement_match fields are provided to you in the "Phase 1 Classification" section below — echo them back exactly as given.

{
  "content_type": "engagement_email" | "meeting_invite" | "mixed" | "noise",
  "engagement_match": {
    "id": "echo from Phase 1",
    "name": "echo from Phase 1 (or updated name for new engagements)",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "echo from Phase 1",
    "partner_id": "echo from Phase 1"
  },
  "current_state": "3-7 sentence executive briefing or null if noise",
  "open_items": [
    {
      "description": "specific actionable commitment or blocker",
      "assignee": "first name or null",
      "due_date": "ISO date or null"
    }
  ],
  "resolved_open_items": ["description of resolved item"],
  "participants": [
    {
      "name": "full name",
      "email": "email or null",
      "organization": "company or null",
      "role": "forwarder | partner_contact | aws_stakeholder | executive | technical_contact | third_party"
    }
  ],
  "matched_events": [
    { "id": "uuid", "name": "event name", "relationship": "relevant_to | preparation_for | deadline | presenting_at | sponsoring" }
  ],
  "matched_programs": [
    { "id": "uuid", "name": "program name", "relationship": "implements | qualifies_for | enrolled_in | graduating | blocked_by" }
  ],
  "matched_relationships": [
    { "id": "uuid", "name": "relationship name", "relationship": "involved_in | consulted | introduced | escalated_to" }
  ],
  "pillar": "Co-Sell" | "Co-Build" | "Co-Market" | null
}`;

// ============================================================
// Phase 2 context builder — full engagement history
// ============================================================

/**
 * Build the full Phase 2 user message with engagement history,
 * new email(s), matched partner, and reference catalogs.
 */
export function buildPhase2Context(
  newMessages: Message[],
  phase1Result: Phase1Result,
  history: {
    engagement: Engagement;
    messages: Message[];
    meetings: Meeting[];
    participants: (Participant & { role: string | null })[];
  } | null,
  catalogs: {
    events: Event[];
    programs: Program[];
    relationships: AwsRelationship[];
  },
  matchedPartner: Partner | null,
  forwarderNote?: string | null
): string {
  const parts: string[] = [];

  // Section 1: Forwarder identity
  parts.push(buildForwarderSection(forwarderNote));

  // Section 2: Phase 1 classification (pass-through)
  parts.push(buildPhase1PassThrough(phase1Result));

  // Section 3 & 4: Engagement context + history (existing engagements only)
  if (history) {
    parts.push(buildEngagementContext(history));
    parts.push(buildEngagementHistory(history.messages));
    parts.push(buildLinkedMeetings(history.meetings));
  }

  // Section 5: New email(s)
  parts.push(buildNewEmailSection(newMessages));

  // Section 6: Matched partner
  parts.push(buildMatchedPartnerSection(matchedPartner));

  // Section 7: Reference catalogs
  parts.push("## Reference Data\n");
  parts.push(buildEventsSection(catalogs.events));
  parts.push(buildProgramsSection(catalogs.programs));
  parts.push(buildRelationshipsSection(catalogs.relationships));

  return parts.join("\n");
}

// ============================================================
// Parse Phase 2 response
// ============================================================

export function parsePhase2Response(raw: string): CombinedClassificationResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Default arrays if Claude omits them
  if (!parsed.matched_events) parsed.matched_events = [];
  if (!parsed.matched_programs) parsed.matched_programs = [];
  if (!parsed.matched_relationships) parsed.matched_relationships = [];
  if (!parsed.participants) parsed.participants = [];
  if (!parsed.open_items) parsed.open_items = [];
  if (!parsed.resolved_open_items) parsed.resolved_open_items = [];
  if (!parsed.suggested_tags) parsed.suggested_tags = [];
  if (parsed.pillar === undefined) parsed.pillar = null;

  return parsed as CombinedClassificationResult;
}

// ============================================================
// Internal section builders
// ============================================================

function buildPhase1PassThrough(phase1Result: Phase1Result): string {
  const em = phase1Result.engagement_match;
  const lines = [
    "## Phase 1 Classification (echo these in your response)\n",
    `content_type: "${phase1Result.content_type}"`,
    `engagement_match: ${JSON.stringify(em)}`,
    "",
  ];
  return lines.join("\n");
}

function buildEngagementContext(history: {
  engagement: Engagement;
  messages: Message[];
  meetings: Meeting[];
  participants: (Participant & { role: string | null })[];
}): string {
  const eng = history.engagement;
  const lines = [
    "## Engagement Context\n",
    `**Name:** ${eng.name}`,
    `**ID:** ${eng.id}`,
  ];

  if (eng.partner_name) {
    const partnerIdStr = eng.partner_id ? ` (id: ${eng.partner_id})` : "";
    lines.push(`**Partner:** ${eng.partner_name}${partnerIdStr}`);
  }

  lines.push(`**Status:** ${eng.status}`);
  lines.push(`**Created:** ${eng.created_at.split("T")[0]}`);
  lines.push(`**Last activity:** ${eng.updated_at.split("T")[0]}`);
  lines.push(`**Message count:** ${history.messages.length}`);
  lines.push("");

  // Current state as anchor
  if (eng.current_state) {
    lines.push("**Current state (anchor — evolve this):**");
    lines.push(eng.current_state);
  } else {
    lines.push("**Current state:** (none yet — write a fresh briefing)");
  }
  lines.push("");

  // Open items with resolved status
  if (eng.open_items && eng.open_items.length > 0) {
    lines.push("**Open items:**");
    for (const item of eng.open_items) {
      const assigneePart = item.assignee ? ` (${item.assignee})` : "";
      const duePart = item.due_date ? ` [due: ${item.due_date}]` : "";
      const status = item.resolved ? "RESOLVED" : "UNRESOLVED";
      lines.push(`- ${item.description}${assigneePart}${duePart} [${status}]`);
    }
  } else {
    lines.push("**Open items:** none");
  }
  lines.push("");

  lines.push("");

  return lines.join("\n");
}

function buildEngagementHistory(messages: Message[]): string {
  if (messages.length === 0) return "";

  const total = messages.length;
  const lines = [
    `## Engagement History (${total} message${total === 1 ? "" : "s"}, oldest first)\n`,
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    lines.push(`### Message ${i + 1} of ${total} — HISTORY`);
    if (msg.sender_email) {
      lines.push(`**From:** ${msg.sender_name || ""} <${msg.sender_email}>`);
    }
    if (msg.to_header) lines.push(`**To:** ${msg.to_header}`);
    if (msg.cc_header) lines.push(`**CC:** ${msg.cc_header}`);
    if (msg.subject) lines.push(`**Subject:** ${msg.subject}`);
    if (msg.sent_at) lines.push(`**Date:** ${msg.sent_at}`);
    lines.push(`\n${msg.body_text || msg.body_raw || "(empty body)"}\n`);
  }

  return lines.join("\n");
}

function buildLinkedMeetings(meetings: Meeting[]): string {
  if (meetings.length === 0) return "";

  const lines = ["### Linked Meetings"];
  for (const m of meetings) {
    const datePart = m.meeting_date || "date TBD";
    const timePart =
      m.start_time && m.end_time
        ? `, ${m.start_time}–${m.end_time}`
        : "";
    const attendeeCount = m.attendees?.length ?? 0;
    lines.push(
      `- "${m.title}" — ${datePart}${timePart}, ${attendeeCount} attendee${attendeeCount === 1 ? "" : "s"}, ${m.status}`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function buildNewEmailSection(messages: Message[]): string {
  const lines = ["---\n"];

  for (const msg of messages) {
    lines.push("### >>> NEW EMAIL — CLASSIFY THIS <<<");
    if (msg.sender_email) {
      lines.push(`**From:** ${msg.sender_name || ""} <${msg.sender_email}>`);
    }
    if (msg.to_header) lines.push(`**To:** ${msg.to_header}`);
    if (msg.cc_header) lines.push(`**CC:** ${msg.cc_header}`);
    if (msg.subject) lines.push(`**Subject:** ${msg.subject}`);
    if (msg.sent_at) lines.push(`**Date:** ${msg.sent_at}`);
    lines.push(`\n${msg.body_text || msg.body_raw || "(empty body)"}\n`);
  }

  return lines.join("\n");
}

function buildMatchedPartnerSection(partner: Partner | null): string {
  const lines = ["## Matched Partner\n"];

  if (!partner) {
    lines.push("Partner not in catalog.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`**Name:** ${partner.name} (id: ${partner.id})`);
  if (partner.segment) lines.push(`**Segment:** ${partner.segment}`);
  if (partner.alliance_lead) lines.push(`**Alliance Lead:** ${partner.alliance_lead}`);
  if (partner.what_they_do) lines.push(`**What they do:** ${partner.what_they_do}`);
  lines.push("");
  return lines.join("\n");
}
