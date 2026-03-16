/**
 * Centralized contact display logic.
 *
 * Determines what label (role vs title vs org_type) to show for a contact,
 * sorts contacts by role priority, and suppresses raw classifier role values
 * that aren't meaningful to end users.
 */

/** Classifier-assigned roles that should never render in the UI */
export const CLASSIFIER_ROLES = new Set([
  "forwarder",
  "primary_contact",
  "technical_contact",
  "aws_stakeholder",
  "cc_recipient",
  "attendee",
  "organizer",
]);

/** AT-sourced roles sorted by display priority (lower = higher priority) */
export const ROLE_PRIORITY: ReadonlyMap<string, number> = new Map([
  ["Alliance Lead", 1],
  ["PSA", 2],
  ["Account Manager", 3],
  ["PMM", 4],
  ["Contact", 99],
]);

const DEFAULT_PRIORITY = 50;

const ORG_TYPE_LABELS: Record<string, string> = {
  internal: "AWS",
  partner: "Partner",
  third_party: "Third Party",
};

/**
 * Map raw org_type to a human-readable label.
 */
export function getDisplayOrgType(orgType: string | null): string {
  if (!orgType) return "Unknown";
  return ORG_TYPE_LABELS[orgType] ?? "Unknown";
}

/**
 * True if the role is a meaningful AT-sourced role worth displaying prominently.
 * False for classifier roles, "Contact", and null.
 */
export function isNamedRole(role: string | null): boolean {
  if (!role) return false;
  if (CLASSIFIER_ROLES.has(role)) return false;
  if (role === "Contact") return false;
  return true;
}

/**
 * Determine the best label for a contact.
 *
 * Priority:
 * 1. Named AT role (Alliance Lead, PSA, AM, PMM, etc.)
 * 2. Title from participants table (job title from Airtable catalog)
 * 3. Clean org_type label (AWS / Partner / Third Party)
 * 4. null (nothing available)
 */
export function getDisplayRole(
  role: string | null,
  title: string | null,
  orgType: string | null
): string | null {
  // Named AT role wins
  if (isNamedRole(role)) return role;

  // Fall back to title
  if (title) return title;

  // Fall back to org_type label
  if (orgType) return getDisplayOrgType(orgType);

  return null;
}

/**
 * Sort contacts by role priority.
 * Named AT roles sort by ROLE_PRIORITY, unknown roles get 50, "Contact" gets 99.
 */
export function sortContactsByRole<T extends { role: string | null }>(
  contacts: T[]
): T[] {
  return [...contacts].sort((a, b) => {
    const pa = a.role ? (ROLE_PRIORITY.get(a.role) ?? DEFAULT_PRIORITY) : DEFAULT_PRIORITY;
    const pb = b.role ? (ROLE_PRIORITY.get(b.role) ?? DEFAULT_PRIORITY) : DEFAULT_PRIORITY;
    return pa - pb;
  });
}
