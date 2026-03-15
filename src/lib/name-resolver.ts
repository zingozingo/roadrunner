import { getSupabaseClient } from "./db";

// ============================================================
// Name Resolution — email→name and domain→org lookups
// ============================================================
//
// Reads from the canonical participants registry. All contacts
// (from Airtable catalog sync, ICS parsing, and AI classification)
// are merged into participants by the contact registry sync layer.
// The registry already has the best data — priority was applied
// during upsert (catalog sources win over AI-extracted names).
//
// Personal email domains (gmail.com, outlook.com, etc.) are excluded
// from the domain→org map to avoid false positive org assignments.
// ============================================================

export interface ResolvedName {
  name: string;
  source: "participant" | "relationship" | "partner";
}

export interface NameResolutionMap {
  /** lowercase email → resolved name + source */
  emailToName: Map<string, ResolvedName>;
  /** lowercase domain → organization name */
  domainToOrg: Map<string, string>;
}

/** Domains that should never map to an organization */
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "yahoo.co.uk",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.net",
]);

/**
 * Build a resolution map from the canonical participants registry.
 * Single query replaces the old 3-source JSONB assembly — the registry
 * already has merged/prioritized data from all contact sources.
 */
export async function buildNameResolutionMap(): Promise<NameResolutionMap> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("participants")
    .select("email, name, organization, source");

  const emailToName = new Map<string, ResolvedName>();
  const domainToOrg = new Map<string, string>();

  if (error || !data) return { emailToName, domainToOrg };

  for (const row of data as { email: string | null; name: string | null; organization: string | null; source: string | null }[]) {
    if (!row.email) continue;
    const key = row.email.toLowerCase().trim();

    // email → name (with source derivation for backward compat)
    if (row.name && !emailToName.has(key)) {
      // Derive ResolvedName.source from participant.source column
      const resolvedSource: ResolvedName["source"] =
        row.source === "airtable_sync" ? "partner" : "participant";
      emailToName.set(key, { name: row.name, source: resolvedSource });
    }

    // domain → organization (first wins, skip personal domains)
    if (row.organization) {
      const domain = extractDomain(row.email);
      if (domain && !PERSONAL_DOMAINS.has(domain) && !domainToOrg.has(domain)) {
        domainToOrg.set(domain, row.organization);
      }
    }
  }

  return { emailToName, domainToOrg };
}

/**
 * Look up a resolved name by email address.
 * Returns the name and source, or null if not found.
 */
export function resolveNameByEmail(
  email: string,
  map: NameResolutionMap
): ResolvedName | null {
  if (!email) return null;
  return map.emailToName.get(email.toLowerCase().trim()) ?? null;
}

/**
 * Look up an organization name by email domain.
 * Returns the org name or null if not found / personal domain.
 */
export function resolveOrgByDomain(
  email: string,
  map: NameResolutionMap
): string | null {
  if (!email) return null;
  const domain = extractDomain(email);
  if (!domain) return null;
  return map.domainToOrg.get(domain) ?? null;
}

/** Extract lowercase domain from an email address */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.substring(at + 1).toLowerCase().trim();
}
