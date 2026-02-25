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
1. A topic (3-8 word description of what this engagement is about)
2. A goal (1 sentence describing what success looks like)
3. An engagement_name computed as "{Partner Name} - {topic}"
4. An updated current_state summary
5. A participant list extracted from the NEW email
6. Matched events, programs, and AWS relationships
7. Suggested tags
8. A pillar classification

## Thread Awareness

The source emails below are the COMPLETE conversation history for this engagement. The NEW email is clearly marked with ">>> NEW EMAIL — CLASSIFY THIS <<<". Rules:

- Extract information ONLY from the NEW email for participants and entity matches
- Use the history emails for CONTEXT ONLY — to understand what has already been discussed, who the key players are, and what the engagement's trajectory looks like
- Do NOT re-extract participants from history emails — those have already been processed

## topic Instructions

A 3-8 word description of what this engagement is about. Stable across emails — only changes if the engagement fundamentally pivots. Examples: "FedRAMP Certification", "Marketplace Listing Optimization", "Security Competency Technical Validation".

If the engagement already has a topic, return it EXACTLY as-is unless the engagement has fundamentally changed direction. Do not rephrase for stylistic variety.

## goal Instructions

One sentence describing what success looks like for this engagement. Stable — set on creation, rarely updated. Example: "CyberShield achieves AWS Security Competency and lists on Marketplace."

If the engagement already has a goal, return it EXACTLY as-is unless the engagement's objective has fundamentally changed. Do not rephrase for stylistic variety.

## engagement_name Instructions

Compute as "{Partner Name} - {topic}". Must start with the partner name. Example: "CyberShield - Security Competency Technical Validation".

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

**Date discipline (CRITICAL):**
- Write as a point-in-time snapshot. Maximum 3-8 sentences, approximately 150 words.
- NEVER use relative time words: recently, soon, this week, last month, in the coming weeks.
- Dates that appear in emails are facts — include them. Do NOT infer or predict dates.
- Describe states, not futures: "The blog is in final review" NOT "The blog will be published next week."
- If referencing ongoing activity, use present progressive: "Steven is following up on ticket status."
- For grounding, you may reference: "As of {today's date}, ..." when describing current status.

**Style rules:**
- Write concretely: names, specifics, outcomes. "Brian sent the architecture diagram to the security team on Feb 15" not "stakeholders are facilitating comprehensive collaboration"
- Use first names only — full details are in the participants field
- No fabricated dates or timelines
- No bullet points or markdown formatting
- No vague filler ("various stakeholders", "ongoing discussions", "comprehensive approach")

Return null if this is noise (shouldn't normally happen in Phase 2, but handle gracefully).

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

Only match entities that are **explicitly referenced or unambiguously implied** in the NEW email. The catalog is large — most items will NOT match any given email. That's expected and correct.

**Events:** Match ONLY when the NEW email explicitly references a specific event by name, or clearly discusses activities tied to that event (presenting at it, preparing for it, scheduling around it, following up from it). Do NOT match just because the partner might attend or the event is upcoming — the email must demonstrate a concrete connection. Match by ID from the provided list only. Never invent events. Meetings, calls, demos, and partner-specific gatherings are NOT events — they are engagement workflow (mention in current_state only). Relationships: relevant_to, preparation_for, deadline, presenting_at, sponsoring.

**Programs:** Match ONLY when the NEW email explicitly mentions a program by name, discusses enrollment/progress/requirements for a specific program, or references a deliverable that unambiguously belongs to a specific program's process (e.g., "completing the technical validation" when the partner is pursuing a competency program). Do NOT match just because the partner is enrolled in a program or the program relates to the engagement's domain — the email must actively discuss the program or its specific activities. Match by ID from the provided list only. Never invent programs. Relationships: implements, qualifies_for, enrolled_in, graduating, blocked_by.

**AWS Relationships:** Match ONLY when a person from a known AWS relationship appears in the NEW email's headers (From, To, CC) or is explicitly named in the body of the NEW email. Match by email address first, then by full name. Do NOT match by topic similarity, team name alone, or because the relationship seems relevant to the engagement's domain. A specific person must be identifiable in the NEW email. Relationships: involved_in, consulted, introduced, escalated_to.

If nothing matches for any category, return an empty array. Empty arrays are always better than weak matches. Most emails will match zero events and zero or one programs — that's correct behavior.

## Pillar Inference

Classify the engagement's primary pillar based on ALL available context (history + new email):

- **Co-Sell** — Revenue-focused: deals, pipeline, marketplace listings, customer introductions, GTM motions, account mapping
- **Co-Build** — Technical: integrations, certifications, competencies, technical validations, POCs, architecture reviews
- **Co-Market** — Awareness: events, content, webinars, campaigns, case studies, press releases, speaking slots

Return null if unclear. It's fine to not classify early-stage engagements.

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
  "topic": "3-8 word description of engagement subject",
  "goal": "One sentence describing what success looks like",
  "engagement_name": "{Partner Name} - {topic}",
  "current_state": "3-8 sentence point-in-time snapshot or null if noise",
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

  // Section 0: Current date anchor
  const today = new Date().toISOString().split("T")[0];
  parts.push(`## Current Date\n${today}\n\nUse this as your temporal anchor. Do not speculate about future dates.\n`);

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
  if (!parsed.suggested_tags) parsed.suggested_tags = [];
  if (parsed.pillar === undefined) parsed.pillar = null;

  // Default new structured fields
  if (parsed.topic === undefined) parsed.topic = null;
  if (parsed.goal === undefined) parsed.goal = null;
  if (parsed.engagement_name === undefined) parsed.engagement_name = null;

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

  lines.push(`**Topic:** ${eng.topic || "Not yet set"}`);
  lines.push(`**Goal:** ${eng.goal || "Not yet set"}`);
  lines.push(`**Status:** ${eng.status}`);
  if (eng.pillar) lines.push(`**Pillar:** ${eng.pillar}`);
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
