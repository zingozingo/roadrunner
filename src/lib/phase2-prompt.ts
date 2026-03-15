import type {
  Message,
  Engagement,
  Meeting,
  Participant,
  Event,
  Program,
  Relationship,
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
import type { NameResolutionMap } from "./name-resolver";
import { resolveNameByEmail } from "./name-resolver";
import { displayName } from "./format-utils";

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
7. A pillar classification

## Thread Awareness

The source emails below are the COMPLETE conversation history for this engagement. The NEW email is clearly marked with ">>> NEW EMAIL — CLASSIFY THIS <<<". Rules:

- Extract information ONLY from the NEW email for participants and entity matches
- Use the history emails for CONTEXT ONLY — to understand what has already been discussed, who the key players are, and what the engagement's trajectory looks like
- Do NOT re-extract participants from history emails — those have already been processed
- Existing participants are listed in the "Existing Participants" section. They are already linked to this engagement. Do NOT include them in your participants output — only extract NEW people from the NEW email who are not in the existing list. If the NEW email has zero new participants, return an empty array.

## topic Instructions

A 3-8 word description of what this engagement is about. Stable across emails — only changes if the engagement fundamentally pivots. Examples: "FedRAMP Certification", "Marketplace Listing Optimization", "Security Competency Technical Validation".

If the engagement already has a topic, return it EXACTLY as-is unless the engagement has fundamentally changed direction. Do not rephrase for stylistic variety.

## goal Instructions

One sentence describing what success looks like for this engagement. Stable — set on creation, rarely updated. Example: "CyberShield achieves AWS Security Competency and lists on Marketplace."

If the engagement already has a goal, return it EXACTLY as-is unless the engagement's objective has fundamentally changed. Do not rephrase for stylistic variety.

## engagement_name Instructions

Compute as "{Partner Name} - {topic}". Must start with the partner name. Example: "CyberShield - Security Competency Technical Validation".

## current_state Instructions

You are given the engagement's existing current_state as an anchor. Your job is to EVOLVE it — not replace it.

**Decision Matrix — follow the FIRST matching scenario:**

| Scenario | Detection | Action |
|----------|-----------|--------|
| New engagement | current_state says "(none yet)" or engagement has no history | Write a fresh 3-5 sentence briefing from the email content |
| Late-arriving email | NEW email's date is OLDER than the engagement's last_activity date | Conservative merge — add only facts not already captured in existing state. Do not overwrite newer information with older. |
| Routine email | Content is administrative: scheduling ack, brief reply, "thanks", "received", forwarding without substance | Make minimal or no changes to existing current_state. A routine email does not warrant rewriting the summary. |
| Material update | Content has decisions, scope changes, new stakeholders, status updates, blockers, or deliverable progress | Update the relevant parts of existing current_state. Preserve parts that are still accurate. Add new facts. |
| Complex engagement | Engagement has multiple active workstreams or extensive history | Up to 7 sentences allowed. Organize by workstream if needed. |

**Temporal Discipline (applies to ALL scenarios):**
- Write as a point-in-time snapshot. Target 3-5 sentences, ~150 words.
- NEVER use relative time words: recently, soon, this week, last month, in the coming weeks.
- Dates from emails are facts — include them. Do NOT infer or predict dates.
- Describe states, not futures: "The blog is in final review" NOT "The blog will be published next week."
- Use present progressive for ongoing activity: "Steven is following up on ticket status."
- You may reference "As of {today's date}, ..." for grounding current status.

**Style Rules (applies to ALL scenarios):**
- Write concretely: names, specifics, outcomes. "Brian sent the architecture diagram to the security team on Feb 15" not "stakeholders are facilitating comprehensive collaboration."
- Use first names only — full details are in the participants field.
- No fabricated dates or timelines.
- No bullet points or markdown formatting.
- No vague filler ("various stakeholders", "ongoing discussions", "comprehensive approach").
- Never drop important context just because a new email arrived.

Return null if this is noise (shouldn't normally happen in Phase 2).

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

Existing entity links are listed in the "Existing Entity Links" section. They are already connected to this engagement. Your matched_events, matched_programs, and matched_relationships arrays should contain ONLY NEW matches from the NEW email — entities not already in the existing links. If nothing new matches, return empty arrays.

Only match entities that are **explicitly referenced or unambiguously implied** in the NEW email. The catalog is large — most items will NOT match any given email. That's expected and correct.

**Events:** Match ONLY when the NEW email explicitly references a specific event by name, or clearly discusses activities tied to that event (presenting at it, preparing for it, scheduling around it, following up from it). Do NOT match just because the partner might attend or the event is upcoming — the email must demonstrate a concrete connection. Match by ID from the provided list only. Never invent events. Meetings, calls, demos, and partner-specific gatherings are NOT events — they are engagement workflow (mention in current_state only). Relationships: relevant_to, preparation_for, deadline, presenting_at, sponsoring.

**Programs:** Match ONLY when the NEW email explicitly mentions a program by name, discusses enrollment/progress/requirements for a specific program, or references a deliverable that unambiguously belongs to a specific program's process (e.g., "completing the technical validation" when the partner is pursuing a competency program). Do NOT match just because the partner is enrolled in a program or the program relates to the engagement's domain — the email must actively discuss the program or its specific activities. Match by ID from the provided list only. Never invent programs. Relationships: implements, qualifies_for, enrolled_in, graduating, blocked_by.

**AWS Relationships:** Match ONLY when a person from a known AWS relationship appears in the NEW email's headers (From, To, CC) or is explicitly named in the body of the NEW email. Match by email address first, then by full name. Do NOT match by topic similarity, team name alone, or because the relationship seems relevant to the engagement's domain. A specific person must be identifiable in the NEW email. Relationships: involved_in, consulted, introduced, escalated_to.

Self-audit: For every entity you match, you MUST include a _reasoning field with a one-sentence justification citing specific evidence from the NEW email. If you cannot write a concrete justification, do not include the match. The _reasoning field is stripped before storage — it exists to force you to verify your matches.

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
    { "id": "uuid", "name": "event name", "relationship": "relevant_to | preparation_for | deadline | presenting_at | sponsoring", "_reasoning": "one sentence: what in the NEW email references this event" }
  ],
  "matched_programs": [
    { "id": "uuid", "name": "program name", "relationship": "implements | qualifies_for | enrolled_in | graduating | blocked_by", "_reasoning": "one sentence: what in the NEW email references this program" }
  ],
  "matched_relationships": [
    { "id": "uuid", "name": "relationship name", "relationship": "involved_in | consulted | introduced | escalated_to", "_reasoning": "one sentence: which person from this relationship appears in the NEW email" }
  ],
  "pillar": "Co-Sell" | "Co-Build" | "Co-Market" | null
}`;

// ============================================================
// Phase 2 context builder — full engagement history
// ============================================================

/**
 * Resolve the best display name for a message sender.
 * Priority: resolution map → stored sender_name → displayName() formatting.
 */
function bestSenderName(
  msg: { sender_name: string | null; sender_email: string | null },
  nameMap?: NameResolutionMap | null
): string {
  // 1. Try resolution map (DB-sourced, highest quality for legacy data)
  if (nameMap && msg.sender_email) {
    const resolved = resolveNameByEmail(msg.sender_email, nameMap);
    if (resolved) return resolved.name;
  }
  // 2. Fall back to stored sender_name
  if (msg.sender_name) return msg.sender_name;
  // 3. Fall back to displayName() formatting (email-prefix → title-case)
  return displayName(msg.sender_name, msg.sender_email);
}

/**
 * Build the full Phase 2 user message with engagement history,
 * new email(s), matched partner, and reference catalogs.
 *
 * @param nameResolutionMap - Optional map for resolving sender names from DB.
 *   When provided, history and new email From lines use the best available name.
 */
export function buildPhase2Context(
  newMessages: Message[],
  phase1Result: Phase1Result,
  history: {
    engagement: Engagement & { partner_name?: string | null };
    messages: Message[];
    meetings: Meeting[];
    participants: (Participant & { role: string | null })[];
  } | null,
  catalogs: {
    events: Event[];
    programs: Program[];
    relationships: Relationship[];
  },
  matchedPartner: Partner | null,
  forwarderNote?: string | null,
  nameResolutionMap?: NameResolutionMap | null,
  newMeetings?: (Meeting & { partner_name?: string | null })[] | null,
  existingLinks?: {
    entityLinks: { type: string; name: string; relationship: string }[];
    awsRelationships: { name: string; relationship: string }[];
  } | null,
  partnerContacts?: { name: string | null; email: string; title: string | null; org_type: string | null; role: string | null }[] | null,
  relationshipContacts?: Map<string, { name: string | null; email: string; role: string | null }[]> | null,
  meetingContacts?: Map<string, { name: string | null; email: string }[]> | null
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
    parts.push(buildExistingParticipants(history.participants));
    parts.push(buildExistingEntityLinks(existingLinks));
    parts.push(buildEngagementHistory(history.messages, nameResolutionMap));
    parts.push(buildLinkedMeetings(history.meetings, meetingContacts ?? null));
  }

  // Section 5: New email(s)
  parts.push(buildNewEmailSection(newMessages, nameResolutionMap));

  // Section 5b: Structured meeting data for the incoming message
  if (newMeetings && newMeetings.length > 0) {
    parts.push(buildNewMeetingData(newMeetings, meetingContacts ?? null));
  }

  // Section 6: Matched partner
  parts.push(buildMatchedPartnerSection(matchedPartner, partnerContacts ?? null));

  // Section 7: Reference catalogs (events filtered to relevant time window)
  const now = new Date();
  const past30 = new Date(now);
  past30.setDate(past30.getDate() - 30);
  const future6m = new Date(now);
  future6m.setMonth(future6m.getMonth() + 6);

  const filteredEvents = catalogs.events.filter(evt => {
    if (!evt.start_date) return true; // Include events with no date (TBD)
    const eventDate = new Date(evt.start_date);
    return eventDate >= past30 && eventDate <= future6m;
  });

  parts.push("## Reference Data\n");
  parts.push(buildEventsSection(filteredEvents));
  parts.push(buildProgramsSection(catalogs.programs));
  parts.push(buildRelationshipsSection(catalogs.relationships, relationshipContacts ?? null));

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
  engagement: Engagement & { partner_name?: string | null };
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

function buildEngagementHistory(
  messages: Message[],
  nameMap?: NameResolutionMap | null
): string {
  if (messages.length === 0) return "";

  const total = messages.length;
  const lines = [
    `## Engagement History (${total} message${total === 1 ? "" : "s"}, oldest first)\n`,
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    lines.push(`### Message ${i + 1} of ${total} — HISTORY`);
    if (msg.sender_email) {
      const name = bestSenderName(msg, nameMap);
      lines.push(`**From:** ${name} <${msg.sender_email}>`);
    }
    if (msg.to_header) lines.push(`**To:** ${msg.to_header}`);
    if (msg.cc_header) lines.push(`**CC:** ${msg.cc_header}`);
    if (msg.subject) lines.push(`**Subject:** ${msg.subject}`);
    if (msg.sent_at) lines.push(`**Date:** ${msg.sent_at}`);
    lines.push(`\n${msg.body_text || msg.body_raw || "(empty body)"}\n`);
  }

  return lines.join("\n");
}

function buildLinkedMeetings(
  meetings: Meeting[],
  meetingContactsMap?: Map<string, { name: string | null; email: string }[]> | null
): string {
  if (meetings.length === 0) return "";

  const lines = ["### Linked Meetings"];
  for (const m of meetings) {
    const datePart = m.meeting_date || "date TBD";
    const timePart =
      m.start_time && m.end_time
        ? `, ${m.start_time}–${m.end_time}`
        : "";
    const recurPart = m.is_recurring ? ", recurring" : "";
    lines.push(
      `- "${m.title}" — ${datePart}${timePart}, ${m.status}${recurPart}`
    );
    if (m.organizer_email) {
      lines.push(`  Organizer: ${m.organizer_email}`);
    }

    // Prefer registry contacts; fall back to JSONB attendees
    const registryContacts = meetingContactsMap?.get(m.id);
    if (registryContacts && registryContacts.length > 0) {
      const formatted = registryContacts.map((c) =>
        c.name ? `${c.name} <${c.email}>` : c.email
      );
      lines.push(`  Attendees: ${formatted.join(", ")}`);
    } else if (m.attendees && m.attendees.length > 0) {
      const formatted = m.attendees.map((a) =>
        a.name ? `${a.name} <${a.email}>` : a.email
      );
      lines.push(`  Attendees: ${formatted.join(", ")}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function buildExistingParticipants(
  participants: (Participant & { role: string | null })[]
): string {
  if (participants.length === 0) return "";

  const lines = ["### Existing Participants (already linked — do NOT re-extract)\n"];
  for (const p of participants) {
    const email = p.email ? ` <${p.email}>` : "";
    const org = p.organization ? ` (${p.organization})` : "";
    const role = p.role ? ` — ${p.role}` : "";
    lines.push(`- ${p.name || "Unknown"}${email}${org}${role}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildExistingEntityLinks(
  links?: {
    entityLinks: { type: string; name: string; relationship: string }[];
    awsRelationships: { name: string; relationship: string }[];
  } | null
): string {
  if (!links) return "";

  const { entityLinks, awsRelationships } = links;
  if (entityLinks.length === 0 && awsRelationships.length === 0) return "";

  const lines = ["### Existing Entity Links (already linked — preserve these)\n"];

  const programs = entityLinks.filter(l => l.type === "program");
  const events = entityLinks.filter(l => l.type === "event");

  if (programs.length > 0) {
    lines.push(`**Programs:** ${programs.map(p => `${p.name} (${p.relationship})`).join(", ")}`);
  }
  if (events.length > 0) {
    lines.push(`**Events:** ${events.map(e => `${e.name} (${e.relationship})`).join(", ")}`);
  }
  if (awsRelationships.length > 0) {
    lines.push(`**AWS Relationships:** ${awsRelationships.map(r => r.name).join(", ")}`);
  }

  lines.push("");
  return lines.join("\n");
}

function buildNewMeetingData(
  meetings: (Meeting & { partner_name?: string | null })[],
  meetingContactsMap?: Map<string, { name: string | null; email: string }[]> | null
): string {
  const lines = ["### Incoming Meeting Data\n"];

  for (const m of meetings) {
    lines.push(`**Title:** ${m.title}`);
    if (m.meeting_date) lines.push(`**Date:** ${m.meeting_date}`);
    if (m.start_time && m.end_time) lines.push(`**Time:** ${m.start_time}–${m.end_time}`);
    if (m.organizer_email) lines.push(`**Organizer:** ${m.organizer_email}`);
    if (m.partner_name) {
      const idPart = m.partner_id ? ` (id: ${m.partner_id})` : "";
      lines.push(`**Matched Partner:** ${m.partner_name}${idPart}`);
    }
    if (m.is_recurring) lines.push(`**Recurring:** Yes`);

    // Prefer registry contacts; fall back to JSONB attendees
    const registryContacts = meetingContactsMap?.get(m.id);
    if (registryContacts && registryContacts.length > 0) {
      lines.push("**Attendees:**");
      for (const c of registryContacts) {
        const name = c.name ? `${c.name} ` : "";
        lines.push(`- ${name}<${c.email}>`);
      }
    } else if (m.attendees && m.attendees.length > 0) {
      lines.push("**Attendees:**");
      for (const a of m.attendees) {
        const name = a.name ? `${a.name} ` : "";
        lines.push(`- ${name}<${a.email}>`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

function buildNewEmailSection(
  messages: Message[],
  nameMap?: NameResolutionMap | null
): string {
  const lines = ["---\n"];

  for (const msg of messages) {
    lines.push("### >>> NEW EMAIL — CLASSIFY THIS <<<");
    if (msg.sender_email) {
      const name = bestSenderName(msg, nameMap);
      lines.push(`**From:** ${name} <${msg.sender_email}>`);
    }
    if (msg.to_header) lines.push(`**To:** ${msg.to_header}`);
    if (msg.cc_header) lines.push(`**CC:** ${msg.cc_header}`);
    if (msg.subject) lines.push(`**Subject:** ${msg.subject}`);
    if (msg.sent_at) lines.push(`**Date:** ${msg.sent_at}`);
    lines.push(`\n${msg.body_text || msg.body_raw || "(empty body)"}\n`);
  }

  return lines.join("\n");
}

function buildMatchedPartnerSection(
  partner: Partner | null,
  registryContacts: { name: string | null; email: string; title: string | null; org_type: string | null; role: string | null }[] | null
): string {
  const lines = ["## Matched Partner\n"];

  if (!partner) {
    lines.push("Partner not in catalog.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`**Name:** ${partner.name} (id: ${partner.id})`);
  if (partner.segment) lines.push(`**Segment:** ${partner.segment}`);

  // Render key contacts — prefer registry, fall back to JSONB
  if (registryContacts && registryContacts.length > 0) {
    const keyContacts = registryContacts.slice(0, 4);
    const contactStrs = keyContacts.map((c) => {
      const namePart = c.name ?? "Unknown";
      const emailPart = ` <${c.email}>`;
      return `${namePart}${emailPart} (${c.role})`;
    });
    lines.push(`**Key Contacts:** ${contactStrs.join(", ")}`);
  } else {
    // Fallback to JSONB for backward compatibility
    const keyContacts = [
      ...(partner.partner_contacts ?? []),
      ...(partner.aws_team ?? []),
    ].slice(0, 4);

    if (keyContacts.length > 0) {
      const contactStrs = keyContacts.map((c) => {
        const namePart = c.name ?? "Unknown";
        const emailPart = c.email ? ` <${c.email}>` : "";
        return `${namePart}${emailPart} (${c.role})`;
      });
      lines.push(`**Key Contacts:** ${contactStrs.join(", ")}`);
    }
  }

  if (partner.what_they_do) lines.push(`**What they do:** ${partner.what_they_do}`);
  lines.push("");
  return lines.join("\n");
}
