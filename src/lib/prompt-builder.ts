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
