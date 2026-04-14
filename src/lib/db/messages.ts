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
 * Link messages to an engagement and clear pending_review.
 * Used as fallback when AI synthesis fails during inbox resolution.
 */
export async function linkMessagesToEngagement(
  messageIds: string[],
  engagementId: string
): Promise<void> {
  if (messageIds.length === 0) return;

  const { error } = await getSupabaseClient()
    .from("messages")
    .update({ engagement_id: engagementId, pending_review: false })
    .in("id", messageIds);

  if (error) throw new Error(`Failed to link messages to engagement: ${error.message}`);
}

/**
 * Get unrouted messages that have no partner_id.
 * Used by redetect to re-run partner detection.
 */
export async function getUnroutedPartnerlessMessages(): Promise<
  { id: string; sender_email: string | null; subject: string | null; body_text: string | null; forwarded_at: string; partner_id: string | null }[]
> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("id, sender_email, subject, body_text, forwarded_at, partner_id")
    .is("engagement_id", null)
    .is("partner_id", null)
    .or("content_type.is.null,content_type.neq.noise")
    .order("forwarded_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch unrouted messages: ${error.message}`);
  return (data ?? []) as { id: string; sender_email: string | null; subject: string | null; body_text: string | null; forwarded_at: string; partner_id: string | null }[];
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

/**
 * Stamp a partner_id on a batch of messages.
 */
export async function stampPartnerOnMessages(
  messageIds: string[],
  partnerId: string
): Promise<void> {
  if (messageIds.length === 0) return;

  const { error } = await getSupabaseClient()
    .from("messages")
    .update({ partner_id: partnerId })
    .in("id", messageIds);

  if (error) throw new Error(`Failed to stamp partner on messages: ${error.message}`);
}

/**
 * Move all messages from one engagement to another.
 * Returns the number of messages moved.
 */
export async function reparentMessagesToEngagement(
  fromEngagementId: string,
  toEngagementId: string
): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .update({ engagement_id: toEngagementId })
    .eq("engagement_id", fromEngagementId)
    .select("id");

  if (error) throw new Error(`Failed to reparent messages: ${error.message}`);
  return data?.length ?? 0;
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

/**
 * Update engagement_id on specific messages by ID.
 * Pass null to return messages to inbox (unrouted).
 * Also sets pending_review: true when returning to inbox (null),
 * false when moving to an engagement, so messages are properly
 * flagged for inbox review after being returned.
 */
export async function updateMessagesEngagement(
  messageIds: string[],
  engagementId: string | null
): Promise<number> {
  if (messageIds.length === 0) return 0;

  const { data, error } = await getSupabaseClient()
    .from("messages")
    .update({
      engagement_id: engagementId,
      pending_review: engagementId === null,
    })
    .in("id", messageIds)
    .select("id");

  if (error) throw new Error(`Failed to update messages engagement: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Delete messages by IDs. Used by discard cascade.
 */
export async function deleteMessagesByIds(messageIds: string[]): Promise<number> {
  if (messageIds.length === 0) return 0;

  const { data, error } = await getSupabaseClient()
    .from("messages")
    .delete()
    .in("id", messageIds)
    .select("id");

  if (error) throw new Error(`Failed to delete messages: ${error.message}`);
  return data?.length ?? 0;
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
