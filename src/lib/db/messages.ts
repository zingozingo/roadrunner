import { getSupabaseClient } from "./client";
import { ParsedMessage, Message } from "../types";

/**
 * Generate a fingerprint for a parsed message to detect duplicates.
 * Uses lowercase sender_email + first 100 chars of body_text.
 */
export function messageFingerprint(msg: ParsedMessage): string {
  const email = (msg.sender_email ?? "").toLowerCase();
  const body = (msg.body_text ?? "").trim().toLowerCase().slice(0, 100);
  return `${email}|${body}`;
}

/**
 * Find fingerprints that already exist in the messages table.
 * Queries recent messages (last 30 days) by sender_email, then builds
 * fingerprints in JS. Fails open on query errors (returns empty set).
 */
async function findExistingFingerprints(
  messages: ParsedMessage[]
): Promise<Set<string>> {
  const existing = new Set<string>();

  try {
    // Collect unique sender emails from the batch
    const senderEmails = [
      ...new Set(
        messages
          .map((m) => m.sender_email?.toLowerCase())
          .filter((e): e is string => !!e)
      ),
    ];

    if (senderEmails.length === 0) return existing;

    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await getSupabaseClient()
      .from("messages")
      .select("sender_email, body_text")
      .in("sender_email", senderEmails)
      .gte("forwarded_at", thirtyDaysAgo);

    if (error) {
      console.error("Fingerprint lookup failed (allowing all):", error.message);
      return existing;
    }

    for (const row of (data ?? []) as { sender_email: string; body_text: string }[]) {
      const fp = `${(row.sender_email ?? "").toLowerCase()}|${(row.body_text ?? "").trim().toLowerCase().slice(0, 100)}`;
      existing.add(fp);
    }
  } catch (err) {
    console.error("findExistingFingerprints error (allowing all):", err);
  }

  return existing;
}

/**
 * Bulk insert parsed messages into the messages table.
 * Messages are stored as unclassified (engagement_id = null).
 * Deduplicates per-message using fingerprints against recent DB records.
 */
export async function storeMessages(
  messages: ParsedMessage[]
): Promise<Message[]> {
  if (messages.length === 0) return [];

  // Per-message dedup: filter out messages that already exist
  const existingFps = await findExistingFingerprints(messages);
  const dedupedMessages = messages.filter((m) => {
    const fp = messageFingerprint(m);
    return !existingFps.has(fp);
  });

  const skipped = messages.length - dedupedMessages.length;
  if (skipped > 0) {
    console.log(`[DEDUP] Skipped ${skipped} duplicate message(s)`);
  }

  if (dedupedMessages.length === 0) return [];

  const rows = dedupedMessages.map((m) => ({
    sender_name: m.sender_name,
    sender_email: m.sender_email,
    sent_at: m.sent_at,
    subject: m.subject,
    body_text: m.body_text,
    body_raw: m.body_raw,
    engagement_id: null,
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarder_email: m.forwarder_email ?? null,
    forwarder_name: m.forwarder_name ?? null,
    forwarder_note: m.forwarder_note ?? null,
    to_header: m.to_header ?? null,
    cc_header: m.cc_header ?? null,
  }));

  const { data, error } = await getSupabaseClient()
    .from("messages")
    .insert(rows)
    .select();

  if (error) {
    throw new Error(`Failed to store messages: ${error.message}`);
  }

  return data as Message[];
}

/**
 * Stamp classification results on messages.
 * Sets engagement_id, content_type, confidence, full result, and clears pending_review.
 */
export async function stampMessagesWithClassification(
  messageIds: string[],
  data: {
    engagement_id: string;
    content_type: string | null;
    classification_confidence: number;
    classification_result: unknown;
  }
): Promise<void> {
  if (messageIds.length === 0) return;

  const { error } = await getSupabaseClient()
    .from("messages")
    .update({
      engagement_id: data.engagement_id,
      content_type: data.content_type,
      classification_confidence: data.classification_confidence,
      classification_result: data.classification_result,
      pending_review: false,
    })
    .in("id", messageIds);

  if (error) throw new Error(`Failed to stamp messages with classification: ${error.message}`);
}

export async function findMessageById(id: string): Promise<Message | null> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch message: ${error.message}`);
  return data as Message | null;
}

export async function getUnclassifiedMessages(): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .is("engagement_id", null)
    .is("classification_result", null)
    .order("forwarded_at", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch unclassified messages: ${error.message}`);
  return data as Message[];
}
