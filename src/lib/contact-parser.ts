/**
 * Parse and render the unified contact format: "Name <email> (Title)"
 *
 * Conventions:
 *   - <—> means no email (em-dash placeholder from Airtable)
 *   - (—) means no title
 *   - Missing angle brackets / parens means that field is absent
 */

import type { Contact, RoleContact } from "./types";

const EM_DASH = "—";

/**
 * Parse a single contact string: "Name <email> (Title)"
 * Handles missing parts gracefully.
 */
export function parseContact(raw: string): Contact {
  const trimmed = raw.trim();
  if (!trimmed) return { name: null, email: null, title: null };

  let remaining = trimmed;
  let email: string | null = null;
  let title: string | null = null;

  // Extract (Title) from the end
  const titleMatch = remaining.match(/\(([^)]*)\)\s*$/);
  if (titleMatch) {
    const rawTitle = titleMatch[1].trim();
    title = rawTitle === EM_DASH || rawTitle === "" ? null : rawTitle;
    remaining = remaining.slice(0, titleMatch.index!).trim();
  }

  // Extract <email>
  const emailMatch = remaining.match(/<([^>]*)>/);
  if (emailMatch) {
    const rawEmail = emailMatch[1].trim();
    email = rawEmail === EM_DASH || rawEmail === "" ? null : rawEmail;
    remaining = remaining.slice(0, emailMatch.index!).trim();
  }

  const name = remaining || null;

  return { name, email, title };
}

/**
 * Parse a contact string and attach a role.
 */
export function parseRoleContact(raw: string, role: string): RoleContact {
  return { ...parseContact(raw), role };
}

/**
 * Parse a newline-separated list of contacts, each with the same role.
 */
export function parseContactList(raw: string, role: string): RoleContact[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[\n;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseRoleContact(line, role));
}

/**
 * Render a Contact back to "Name <email> (Title)" format.
 * Uses <—> and (—) as placeholders for missing fields.
 */
export function renderContact(c: Contact): string {
  const parts: string[] = [];
  if (c.name) parts.push(c.name);
  parts.push(`<${c.email ?? EM_DASH}>`);
  parts.push(`(${c.title ?? EM_DASH})`);
  return parts.join(" ");
}

/**
 * Render a list of contacts as newline-separated strings.
 */
export function renderContactList(cs: RoleContact[]): string {
  return cs.map(renderContact).join("\n");
}
