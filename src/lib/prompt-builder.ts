import type {
  Engagement,
  Event,
  Program,
  Partner,
  AwsRelationship,
  Message,
} from "./types";
import { USER_CONFIG } from "./user-config";

// ============================================================
// Modular context builder for Claude classification prompt
// Each function returns a markdown section string.
// ============================================================

export function buildForwarderSection(forwarderNote?: string | null): string {
  const lines: string[] = [
    "## Forwarder Identity\n",
    "This email was forwarded to Relay by the PDM (Partner Development Manager):",
    `**Name:** ${USER_CONFIG.name}`,
    `**Email:** ${USER_CONFIG.email}`,
    `**Role:** ${USER_CONFIG.role}`,
    `**Segment:** ${USER_CONFIG.segment}`,
    "",
    `The forwarder is ALWAYS a participant with role "forwarder". Do NOT extract them from the email body — they are identified here.`,
  ];

  if (forwarderNote) {
    lines.push("");
    lines.push(`**Forwarder Note:** ${forwarderNote}`);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildEngagementsSection(engagements: Engagement[]): string {
  const lines: string[] = ["### Active Engagements"];

  if (engagements.length === 0) {
    lines.push("None yet.\n");
    return lines.join("\n");
  }

  for (const eng of engagements) {
    const parts = [`- **${eng.name}** (id: ${eng.id})`];
    if (eng.partner_name) parts.push(`Partner: ${eng.partner_name}`);
    if (eng.pillar) parts.push(`Pillar: ${eng.pillar}`);
    if (eng.tags.length > 0) parts.push(`Tags: ${eng.tags.join(", ")}`);

    let line = parts[0];
    if (parts.length > 1) {
      line += ` — ${parts.slice(1).join(" | ")}`;
    }
    if (eng.current_state) {
      line += `\n  Current state: ${eng.current_state}`;
    }
    // Show open items so Claude can avoid duplicates and auto-resolve completed ones
    if (eng.open_items && eng.open_items.length > 0) {
      line += `\n  Open items:`;
      for (const item of eng.open_items) {
        const assigneePart = item.assignee ? ` (${item.assignee})` : "";
        const duePart = item.due_date ? ` [due: ${item.due_date}]` : "";
        const resolvedPart = item.resolved ? " [RESOLVED]" : "";
        line += `\n    - ${item.description}${assigneePart}${duePart}${resolvedPart}`;
      }
    } else {
      line += `\n  Open items: none`;
    }
    lines.push(line);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildEventsSection(events: Event[]): string {
  const lines: string[] = ["### Tracked Events"];

  if (events.length === 0) {
    lines.push("None yet.\n");
    return lines.join("\n");
  }

  for (const evt of events) {
    const dateStr = evt.start_date
      ? `${evt.start_date}${evt.end_date ? ` to ${evt.end_date}` : ""}`
      : "date TBD";
    const hostStr = evt.host ? `, host: ${evt.host}` : "";
    let line = `- **${evt.name}** (id: ${evt.id}, type: ${evt.type}${hostStr}, ${dateStr})`;
    if (evt.description) line += ` — ${evt.description}`;
    lines.push(line);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildProgramsSection(programs: Program[]): string {
  const lines: string[] = ["### Active Programs"];

  if (programs.length === 0) {
    lines.push("None yet.\n");
    return lines.join("\n");
  }

  for (const prog of programs) {
    const typeStr = prog.type ? `, type: ${prog.type}` : "";
    let line = `- **${prog.name}** (id: ${prog.id}${typeStr})`;
    if (prog.description) line += ` — ${prog.description}`;
    if (prog.eligibility) line += ` [Eligibility: ${prog.eligibility}]`;
    lines.push(line);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildPartnersSection(partners: Partner[]): string {
  const lines: string[] = ["### Partner Catalog"];

  if (partners.length === 0) {
    lines.push("None yet.\n");
    return lines.join("\n");
  }

  for (const p of partners) {
    const parts = [`- **${p.name}** (id: ${p.id})`];
    if (p.category) parts.push(`Category: ${p.category}`);
    if (p.alliance_lead) parts.push(`Lead: ${p.alliance_lead}`);

    // Extract domains from partner contact emails for email↔partner matching
    if (p.partner_contact_emails && p.partner_contact_emails.length > 0) {
      const domains = [
        ...new Set(
          p.partner_contact_emails
            .map((e) => e.split("@")[1]?.toLowerCase())
            .filter(Boolean)
        ),
      ];
      if (domains.length > 0) parts.push(`Domains: ${domains.join(", ")}`);
    }

    let line = parts[0];
    if (parts.length > 1) {
      line += ` — ${parts.slice(1).join(" | ")}`;
    }
    lines.push(line);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildRelationshipsSection(
  relationships: AwsRelationship[]
): string {
  const lines: string[] = ["### AWS Relationships"];

  if (relationships.length === 0) {
    lines.push("None yet.\n");
    return lines.join("\n");
  }

  for (const r of relationships) {
    const parts = [`- **${r.name}** (id: ${r.id})`];
    if (r.relationship_type) parts.push(`Type: ${r.relationship_type}`);
    if (r.aws_org) parts.push(`Org: ${r.aws_org}`);
    if (r.aws_service) parts.push(`Service: ${r.aws_service}`);
    if (r.primary_contact_name)
      parts.push(`Contact: ${r.primary_contact_name}`);
    if (r.strength) parts.push(`Strength: ${r.strength}`);

    // Include contact emails so Claude can match email participants to relationships
    if (r.aws_contact_emails.length > 0) {
      parts.push(`Emails: ${r.aws_contact_emails.join(", ")}`);
    }

    let line = parts[0];
    if (parts.length > 1) {
      line += ` — ${parts.slice(1).join(" | ")}`;
    }
    lines.push(line);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildEmailSection(messages: Message[]): string {
  const lines: string[] = ["---\n\n## Email to Classify\n"];

  for (const msg of messages) {
    if (messages.length > 1) {
      lines.push(
        `### Message from ${msg.sender_name || msg.sender_email || "Unknown"}`
      );
    }
    if (msg.sender_email)
      lines.push(`**From:** ${msg.sender_name || ""} <${msg.sender_email}>`);
    if (msg.to_header) lines.push(`**To:** ${msg.to_header}`);
    if (msg.cc_header) lines.push(`**CC:** ${msg.cc_header}`);
    if (msg.subject) lines.push(`**Subject:** ${msg.subject}`);
    if (msg.sent_at) lines.push(`**Date:** ${msg.sent_at}`);
    lines.push(`\n${msg.body_text || msg.body_raw || "(empty body)"}\n`);
  }

  return lines.join("\n");
}
