import { getPartnerContactDomains } from "./db";
import { getPartners } from "./db/partners";

/**
 * Check if a domain belongs to Amazon/AWS.
 * Pattern-based to catch all regional variants (amazon.ch, amazon.com.au, etc.)
 * and subdomains (*.amazonaws.com, *.aws.dev) automatically.
 */
export function isAWSDomain(domain: string): boolean {
  return (
    domain === "amazonaws.com" ||
    domain.startsWith("amazon.") ||
    domain.endsWith(".amazonaws.com") ||
    domain.endsWith(".aws.dev")
  );
}

/**
 * Extract all email addresses from a text string.
 * Handles: bare addresses, "Name <addr>" format, comma/semicolon-separated lists.
 */
export function extractEmailAddresses(text: string): string[] {
  if (!text) return [];
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex);
  return matches ? [...new Set(matches.map((e) => e.toLowerCase()))] : [];
}

/**
 * Detect which partner an inbound email belongs to by matching
 * non-AWS email domains against the partner contact registry.
 *
 * Priority: sender → to → cc → body (first match wins).
 */
export async function detectPartnerFromEmail(
  senderEmail: string,
  toHeader: string | null,
  ccHeader: string | null,
  bodyText: string | null
): Promise<{ partnerId: string; partnerName: string } | null> {
  // Collect emails in priority order: sender first, then to, cc, body
  const orderedSources = [senderEmail, toHeader, ccHeader, bodyText];
  const allEmails: string[] = [];
  for (const source of orderedSources) {
    if (source) {
      allEmails.push(...extractEmailAddresses(source));
    }
  }

  if (allEmails.length === 0) return null;

  const domainMap = await getPartnerContactDomains();

  for (const email of allEmails) {
    const domain = email.split("@")[1];
    if (!domain) continue;
    if (isAWSDomain(domain)) continue;

    const match = domainMap.get(domain);
    if (match) return match;
  }

  return null;
}

/**
 * Fallback: match partner names against the email subject line.
 * Only used when domain matching finds nothing (all-AWS or unknown-domain threads).
 * Longest match wins to prevent "Salt" matching before "Salt Security".
 */
export async function detectPartnerFromSubject(
  subject: string
): Promise<{ partnerId: string; partnerName: string } | null> {
  if (!subject) return null;

  const partners = await getPartners();
  const subjectLower = subject.toLowerCase();

  let best: { partnerId: string; partnerName: string } | null = null;
  let bestLength = 0;

  for (const partner of partners) {
    if (subjectLower.includes(partner.name.toLowerCase()) && partner.name.length > bestLength) {
      best = { partnerId: partner.id, partnerName: partner.name };
      bestLength = partner.name.length;
    }
  }

  return best;
}
