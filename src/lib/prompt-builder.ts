import type {
  Event,
  Program,
  Relationship,
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

  // Tier 1: Structurally unique programs (full detail)
  const competencies = programs.filter(p => p.type === "Competency");
  const serviceReady = programs.filter(p => p.type === "Service Ready");
  const detailed = programs.filter(p => p.type !== "Competency" && p.type !== "Service Ready");

  if (detailed.length > 0) {
    for (const prog of detailed) {
      const typeStr = prog.type ? `, type: ${prog.type}` : "";
      let line = `- **${prog.name}** (id: ${prog.id}${typeStr})`;
      if (prog.description) line += ` — ${prog.description}`;
      if (prog.requirements) line += ` [Requirements: ${prog.requirements}]`;
      lines.push(line);
    }
  }

  // Tier 2: Competencies as compact list with shared description
  if (competencies.length > 0) {
    lines.push("");
    lines.push(`**Competencies** (${competencies.length} total) — All follow the same process: rolling 12-month renewal requiring launched ACE opportunities tied to Specialization Solutions. Each earns $10K MDF (not SCA stackable), a competency badge, co-marketing eligibility, and enhanced ISV Accelerate benefits. Exception: AI Competency earns $50K MDF (SCA stackable).`);
    const compactList = competencies.map(c => `"${c.name}" (id: ${c.id})`).join(", ");
    lines.push(compactList);
  }

  // Tier 3: Service Ready as compact list with shared description
  if (serviceReady.length > 0) {
    lines.push("");
    lines.push(`**Service Ready Designations** (${serviceReady.length} total) — AWS service-level technical validations. Rolling 12-month renewal. Each earns $5K MDF (not SCA stackable), Service Ready badge, and co-marketing with the relevant AWS service team.`);
    const compactList = serviceReady.map(s => `"${s.name}" (id: ${s.id})`).join(", ");
    lines.push(compactList);
  }

  lines.push("");
  return lines.join("\n");
}

export function buildRelationshipsSection(
  relationships: Relationship[]
): string {
  const lines: string[] = ["### AWS Relationships"];

  if (relationships.length === 0) {
    lines.push("None yet.\n");
    return lines.join("\n");
  }

  for (const r of relationships) {
    const parts = [`- **${r.name}** (id: ${r.id})`];
    if (r.relationship_type) parts.push(`Type: ${r.relationship_type}`);
    if (r.org) parts.push(`Org: ${r.org}`);
    if (r.service) parts.push(`Service: ${r.service}`);
    // Render contacts from JSONB: "Name <email> (Role)"
    const contacts = r.contacts ?? [];
    if (contacts.length > 0) {
      const contactStrs = contacts.map((c) => {
        const namePart = c.name ?? "";
        const emailPart = c.email ? ` <${c.email}>` : "";
        const rolePart = c.role ? ` (${c.role})` : "";
        return `${namePart}${emailPart}${rolePart}`.trim();
      });
      parts.push(`Contacts: ${contactStrs.join(", ")}`);
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
