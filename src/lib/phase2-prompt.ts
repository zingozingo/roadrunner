import type {
  Message,
  Engagement,
  Meeting,
  Participant,
  Partner,
  Phase1Result,
  CombinedClassificationResult,
} from "./types";
import {
  buildForwarderSection,
} from "./prompt-builder";
import type { NameResolutionMap } from "./name-resolver";
import { resolveNameByEmail } from "./name-resolver";
import { displayName } from "./format-utils";

// ============================================================
// Engagement synthesis system prompt — evolve the anchor model
// ============================================================

export const PHASE2_SYSTEM_PROMPT = `You are Relay Analyst, an AI that analyzes emails for an AWS Partner Development Manager (PDM). You are given an engagement's current state and a NEW email to incorporate.

## Your Job

Analyze the NEW email in the context of the engagement's existing state. Produce:
1. A topic (3-8 word description of what this engagement is about)
2. An engagement_name computed as "{Partner Name} - {topic}"
3. An updated current_state summary (evolving the previous state)
4. A condensed key facts digest for upstream AI consumption
5. A participant list extracted from the NEW email
6. A pillar classification

## Context You Receive

You are provided:
- **Engagement context:** The engagement's current_state (your anchor to evolve), topic, pillar, status, and metadata
- **New email:** The email being routed to this engagement — your primary input
- **Existing participants:** People already linked to this engagement (do NOT re-extract)
- **Partner profile:** Brief overview of the partner company
- **Scratchpad notes:** Tribal knowledge from the PDM — relationship dynamics, internal observations, strategic context. Treat these as important background.
- **Meeting digests (if any):** Condensed summaries of meetings linked to this engagement. These represent face-to-face/call interactions that complement the email thread.

## topic Instructions

A 3-8 word description of what this engagement is about. Stable across emails — only changes if the engagement fundamentally pivots. Examples: "FedRAMP Certification", "Marketplace Listing Optimization", "Security Competency Technical Validation".

If the engagement already has a topic, return it EXACTLY as-is unless the engagement has fundamentally changed direction. Do not rephrase for stylistic variety.

## engagement_name Instructions

Compute as "{Partner Name} - {topic}". Must start with the partner name. Example: "CyberShield - Security Competency Technical Validation".

## current_state Instructions

You are given the engagement's existing current_state as an anchor. Your job is to EVOLVE it — not replace it.

**Decision Matrix — follow the FIRST matching scenario:**

| Scenario | Detection | Action |
|----------|-----------|--------|
| New engagement | current_state says "(none yet)" or is empty | Write a fresh 3-5 sentence briefing from the email content |
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

**Incorporate meeting context:** If meeting digests are provided, weave relevant meeting outcomes into the current_state alongside email activity. A decision made in a meeting is as important as one made in an email.

Return null if this is noise (shouldn't normally happen).

## condensed Instructions

Produce a condensed key facts digest alongside current_state. This digest is consumed by upstream AI calls (partner-level brain synthesis), NOT by humans. It must be structured and scannable.

**Format:**
Topic: [one line — what is this engagement about]
Status: [active/stalled/blocked/completing]
Last activity: [date and brief description]
Key developments:
- [Most important thing happening right now]
- [Second most important — if it exists]
- [Third — if it exists]
What's next: [the immediate next milestone or expected action]

**Rules:**
- Always the same structure. No prose paragraphs.
- 3 key developments maximum. Prioritize by importance, not recency.
- "What's next" is the single most anticipated next step — not a wish list.
- If the engagement is brand new with one email, keep it minimal (Topic + Status + one key development).

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

Do NOT include people already in the "Existing Participants" list — only extract NEW people from the NEW email.

## Importance Weighting

When writing current_state and condensed, apply these weighting rules:
- **Frequency:** Topics or people mentioned across multiple emails or meetings matter more than one-time mentions.
- **Recency:** Recent activity carries more weight, but do not drop persistent themes.
- **Author emphasis:** Respect language like "critical", "urgent", "important", "key", "blocker" — these are intentional signals from the humans involved.
- **Proportionality:** A person introduced once in a minor role does not deserve a sentence. Someone driving every interaction for months does.

## Pillar Inference

Classify the engagement's primary pillar based on ALL available context:

- **Co-Sell** — Revenue-focused: deals, pipeline, marketplace listings, customer introductions, GTM motions, account mapping
- **Co-Build** — Technical: integrations, certifications, competencies, technical validations, POCs, architecture reviews
- **Co-Market** — Awareness: events, content, webinars, campaigns, case studies, press releases, speaking slots

Return null if unclear. It is fine to not classify early-stage engagements.

## Response Format

Return ONLY valid JSON. No markdown code blocks, no preamble.

The content_type and engagement_match fields are provided in the "Routing Decision" section below. Return them as-is in your response — the routing has already been decided by the user.

{
  "content_type": "engagement_email" | "meeting_invite" | "mixed" | "noise",
  "engagement_match": {
    "id": "from routing decision",
    "name": "from routing decision (or compute as '{Partner} - {topic}' for new engagements)",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "from routing decision",
    "partner_id": "from routing decision"
  },
  "topic": "3-8 word description of engagement subject",
  "engagement_name": "{Partner Name} - {topic}",
  "current_state": "3-7 sentence point-in-time snapshot or null if noise",
  "condensed": "structured key facts digest (see condensed Instructions above)",
  "participants": [
    {
      "name": "full name",
      "email": "email or null",
      "organization": "company or null",
      "role": "forwarder | partner_contact | aws_stakeholder | executive | technical_contact | third_party"
    }
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
 * Build the engagement synthesis user message.
 * Lean model: engagement anchor + new email + lightweight context.
 * No full message history, no catalog data, no entity links.
 */
export function buildPhase2Context(opts: {
  newMessages: Message[];
  phase1Result: Phase1Result;
  history: {
    engagement: Engagement & { partner_name?: string | null };
    participants: (Participant & { role: string | null })[];
  } | null;
  matchedPartner: Partner | null;
  forwarderNote?: string | null;
  nameResolutionMap?: NameResolutionMap | null;
  newMeetings?: (Meeting & { partner_name?: string | null })[] | null;
  partnerContacts?: { name: string | null; email: string; title: string | null; org_type: string | null; role: string | null }[] | null;
  meetingContacts?: Map<string, { name: string | null; email: string }[]> | null;
  scratchpadEntries?: { content: string; created_at: string }[] | null;
  condensedMeetingDigests?: { title: string; meeting_date: string | null; condensed: string }[] | null;
}): string {
  const parts: string[] = [];

  // Section 0: Current date anchor
  const today = new Date().toISOString().split("T")[0];
  parts.push(`## Current Date\n${today}\n\nUse this as your temporal anchor. Do not speculate about future dates.\n`);

  // Section 1: Forwarder identity
  parts.push(buildForwarderSection(opts.forwarderNote));

  // Section 2: Routing decision (user-provided)
  parts.push(buildRoutingContext(opts.phase1Result));

  // Section 3: Engagement context + existing participants (existing engagements only)
  if (opts.history) {
    parts.push(buildEngagementContext(opts.history));
    parts.push(buildExistingParticipants(opts.history.participants));
  }

  // Section 4: New email(s)
  parts.push(buildNewEmailSection(opts.newMessages, opts.nameResolutionMap));

  // Section 5: Structured meeting data for ICS path
  if (opts.newMeetings && opts.newMeetings.length > 0) {
    parts.push(buildNewMeetingData(opts.newMeetings, opts.meetingContacts ?? null));
  }

  // Section 6: Matched partner
  parts.push(buildMatchedPartnerSection(opts.matchedPartner, opts.partnerContacts ?? null));

  // Section 7: Scratchpad (PDM tribal knowledge)
  if (opts.scratchpadEntries && opts.scratchpadEntries.length > 0) {
    parts.push(buildScratchpadSection(opts.scratchpadEntries));
  }

  // Section 8: Condensed meeting digests
  if (opts.condensedMeetingDigests && opts.condensedMeetingDigests.length > 0) {
    parts.push(buildCondensedDigestsSection(opts.condensedMeetingDigests));
  }

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

  // Backward compat: historical classification_result JSONB may contain these fields
  if (!parsed.matched_events) parsed.matched_events = [];
  if (!parsed.matched_programs) parsed.matched_programs = [];
  if (!parsed.matched_relationships) parsed.matched_relationships = [];
  if (!parsed.participants) parsed.participants = [];
  if (parsed.pillar === undefined) parsed.pillar = null;

  // Default new structured fields
  if (parsed.topic === undefined) parsed.topic = null;
  if (parsed.engagement_name === undefined) parsed.engagement_name = null;
  if (parsed.condensed === undefined) parsed.condensed = null;

  return parsed as CombinedClassificationResult;
}

// ============================================================
// Internal section builders
// ============================================================

function buildRoutingContext(phase1Result: Phase1Result): string {
  const em = phase1Result.engagement_match;
  const lines = [
    "## Routing Decision\n",
    `content_type: "${phase1Result.content_type}"`,
    `engagement_match: ${JSON.stringify(em)}`,
    "",
  ];
  return lines.join("\n");
}

function buildEngagementContext(history: {
  engagement: Engagement & { partner_name?: string | null };
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
  lines.push(`**Status:** ${eng.status}`);
  if (eng.pillar) lines.push(`**Pillar:** ${eng.pillar}`);
  lines.push(`**Created:** ${eng.created_at.split("T")[0]}`);
  lines.push(`**Last activity:** ${eng.updated_at.split("T")[0]}`);
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

    // Render attendees from registry
    const registryContacts = meetingContactsMap?.get(m.id);
    if (registryContacts && registryContacts.length > 0) {
      const formatted = registryContacts.map((c) =>
        c.name ? `${c.name} <${c.email}>` : c.email
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

    // Render attendees from registry
    const registryContacts = meetingContactsMap?.get(m.id);
    if (registryContacts && registryContacts.length > 0) {
      lines.push("**Attendees:**");
      for (const c of registryContacts) {
        const name = c.name ? `${c.name} ` : "";
        lines.push(`- ${name}<${c.email}>`);
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

  // Render key contacts from registry
  if (registryContacts && registryContacts.length > 0) {
    const keyContacts = registryContacts.slice(0, 4);
    const contactStrs = keyContacts.map((c) => {
      const namePart = c.name ?? "Unknown";
      const emailPart = ` <${c.email}>`;
      return `${namePart}${emailPart} (${c.role})`;
    });
    lines.push(`**Key Contacts:** ${contactStrs.join(", ")}`);
  }

  if (partner.what_they_do) lines.push(`**What they do:** ${partner.what_they_do}`);
  lines.push("");
  return lines.join("\n");
}

function buildScratchpadSection(
  entries: { content: string; created_at: string }[]
): string {
  if (entries.length === 0) return "";

  const lines = ["## Scratchpad Notes (PDM tribal knowledge)\n"];
  for (const entry of entries) {
    const date = entry.created_at.split("T")[0];
    lines.push(`- [${date}] ${entry.content}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildCondensedDigestsSection(
  digests: { title: string; meeting_date: string | null; condensed: string }[]
): string {
  if (digests.length === 0) return "";

  const lines = ["## Meeting Digests (linked to this engagement)\n"];
  for (const d of digests) {
    const date = d.meeting_date || "date unknown";
    lines.push(`### ${d.title} (${date})`);
    lines.push(d.condensed);
    lines.push("");
  }
  return lines.join("\n");
}
