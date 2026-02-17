// ============================================================
// User identity configuration — single source of truth
// ============================================================

export interface UserConfig {
  name: string;
  email: string;
  aliases: string[];
  role: string;
  segment: string;
}

export const USER_CONFIG: UserConfig = {
  name: "Steven Romero",
  email: "sterme@amazon.com",
  aliases: ["sromero@amazon.com"],
  role: "Partner Development Manager (PDM)",
  segment: "AWS Security, ISV Partners",
};

/**
 * Strip Proofpoint PRVS wrapping from an email address.
 * Pattern: prvs=XXXXXX=real@email.com → real@email.com
 */
export function stripPRVS(email: string): string {
  const match = email.match(/^prvs=[^=]+=(.+)$/i);
  return match ? match[1] : email;
}

/**
 * Amazon SES rewrites From: headers with per-message tracking IDs.
 * Format: {message-id}@corpmail.amazon.com
 * These are all the same user (the PDM), just with different tracking IDs.
 */
export function isCorpmailAddress(email: string): boolean {
  return email.toLowerCase().endsWith("@corpmail.amazon.com");
}

/**
 * Check if an email address belongs to the configured user.
 * Handles: exact match, aliases, PRVS-wrapped, and SES corpmail addresses.
 */
export function isUserEmail(email: string): boolean {
  const cleaned = stripPRVS(email).toLowerCase();
  if (isCorpmailAddress(cleaned)) return true;
  const allEmails = [USER_CONFIG.email, ...USER_CONFIG.aliases].map((e) =>
    e.toLowerCase()
  );
  return allEmails.includes(cleaned);
}
