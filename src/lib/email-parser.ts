import { ParsedMessage } from "./types";

/**
 * Patterns that mark the start of a forwarded message block in Outlook-style forwards.
 *
 * Outlook forwards typically look like:
 *   ________________________________
 *   From: Jane Smith <jane@example.com>
 *   Sent: Monday, February 3, 2025 10:30 AM
 *   To: Bob Lee <bob@partner.com>
 *   Cc: Dana Wright <dana@aws.example.com>     ← optional
 *   Subject: Re: Security Review
 *
 *   [body text]
 *
 * Some variations use "Date:" instead of "Sent:", or skip the separator line.
 * The CC line is optional — when present it appears between To and Subject.
 *
 * Capture groups: 1=From, 2=Sent, 3=To, 4=Cc (optional), 5=Subject
 *
 * NOTE: Multi-line To/CC wrapping is not handled yet — future enhancement.
 */
const FORWARDED_BLOCK_RE =
  /(?:^|\n)(?:_{3,}|-{3,}|\*{3,})?\s*\n?From:\s+(.+)\nSent:\s+(.+)\nTo:\s+(.+)\n(?:Cc:\s+(.+)\n)?Subject:\s+(.+)\n/gi;

/**
 * Alternative header pattern — some clients use "Date:" instead of "Sent:"
 * Capture groups: 1=From, 2=Date, 3=To, 4=Cc (optional), 5=Subject
 */
const ALT_BLOCK_RE =
  /(?:^|\n)(?:_{3,}|-{3,}|\*{3,})?\s*\n?From:\s+(.+)\nDate:\s+(.+)\nTo:\s+(.+)\n(?:Cc:\s+(.+)\n)?Subject:\s+(.+)\n/gi;

/**
 * Patterns to strip from message bodies — signatures, disclaimers, device tags.
 */
const NOISE_PATTERNS = [
  // "Sent from" device signatures
  /\n-{0,2}\s*Sent from (?:my )?(?:iPhone|iPad|Galaxy|Android|Outlook|Mail).*/gi,
  // "Get Outlook for" footers
  /\nGet Outlook for .*/gi,
  // Common confidentiality disclaimers (multi-line, greedy to end)
  /\n-{2,}\s*\nThis (?:email|message|communication) (?:and any attachments )?(?:is|are) (?:intended |confidential)[\s\S]{0,500}$/gi,
  // CONFIDENTIALITY NOTICE blocks
  /\nCONFIDENTIALITY NOTICE[\s\S]{0,500}$/gi,
  // Trailing Outlook separator lines with nothing after
  /\n_{20,}\s*$/g,
  // AWS/corporate gateway banners — single-line fallback (multi-line handled by stripGatewayBanners)
  /(?:^|\n)(?:CAUTION|WARNING|ALERT|NOTICE):\s*(?:This (?:email|message) (?:originated|was sent) from outside)[^\n]*/gi,
  // Standard email signature delimiter (RFC 3676): "--" or "-- " on own line
  /\n--[ ]?\n[\s\S]*$/g,
];

/** Words that indicate a company name (don't flip comma-inverted names containing these) */
const COMPANY_SUFFIXES = /\b(inc|llc|ltd|corp|co|company|group|gmbh|plc|sa|ag)\b/i;

/**
 * Flip "Last, First" → "First Last" for comma-inverted personal names.
 * Skips company names like "ACME, Inc." by checking for corporate suffixes.
 */
function flipCommaInvertedName(name: string): string {
  const commaIdx = name.indexOf(",");
  if (commaIdx === -1) return name;

  const before = name.slice(0, commaIdx).trim();
  const after = name.slice(commaIdx + 1).trim();

  // Skip if it looks like a company: "ACME, Inc."
  if (COMPANY_SUFFIXES.test(after) || COMPANY_SUFFIXES.test(before)) return name;

  // Only flip if the part after comma is 1-3 words (a first/middle name)
  const afterWords = after.split(/\s+/).filter(Boolean);
  if (afterWords.length >= 1 && afterWords.length <= 3) {
    return `${after} ${before}`;
  }

  return name;
}

/**
 * Parse a "Name <email>" string into its parts.
 *
 * Handles Outlook's rich-text mailto double-bracket format:
 *   "Name <email<mailto:email>>" → { senderName: "Name", senderEmail: "email" }
 */
export function parseSenderField(raw: string): {
  senderName: string | null;
  senderEmail: string | null;
} {
  // Normalize: strip <mailto:...> artifacts, collapse doubled brackets
  let normalized = raw.replace(/<mailto:[^>]*>/g, "");
  normalized = normalized.replace(/>>/g, ">").replace(/<</g, "<").trim();

  const match = normalized.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    // Strip RFC 5322 quoted display names: "Steven Romero" → Steven Romero
    const name = match[1].trim().replace(/^["']+|["']+$/g, "").trim();
    const email = match[2].trim();
    // If the "name" contains @ or equals the email, treat as no-name
    if (name.includes("@") || name.toLowerCase() === email.toLowerCase()) {
      return { senderName: null, senderEmail: email };
    }
    // Alias detection: name equals the email local part AND looks like a
    // corporate alias (8+ chars, typically first-name + truncated-last-name
    // concatenations like "crisresl", "mjinglis"). Short names (Carlos, Dana)
    // are likely real first names and should be preserved.
    const localPart = email.split("@")[0];
    if (
      localPart &&
      name.toLowerCase().trim() === localPart.toLowerCase() &&
      name.trim().length >= 8
    ) {
      return { senderName: null, senderEmail: email };
    }
    // Message-ID rejection: long hex/dash/dot/underscore strings aren't real names
    if (/^[0-9a-f\-_.]{15,}$/i.test(name.trim())) {
      return { senderName: null, senderEmail: email };
    }
    return { senderName: flipCommaInvertedName(name), senderEmail: email };
  }

  // Regex failed — try to extract email from last <...> pair
  const bracketMatch = normalized.match(/<([^>]+@[^>]+)>/);
  if (bracketMatch) {
    return { senderName: null, senderEmail: bracketMatch[1].trim() };
  }

  // Bare email address
  if (normalized.includes("@")) {
    return { senderName: null, senderEmail: normalized };
  }
  return { senderName: normalized, senderEmail: null };
}

/**
 * Attempt to parse a date string into an ISO timestamp.
 * Outlook uses formats like "Monday, February 3, 2025 10:30 AM" or
 * "2/3/2025 10:30:32 AM" or "3 Feb 2025 10:30".
 */
function parseDate(raw: string): string | null {
  const cleaned = raw.trim();
  // Strip leading day name ("Monday, " etc.)
  let withoutDay = cleaned.replace(/^[A-Za-z]+,\s*/, "");
  // Strip Gmail-style "at" between date and time ("Feb 3, 2025 at 10:30 AM" → "Feb 3, 2025 10:30 AM")
  withoutDay = withoutDay.replace(/\s+at\s+/i, " ");
  const date = new Date(withoutDay);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  // Try the original string as-is
  const fallback = new Date(cleaned);
  if (!isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }
  return null;
}

/**
 * Strip signature/noise from a message body.
 */
function stripNoise(body: string): string {
  let cleaned = body;
  for (const pattern of NOISE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

/**
 * Strip multi-line gateway security banners from the top of messages.
 *
 * Corporate email gateways (Proofpoint, Mimecast, Barracuda, etc.) inject
 * banners like:
 *   CAUTION: This email originated from outside of the organization.
 *   Do not click links or open attachments unless you recognize the sender
 *   and know the content is safe.
 *
 * Strategy: match known banner openers and consume all continuation lines
 * until a blank line or known email header pattern (From:, Sent:, etc.).
 * This is a top-down approach — banners are always injected at the start.
 */
function stripGatewayBanners(text: string): string {
  // Multi-line CAUTION/WARNING/EXTERNAL banners: opener + continuation lines up to blank line
  const bannerRe = /^(?:CAUTION|WARNING|ALERT|NOTICE):\s*(?:This (?:email|message) (?:originated|was sent) from outside)[^\n]*(?:\n(?![ \t]*$|\n|From:\s|Sent:\s|Date:\s|To:\s|Subject:\s|On .+ wrote:)[^\n]*)*/gim;
  let cleaned = text.replace(bannerRe, "");

  // [EXTERNAL] / [EXT] banner lines at the top of message body
  cleaned = cleaned.replace(/^\s*\[(?:EXTERNAL|EXT)(?:\s+EMAIL)?\][^\n]*(?:\n(?![ \t]*$|\n)[^\n]*)*/gim, "");

  // Clean up leading blank lines left behind
  cleaned = cleaned.replace(/^\n+/, "");

  return cleaned;
}

/**
 * Additional artifact patterns for deep body cleaning.
 * Applied after stripNoise() in cleanMessageBody().
 */
const ARTIFACT_PATTERNS = [
  // Exclaimer/Mimecast tracking URLs
  /https?:\/\/protect[-\w]*\.mimecast\.com\/\S+/gi,
  // Exclaimer content URLs
  /https?:\/\/[\w.-]*exclaimer[\w.-]*\/\S+/gi,
  // Image placeholders: [image001.png], [image:xxx], [cid:xxx]
  /\[image\d*\.\w+\]/gi,
  /\[cid:[^\]]+\]/gi,
  // Markdown-style link artifacts from HTML→text conversion: [url]<url> or [url](url)
  // Catches Zoom branding, tracking pixels, and similar HTML→plaintext artifacts
  /\[https?:\/\/\S+\]\s*[<(]https?:\/\/\S+[>)]/gi,
  // Zoom branding/account URLs (standalone lines)
  /^\s*https?:\/\/[\w.-]*zoom\.us\/account\/\S*\s*$/gim,
  // Unsubscribe footers
  /\n(?:To (?:stop receiving|unsubscribe)|If you no longer wish to receive|Click here to unsubscribe)[^\n]*/gi,
];

/**
 * Deep body cleaning — wraps stripNoise() and adds artifact stripping
 * and bottom-up signature detection.
 *
 * Idempotent: running twice produces the same result.
 *
 * @param skipSignatureStrip - Skip bottom-up signature detection (for short replies)
 */
export function cleanMessageBody(
  text: string,
  options?: { skipSignatureStrip?: boolean }
): string {
  // Step 0: Strip multi-line gateway banners (top-down, before noise patterns)
  let cleaned = stripGatewayBanners(text);

  // Step 1: Run existing noise patterns (broad removals)
  cleaned = stripNoise(cleaned);

  // Step 2: Strip tracking URLs, image placeholders, unsubscribe footers
  for (const pattern of ARTIFACT_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }

  // Step 3: Strip blocks of 3+ consecutive URL-only lines (HTML→text artifacts)
  cleaned = stripConsecutiveUrlLines(cleaned);

  // Step 4: Bottom-up signature detection (conservative — 3+ consecutive matches)
  if (!options?.skipSignatureStrip) {
    cleaned = stripBottomSignature(cleaned);
  }

  return cleaned.trim();
}

/**
 * Strip blocks of 3+ consecutive lines that are only URLs.
 * These are typically artifacts from HTML→plaintext conversion.
 */
function stripConsecutiveUrlLines(text: string): string {
  const lines = text.split("\n");
  const urlOnly = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i;

  // Find runs of consecutive URL-only lines
  let i = 0;
  const result: string[] = [];
  while (i < lines.length) {
    let runLength = 0;
    let j = i;
    while (j < lines.length && urlOnly.test(lines[j])) {
      runLength++;
      j++;
    }
    if (runLength >= 3) {
      // Skip this block entirely
      i = j;
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result.join("\n");
}

/**
 * Bottom-up signature detection: scan from the last line upward.
 * If 3+ consecutive lines at the bottom match SIGNATURE_LINE_PATTERNS,
 * strip them all. Stops at the first substantive non-matching line.
 */
function stripBottomSignature(text: string): string {
  const lines = text.split("\n");

  // Find the last substantive line index
  let lastSubstantive = lines.length - 1;
  while (lastSubstantive >= 0 && lines[lastSubstantive].trim().length === 0) {
    lastSubstantive--;
  }
  if (lastSubstantive < 0) return text;

  // Scan upward from the bottom, counting consecutive signature-like lines
  let sigCount = 0;
  let scanIdx = lastSubstantive;

  while (scanIdx >= 0) {
    const trimmed = lines[scanIdx].trim();
    if (trimmed.length === 0) {
      // Blank lines within a signature block don't break the streak
      scanIdx--;
      continue;
    }
    if (SIGNATURE_LINE_PATTERNS.some((pat) => pat.test(trimmed))) {
      sigCount++;
      scanIdx--;
    } else {
      // Hit a non-signature, substantive line — stop scanning
      break;
    }
  }

  // Only strip if 3+ signature-like lines found at the bottom
  if (sigCount >= 3) {
    // scanIdx is now the last non-signature line (or -1 if all lines are signature)
    const kept = lines.slice(0, scanIdx + 1);
    // Also trim trailing blank lines from the kept portion
    while (kept.length > 0 && kept[kept.length - 1].trim().length === 0) {
      kept.pop();
    }
    return kept.join("\n");
  }

  return text;
}

interface HeaderMatch {
  index: number;
  fullMatchEnd: number;
  senderRaw: string;
  sentRaw: string;
  toRaw: string;
  ccRaw: string | null;
  subject: string;
}

/**
 * Find all forwarded message header blocks in the text.
 */
function findHeaderBlocks(text: string): HeaderMatch[] {
  const matches: HeaderMatch[] = [];
  const seen = new Set<number>();

  for (const regex of [FORWARDED_BLOCK_RE, ALT_BLOCK_RE]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Dedupe by start index
      if (seen.has(match.index)) continue;
      seen.add(match.index);

      matches.push({
        index: match.index,
        fullMatchEnd: match.index + match[0].length,
        senderRaw: match[1].trim(),
        sentRaw: match[2].trim(),
        toRaw: match[3].trim(),
        ccRaw: match[4]?.trim() ?? null,
        subject: match[5].trim(),
      });
    }
  }

  // Sort by position in the text
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

interface GmailQuoteMatch {
  index: number;        // position of "On " in text
  fullMatchEnd: number; // position after "wrote:\n"
  senderName: string | null;
  senderEmail: string | null;
  dateRaw: string | null;
}

/**
 * Find all Gmail/Apple Mail-style quote markers ("On ... wrote:") in the text.
 *
 * Handles two patterns:
 * - Single-line: "On Mon, Feb 3, 2025 at 10:30 AM Alice <alice@co.com> wrote:"
 * - Two-line (wrapped): "On Mon, Feb 3, 2025 at 10:30 AM\n  <alice@co.com> wrote:"
 * - Apple Mail: "On Dec 10, 2025, at 7:02 PM, Name <email> wrote:"
 */
export function findGmailQuoteMarkers(text: string): GmailQuoteMatch[] {
  const matches: GmailQuoteMatch[] = [];
  const seen = new Set<number>();

  // Single-line: "On ... wrote:" followed by newline
  const singleLineRe = /(?:^|\n)(On .+wrote:)[ \t]*\n/gm;
  // Two-line (wrapped): "On ...\n  <email> wrote:" followed by newline
  const twoLineRe = /(?:^|\n)(On .+\n[ \t]*<[^>]+>\s*wrote:)[ \t]*\n/gm;

  for (const regex of [singleLineRe, twoLineRe]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      // The actual "On " starts after the optional \n prefix
      const markerStart = match[0].startsWith("\n")
        ? match.index + 1
        : match.index;

      if (seen.has(markerStart)) continue;
      seen.add(markerStart);

      const fullMatchEnd = match.index + match[0].length;
      const onText = match[1];

      // Extract email: last <...@...> in the matched text
      let senderEmail: string | null = null;
      let senderName: string | null = null;
      let dateRaw: string | null = null;

      const emailMatches = [...onText.matchAll(/<([^>]+@[^>]+)>/g)];
      if (emailMatches.length > 0) {
        senderEmail = emailMatches[emailMatches.length - 1][1];

        // Extract the portion after "On " and before the <email>
        const lastEmailMatch = emailMatches[emailMatches.length - 1];
        const beforeEmail = onText.slice(3, lastEmailMatch.index).trim();

        // Name: extract trailing alphabetic words before <email>.
        // "Mon, Feb 3, 2025 at 10:30 AM Alice Chen" → "Alice Chen"
        // "Dec 10, 2025, at 7:02 PM, Jane Smith" → "Jane Smith"
        // "Mon, Jan 5, 2025 at 3:45 PM John" → "John" (single-word names)
        const nameMatch = beforeEmail.match(/(?:^|[,\s])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/);
        if (nameMatch) {
          senderName = nameMatch[1].trim();
          // Date: everything before the name
          const nameStart = beforeEmail.lastIndexOf(nameMatch[1]);
          dateRaw = beforeEmail.slice(0, nameStart).trim().replace(/,\s*$/, "") || null;
        } else {
          // No name found — entire beforeEmail is the date
          dateRaw = beforeEmail.replace(/,\s*$/, "") || null;
        }
      } else {
        // No email in angle brackets — try to extract name before "wrote:"
        const wroteIdx = onText.lastIndexOf(" wrote:");
        if (wroteIdx > 3) {
          const afterOn = onText.slice(3, wroteIdx).trim();
          // Try to find trailing name (capitalized words, 1+ words)
          const nameMatch = afterOn.match(/(?:^|[,\s])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/);
          if (nameMatch) {
            senderName = nameMatch[1].trim();
            const nameStart = afterOn.lastIndexOf(nameMatch[1]);
            dateRaw = afterOn.slice(0, nameStart).trim().replace(/,\s*$/, "") || null;
          } else {
            dateRaw = afterOn || null;
          }
        }
      }

      matches.push({
        index: markerStart,
        fullMatchEnd,
        senderName,
        senderEmail,
        dateRaw,
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/**
 * Generic separator patterns that indicate a quoted/forwarded message boundary.
 * These lack structured sender metadata but still indicate a message split point.
 */
const GENERIC_SEPARATOR_RE =
  /\n(----+\s*Original Message\s*----+|_{20,})\s*\n/gi;

/**
 * Recursively split a single parsed message's body on Gmail quote markers
 * and generic separators. Returns an array of 1+ messages.
 *
 * Pass 2 of the two-pass architecture: runs AFTER primary Outlook/Gmail split.
 * Each message from Pass 1 is checked for internal quoting that wasn't caught
 * by the top-level split.
 *
 * @param depth Current recursion depth (max 5)
 */
function splitQuotedReplies(msg: ParsedMessage, depth = 0): ParsedMessage[] {
  if (depth >= 5) return [msg];

  const body = msg.body_raw || msg.body_text;
  if (!body || body.trim().length === 0) return [msg];

  // Try Gmail/Apple Mail markers first (richer metadata)
  const markers = findGmailQuoteMarkers(body);
  if (markers.length > 0) {
    const firstMarker = markers[0];

    // Text above the quote marker = this message's actual content
    const parentBodyRaw = body.slice(0, firstMarker.index);
    const parentBodyText = stripNoise(parentBodyRaw).trim();

    // Text below the quote marker = the quoted reply's content.
    // If there are multiple markers at this level, the content between
    // marker[0] end and marker[1] start is the first quoted reply,
    // and subsequent markers are deeper quotes within that reply.
    // We take everything after the first marker and let recursion handle the rest.
    const childBodyRaw = body.slice(firstMarker.fullMatchEnd);

    const results: ParsedMessage[] = [];

    // Parent message (only if it has real content)
    if (parentBodyText.length > 0) {
      results.push({
        ...msg,
        body_text: parentBodyText,
        body_raw: parentBodyRaw.trim(),
      });
    }

    // Child message from the quote marker
    const childMsg: ParsedMessage = {
      sender_name: firstMarker.senderName,
      sender_email: firstMarker.senderEmail,
      sent_at: firstMarker.dateRaw ? parseDate(firstMarker.dateRaw) : null,
      subject: msg.subject,
      body_text: stripNoise(childBodyRaw),
      body_raw: childBodyRaw.trim(),
    };

    // Recursively split the child (it may contain deeper quotes)
    results.push(...splitQuotedReplies(childMsg, depth + 1));

    return results;
  }

  // Try generic separators (no sender metadata)
  GENERIC_SEPARATOR_RE.lastIndex = 0;
  const sepMatch = GENERIC_SEPARATOR_RE.exec(body);
  if (sepMatch) {
    const parentBodyRaw = body.slice(0, sepMatch.index);
    const parentBodyText = stripNoise(parentBodyRaw).trim();
    const childBodyRaw = body.slice(sepMatch.index + sepMatch[0].length);

    const results: ParsedMessage[] = [];

    if (parentBodyText.length > 0) {
      results.push({
        ...msg,
        body_text: parentBodyText,
        body_raw: parentBodyRaw.trim(),
      });
    }

    // Child inherits parent metadata (no structured header to extract from)
    const childMsg: ParsedMessage = {
      sender_name: null,
      sender_email: null,
      sent_at: null,
      subject: msg.subject,
      body_text: stripNoise(childBodyRaw),
      body_raw: childBodyRaw.trim(),
    };

    if (childMsg.body_text.trim().length > 0) {
      results.push(...splitQuotedReplies(childMsg, depth + 1));
    }

    return results.length > 0 ? results : [msg];
  }

  // No internal quotes — return as-is (ensure noise is stripped)
  return [{
    ...msg,
    body_text: stripNoise(msg.body_raw || msg.body_text),
  }];
}

/**
 * Sort messages chronologically by sent_at (oldest first).
 * Messages without dates maintain their relative extraction order at the end.
 */
function sortChronologically(messages: ParsedMessage[]): ParsedMessage[] {
  const withDate: ParsedMessage[] = [];
  const withoutDate: ParsedMessage[] = [];

  for (const msg of messages) {
    if (msg.sent_at) {
      withDate.push(msg);
    } else {
      withoutDate.push(msg);
    }
  }

  withDate.sort((a, b) => {
    const ta = new Date(a.sent_at!).getTime();
    const tb = new Date(b.sent_at!).getTime();
    return ta - tb;
  });

  return [...withDate, ...withoutDate];
}

/**
 * Patterns for individual signature lines in a forwarder preface.
 * Applied line-by-line to strip corporate signature blocks while preserving
 * intentional notes like "FYI — please review this thread".
 */
const SIGNATURE_LINE_PATTERNS = [
  /^[\s_\-=*]+$/,                                  // separator lines (underscores, dashes, etc.)
  // Pipe-separated identity lines: capitalized words before |
  // Matches: "Steven Romero | Growth PDM", "Partner Development Manager | AWS"
  // Does NOT match: "Please review this | it's urgent" (lowercase "review")
  /^(?:[A-Z][a-zA-Z.']+)(?:\s+[A-Z][a-zA-Z.']+){0,5}\s*\|.*$/,
  // Title/company/name lines: 1-7 capitalized words with optional connectors
  // Matches: "Steven Romero", "Partner Development Manager", "Amazon Web Services",
  //          "Head of Channel & Alliances", "Sr. Solutions Architect"
  // Does NOT match sentences: "Please review and follow up" (lowercase "review" after "Please")
  /^(?:[A-Z][a-zA-Z.']+)(?:\s+(?:[A-Z][a-zA-Z.']+|of|for|and|&|the)){0,6}\s*$/,
  /^\s*Sent from .+$/i,                            // mobile signatures
  /^\s*Get Outlook for .+$/i,                      // Outlook app footer
  /^[\s()\d+\-.\x20]{7,}$/,                        // phone numbers: (206) 555-1234, +1-206-555-1234
  /^\s*\S+@\S+\.\S+\s*$/,                          // standalone email address
  /^\s*(?:https?:\/\/|www\.)\S+\s*$/i,             // standalone URL
  /^\s*(?:Thanks|Thank you|Best|Regards|Cheers|Best regards|Kind regards|Warm regards)\s*,?\s*$/i,
  /^\s*(?:V\/r|Respectfully|Sincerely)\s*,?\s*$/i,
  /^\s*(?:He\/Him|She\/Her|They\/Them)\s*$/i,      // pronoun lines
  /^\s*\d{1,5}\s+[A-Z].*(?:St|Ave|Blvd|Dr|Rd|Way|Ln|Ct)\.?\s*$/i, // street addresses
  /^\s*[A-Z][a-z]+(?:,\s*[A-Z]{2})?\s+\d{5}(?:-\d{4})?\s*$/i,     // city/state/zip
  /^\s*M:\s|^\s*O:\s|^\s*C:\s|^\s*P:\s|^\s*T:\s|^\s*F:\s/i,       // labeled phone: "M: 555..." "O: 555..."
  /^\s*(?:this (?:email|message|communication) (?:is |are )?(?:confidential|intended)).*$/i,  // confidentiality one-liners
  /^\s*CONFIDENTIALITY NOTICE\s*$/i,                // standalone confidentiality header
];

/**
 * Strip corporate signature lines from a forwarder preface.
 * Removes lines matching signature patterns and checks if meaningful content remains.
 */
function stripSignatureLines(preface: string): string {
  return preface
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      return !SIGNATURE_LINE_PATTERNS.some((pat) => pat.test(trimmed));
    })
    .join("\n")
    .trim();
}

/**
 * Strip gateway-added external email tags from a subject line.
 *
 * Corporate email gateways (Proofpoint, Mimecast, etc.) prepend tags like:
 *   [EXTERNAL] Re: Partnership Update
 *   [EXT] Fwd: Meeting Notes
 *   External : Security Review
 *   [External Email] Partnership Proposal
 */
export function stripExternalTag(subject: string): string {
  return subject
    .replace(/^\s*\[external(?:\s+email)?\]\s*/i, "")
    .replace(/^\s*\[ext\]\s*/i, "")
    .replace(/^\s*external\s*:\s*/i, "")
    .trim();
}

/**
 * Parse a forwarded email body into individual messages.
 *
 * Two-pass architecture:
 * Pass 1 — Primary split (Outlook headers OR Gmail markers OR single fallback)
 * Pass 2 — Recursive sub-split on each message for internal Gmail quotes / generic separators
 * Final  — Chronological sort (oldest first)
 */
export function parseForwardedEmail(
  rawBody: string,
  envelope?: { sender?: string; subject?: string; timestamp?: number }
): ParsedMessage[] {
  if (!rawBody || !rawBody.trim()) {
    return [];
  }

  // Normalize CRLF → LF before any regex matching.
  // Mailgun delivers body-plain with \r\n line endings, but our regexes
  // use \n anchors and `.` (which doesn't match \r in Node.js).
  rawBody = rawBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // ========== Pass 1: Primary split ==========
  const headers = findHeaderBlocks(rawBody);
  let pass1Messages: ParsedMessage[];
  let forwarderNote: string | undefined;

  if (headers.length > 0) {
    // Outlook-style split
    pass1Messages = [];

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const bodyStart = header.fullMatchEnd;
      const bodyEnd = i + 1 < headers.length ? headers[i + 1].index : rawBody.length;
      const bodySlice = rawBody.slice(bodyStart, bodyEnd);
      const { senderName, senderEmail } = parseSenderField(header.senderRaw);

      pass1Messages.push({
        sender_name: senderName,
        sender_email: senderEmail,
        sent_at: parseDate(header.sentRaw),
        subject: header.subject,
        body_text: stripNoise(bodySlice),
        body_raw: bodySlice.trim(),
        to_header: header.toRaw,
        cc_header: header.ccRaw,
      });
    }

    // Forwarder preface handling — distinguish typed notes from signature blocks
    const preface = rawBody.slice(0, headers[0].index).trim();
    const cleaned = stripSignatureLines(preface);

    if (cleaned.length > 20) {
      forwarderNote = cleaned;
    }
  } else {
    // Try Gmail/Apple Mail markers as primary split
    const gmailMarkers = findGmailQuoteMarkers(rawBody);

    if (gmailMarkers.length > 0) {
      pass1Messages = buildGmailMessages(rawBody, gmailMarkers, envelope);
    } else {
      // Single message fallback — no internal split needed
      const { senderName, senderEmail } = envelope?.sender
        ? parseSenderField(envelope.sender)
        : { senderName: null, senderEmail: null };

      const singleBody = rawBody;
      const lineCount = singleBody.split("\n").filter((l) => l.trim().length > 0).length;
      return [
        {
          sender_name: senderName,
          sender_email: senderEmail,
          sent_at: envelope?.timestamp
            ? new Date(envelope.timestamp * 1000).toISOString()
            : null,
          subject: envelope?.subject ?? null,
          body_text: cleanMessageBody(singleBody, { skipSignatureStrip: lineCount < 5 }),
          body_raw: rawBody,
        },
      ];
    }
  }

  // ========== Pass 2: Recursive sub-split on each message ==========
  const allMessages: ParsedMessage[] = [];
  for (const msg of pass1Messages) {
    allMessages.push(...splitQuotedReplies(msg));
  }

  // ========== Final: Attach forwarder_note, sort, and deep clean ==========
  if (forwarderNote && allMessages.length > 0) {
    allMessages[0].forwarder_note = forwarderNote;
  }

  const sorted = sortChronologically(allMessages);

  // Deep body cleaning pass — strips artifacts and bottom signatures
  for (let i = 0; i < sorted.length; i++) {
    const isLastMessage = i === sorted.length - 1;
    const lineCount = sorted[i].body_text.split("\n").filter((l) => l.trim().length > 0).length;
    const isShortReply = isLastMessage && lineCount < 5;
    sorted[i].body_text = cleanMessageBody(sorted[i].body_text, {
      skipSignatureStrip: isShortReply,
    });
  }

  return sorted;
}

/**
 * Build ParsedMessage[] from Gmail/Apple Mail "On ... wrote:" markers.
 * Used for Pass 1 when Gmail is the primary split format (no Outlook headers).
 *
 * Message 0 (newest): body = text before the first marker, sender from envelope.
 * Message N (older):  body = text between marker[n] and marker[n+1], sender from marker.
 *
 * NOTE: These messages are NOT recursively split here — Pass 2 handles that.
 */
function buildGmailMessages(
  rawBody: string,
  markers: GmailQuoteMatch[],
  envelope?: { sender?: string; subject?: string; timestamp?: number }
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const subject = envelope?.subject ?? null;

  // Message 0: the newest message (text before first quote marker)
  const newestBody = rawBody.slice(0, markers[0].index);
  const cleanedNewest = stripNoise(newestBody).trim();

  const { senderName: envName, senderEmail: envEmail } = envelope?.sender
    ? parseSenderField(envelope.sender)
    : { senderName: null, senderEmail: null };

  if (cleanedNewest.length >= 20) {
    messages.push({
      sender_name: envName,
      sender_email: envEmail,
      sent_at: envelope?.timestamp
        ? new Date(envelope.timestamp * 1000).toISOString()
        : null,
      subject,
      body_text: cleanedNewest,
      body_raw: newestBody.trim(),
    });
  }

  // Older messages: each marker introduces a quoted message
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const bodyStart = marker.fullMatchEnd;
    const bodyEnd = i + 1 < markers.length ? markers[i + 1].index : rawBody.length;
    const bodySlice = rawBody.slice(bodyStart, bodyEnd);

    messages.push({
      sender_name: marker.senderName,
      sender_email: marker.senderEmail,
      sent_at: marker.dateRaw ? parseDate(marker.dateRaw) : null,
      subject,
      body_text: stripNoise(bodySlice),
      body_raw: bodySlice.trim(),
    });
  }

  // If we skipped the newest message (too short), attach it as forwarder_note
  if (cleanedNewest.length > 0 && cleanedNewest.length < 20 && messages.length > 0) {
    messages[0].forwarder_note = cleanedNewest;
  }

  return messages;
}
