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
 * Check if an email address belongs to the configured user.
 * Matches against primary email and all aliases, case-insensitive.
 * Also handles PRVS-wrapped variants.
 */
export function isUserEmail(email: string): boolean {
  const cleaned = stripPRVS(email).toLowerCase();
  const allEmails = [USER_CONFIG.email, ...USER_CONFIG.aliases].map((e) =>
    e.toLowerCase()
  );
  return allEmails.includes(cleaned);
}
