import { getSupabaseClient } from "./db";
import type { Participant, RoleContact } from "./types";

// ============================================================
// Name Resolution — email→name and domain→org lookups
// ============================================================
//
// Priority chain (first write wins — earlier sources can't be overwritten):
//
//   1. relationships.contacts JSONB — Human-curated in Airtable.
//      Lead contacts with verified name+email pairs. Highest trust.
//   2. partners.aws_team JSONB — Human-curated AWS-side contacts (PSA, AM, PMM).
//   3. partners.partner_contacts JSONB — Human-curated partner-side contacts
//      (Alliance Lead, general contacts). Domain→org mapping built here.
//   4. participants — AI-extracted by Claude from classified emails.
//      Fills gaps for tertiary contacts the system learns organically.
//      Lowest priority because AI extraction can produce noisy names.
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
 * Build a resolution map by querying relationships, partners, and
 * participants tables in parallel. Merge order determines priority —
 * first write wins, so catalog sources (human-curated) take precedence
 * over AI-extracted participant names.
 */
export async function buildNameResolutionMap(): Promise<NameResolutionMap> {
  const db = getSupabaseClient();

  const [relationshipsResult, partnersResult, participantsResult] =
    await Promise.all([
      db.from("relationships").select("contacts"),
      db.from("partners").select("name, aws_team, partner_contacts"),
      db.from("participants").select("email, name"),
    ]);

  const emailToName = new Map<string, ResolvedName>();
  const domainToOrg = new Map<string, string>();

  // --- Priority 1: Relationships contacts JSONB ---
  for (const row of (relationshipsResult.data ?? []) as { contacts: RoleContact[] }[]) {
    const contacts = row.contacts ?? [];
    for (const c of contacts) {
      if (c.email && c.name) {
        const key = c.email.toLowerCase().trim();
        if (!emailToName.has(key)) {
          emailToName.set(key, { name: c.name, source: "relationship" });
        }
      }
    }
  }

  // --- Priority 2 & 3: Partners aws_team + partner_contacts JSONB ---
  for (const row of (partnersResult.data ?? []) as {
    name: string;
    aws_team: RoleContact[];
    partner_contacts: RoleContact[];
  }[]) {
    // aws_team contacts (PSA, AM, PMM) — source: "partner"
    for (const c of row.aws_team ?? []) {
      if (c.email && c.name) {
        const key = c.email.toLowerCase().trim();
        if (!emailToName.has(key)) {
          emailToName.set(key, { name: c.name, source: "partner" });
        }
      }
      // aws_team emails contribute to domain→org map
      if (c.email) {
        const domain = extractDomain(c.email);
        if (domain && !PERSONAL_DOMAINS.has(domain) && !domainToOrg.has(domain)) {
          domainToOrg.set(domain, row.name);
        }
      }
    }

    // partner_contacts (Alliance Lead, general contacts) — source: "partner"
    for (const c of row.partner_contacts ?? []) {
      if (c.email && c.name) {
        const key = c.email.toLowerCase().trim();
        if (!emailToName.has(key)) {
          emailToName.set(key, { name: c.name, source: "partner" });
        }
      }
      // partner_contacts email domains → partner org
      if (c.email) {
        const domain = extractDomain(c.email);
        if (domain && !PERSONAL_DOMAINS.has(domain) && !domainToOrg.has(domain)) {
          domainToOrg.set(domain, row.name);
        }
      }
    }
  }

  // --- Priority 4: Participants (AI-extracted, fills gaps) ---
  for (const row of (participantsResult.data ?? []) as Pick<Participant, "email" | "name">[]) {
    if (!row.email || !row.name) continue;
    const key = row.email.toLowerCase().trim();
    if (!emailToName.has(key)) {
      emailToName.set(key, { name: row.name, source: "participant" });
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
