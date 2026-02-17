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
  // AWS/corporate "CAUTION: external email" gateway banner
  /(?:^|\n)CAUTION: This email originated from outside of the organization[^\n]*/gi,
  // Standard email signature delimiter (RFC 3676): "--" or "-- " on own line
  /\n--[ ]?\n[\s\S]*$/g,
];

/**
 * Parse a "Name <email>" string into its parts.
 */
export function parseSenderField(raw: string): {
  senderName: string | null;
  senderEmail: string | null;
} {
  const match = raw.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { senderName: match[1].trim(), senderEmail: match[2].trim() };
  }
  // Might be just an email address
  if (raw.includes("@")) {
    return { senderName: null, senderEmail: raw.trim() };
  }
  return { senderName: raw.trim(), senderEmail: null };
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
        const nameMatch = beforeEmail.match(/(?:^|[,\s])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/);
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
          // Try to find trailing name (capitalized words)
          const nameMatch = afterOn.match(/(?:^|[,\s])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/);
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
 * Parse a forwarded email body into individual messages.
 *
 * Strategy:
 * 1. Find all Outlook-style header blocks (From:/Sent:/To:/Subject:)
 * 2. If none, try Gmail/Apple Mail-style "On ... wrote:" markers
 * 3. If neither found, return the entire text as a single fallback message
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

  const headers = findHeaderBlocks(rawBody);

  // No Outlook headers — try Gmail/Apple Mail "On ... wrote:" markers
  if (headers.length === 0) {
    const gmailMarkers = findGmailQuoteMarkers(rawBody);

    if (gmailMarkers.length > 0) {
      return buildGmailMessages(rawBody, gmailMarkers, envelope);
    }

    // No structured headers at all — fall back to single message from envelope
    const { senderName, senderEmail } = envelope?.sender
      ? parseSenderField(envelope.sender)
      : { senderName: null, senderEmail: null };

    return [
      {
        sender_name: senderName,
        sender_email: senderEmail,
        sent_at: envelope?.timestamp
          ? new Date(envelope.timestamp * 1000).toISOString()
          : null,
        subject: envelope?.subject ?? null,
        body_text: stripNoise(rawBody),
        body_raw: rawBody,
      },
    ];
  }

  const messages: ParsedMessage[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const bodyStart = header.fullMatchEnd;
    const bodyEnd = i + 1 < headers.length ? headers[i + 1].index : rawBody.length;
    const bodySlice = rawBody.slice(bodyStart, bodyEnd);
    const { senderName, senderEmail } = parseSenderField(header.senderRaw);

    messages.push({
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

  // If there's text BEFORE the first header block, it's the forwarder's preface
  // (e.g., "FYI", a signature line, or a brief note). This is forwarding metadata,
  // not partner communication — never create a standalone message for it.
  // If the preface contains a meaningful note (not just a signature), attach it
  // to the first real message as forwarder_note for classification context.
  const preface = rawBody.slice(0, headers[0].index).trim();
  const cleaned = preface
    .replace(/^[\s_\-=*]+$/gm, "")           // separator lines
    .replace(/^[A-Z][a-z]+ [A-Z][a-z]+\s*\|.*$/gm, "") // "Name | Title" pattern
    .replace(/^[A-Z][a-z]+ [A-Z][a-z]+\s*$/gm, "")     // just a name on a line
    .replace(/^\s*Sent from .+$/gm, "")       // mobile signatures
    .trim();

  if (cleaned.length > 20 && messages.length > 0) {
    messages[0].forwarder_note = cleaned;
  }

  return messages;
}

/**
 * Build ParsedMessage[] from Gmail/Apple Mail "On ... wrote:" markers.
 *
 * Message 0 (newest): body = text before the first marker, sender from envelope.
 * Message N (older):  body = text between marker[n] and marker[n+1], sender from marker.
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

  // If the preface is very short (< 20 chars), it's not a real message body —
  // likely just "FYI" or empty. In that case, skip creating a message for it
  // and attach as forwarder_note instead.
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

    const msg: ParsedMessage = {
      sender_name: marker.senderName,
      sender_email: marker.senderEmail,
      sent_at: marker.dateRaw ? parseDate(marker.dateRaw) : null,
      subject,
      body_text: stripNoise(bodySlice),
      body_raw: bodySlice.trim(),
    };

    messages.push(msg);
  }

  // If we skipped the newest message (too short), attach it as forwarder_note
  if (cleanedNewest.length > 0 && cleanedNewest.length < 20 && messages.length > 0) {
    messages[0].forwarder_note = cleanedNewest;
  }

  return messages;
}
