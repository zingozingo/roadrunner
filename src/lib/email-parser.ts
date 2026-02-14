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
  const withoutDay = cleaned.replace(/^[A-Za-z]+,\s*/, "");
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

/**
 * Parse a forwarded email body into individual messages.
 *
 * Strategy:
 * 1. Find all Outlook-style header blocks (From:/Sent:/To:/Subject:)
 * 2. Extract the body between each header block and the next
 * 3. If no headers found, return the entire text as a single fallback message
 */
export function parseForwardedEmail(
  rawBody: string,
  envelope?: { sender?: string; subject?: string; timestamp?: number }
): ParsedMessage[] {
  if (!rawBody || !rawBody.trim()) {
    return [];
  }

  const headers = findHeaderBlocks(rawBody);

  // No structured headers found — fall back to single message from envelope
  if (headers.length === 0) {
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

  // If there's text BEFORE the first header block, it's the forwarder's own message.
  // Only include it if it has meaningful content (not just separator lines).
  const preface = rawBody.slice(0, headers[0].index).trim();
  const meaningfulPreface = preface.replace(/[_\-*\s]/g, "");
  if (meaningfulPreface.length > 10) {
    const { senderName, senderEmail } = envelope?.sender
      ? parseSenderField(envelope.sender)
      : { senderName: null, senderEmail: null };

    messages.unshift({
      sender_name: senderName,
      sender_email: senderEmail,
      sent_at: envelope?.timestamp
        ? new Date(envelope.timestamp * 1000).toISOString()
        : null,
      subject: envelope?.subject ?? null,
      body_text: stripNoise(preface),
      body_raw: preface,
    });
  }

  return messages;
}
