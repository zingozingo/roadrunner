import { getSupabaseClient } from "./client";
import type { Message } from "../types";

/**
 * Inbox = unrouted messages (engagement_id IS NULL, not noise).
 */

/** Messages forwarded within this window are treated as one logical inbox item. */
export const INBOX_GROUP_WINDOW_MS = 5000;

export interface InboxItem {
  id: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string | null;
  body_text: string | null;
  forwarded_at: string;
  partner_id: string | null;
  partner_name: string | null;
  content_type: string | null;
  forwarder_note: string | null;
}

export async function getInboxItems(): Promise<InboxItem[]> {
  const db = getSupabaseClient();

  // Fetch unrouted messages
  const { data: messages, error } = await db
    .from("messages")
    .select("id, sender_name, sender_email, subject, body_text, forwarded_at, partner_id, content_type, forwarder_note")
    .is("engagement_id", null)
    .or("content_type.is.null,content_type.neq.noise")
    .order("forwarded_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch inbox items: ${error.message}`);
  if (!messages || messages.length === 0) return [];

  // Batch-fetch partner names for detected partners
  const partnerIds = [...new Set(
    messages.map((m: { partner_id: string | null }) => m.partner_id).filter(Boolean)
  )];

  const partnerMap = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", partnerIds);

    for (const p of partners as { id: string; name: string }[] ?? []) {
      partnerMap.set(p.id, p.name);
    }
  }

  return messages.map((row: { id: string; sender_name: string | null; sender_email: string | null; subject: string | null; body_text: string | null; forwarded_at: string; partner_id: string | null; content_type: string | null; forwarder_note: string | null }) => ({
    id: row.id,
    sender_name: row.sender_name,
    sender_email: row.sender_email,
    subject: row.subject,
    body_text: row.body_text,
    forwarded_at: row.forwarded_at,
    partner_id: row.partner_id,
    partner_name: row.partner_id ? (partnerMap.get(row.partner_id) ?? null) : null,
    content_type: row.content_type,
    forwarder_note: row.forwarder_note,
  }));
}

export async function getInboxCount(): Promise<number> {
  const db = getSupabaseClient();
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .is("engagement_id", null)
    .or("content_type.is.null,content_type.neq.noise");

  if (error) throw new Error(`Failed to count inbox items: ${error.message}`);
  return count ?? 0;
}

/**
 * Count inbox items grouped by forwarded_at window.
 * Matches the client-side grouping in InboxClient.tsx.
 */
export async function getInboxGroupCount(): Promise<number> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("messages")
    .select("forwarded_at")
    .is("engagement_id", null)
    .or("content_type.is.null,content_type.neq.noise")
    .order("forwarded_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch inbox timestamps: ${error.message}`);
  if (!data || data.length === 0) return 0;

  let groups = 1;
  for (let i = 1; i < data.length; i++) {
    const prevTime = new Date(data[i - 1].forwarded_at).getTime();
    const currTime = new Date(data[i].forwarded_at).getTime();
    if (Math.abs(currTime - prevTime) > INBOX_GROUP_WINDOW_MS) {
      groups++;
    }
  }
  return groups;
}

export async function discardInboxItem(messageId: string): Promise<void> {
  const db = getSupabaseClient();

  // Fetch all messages in the same timestamp group (same pattern as assign)
  const groupMessages = await getMessagesForInboxItem(messageId);
  const groupIds = groupMessages.map((m) => m.id);

  // Delete any meetings linked to messages in this group
  await db
    .from("meetings")
    .delete()
    .in("message_id", groupIds);

  // Delete all messages in the group
  const { error } = await db
    .from("messages")
    .delete()
    .in("id", groupIds);

  if (error) throw new Error(`Failed to delete messages: ${error.message}`);
}

/**
 * Set partner_id on all inbox messages in the same forwarded_at group,
 * plus any linked meetings that have no partner_id yet.
 */
export async function setPartnerForInboxGroup(
  messageId: string,
  partnerId: string
): Promise<{ updatedMessages: number }> {
  const db = getSupabaseClient();

  // Get the target message
  const { data: target, error: targetError } = await db
    .from("messages")
    .select("forwarded_at, engagement_id")
    .eq("id", messageId)
    .single();

  if (targetError || !target) throw new Error(`Message ${messageId} not found`);
  if (target.engagement_id) throw new Error("Message is already routed to an engagement");

  // Find all messages in the same group
  const targetTime = new Date(target.forwarded_at).getTime();
  const windowStart = new Date(targetTime - INBOX_GROUP_WINDOW_MS).toISOString();
  const windowEnd = new Date(targetTime + INBOX_GROUP_WINDOW_MS).toISOString();

  const { data: grouped, error: groupError } = await db
    .from("messages")
    .select("id")
    .is("engagement_id", null)
    .gte("forwarded_at", windowStart)
    .lte("forwarded_at", windowEnd);

  if (groupError) throw new Error(`Failed to fetch grouped messages: ${groupError.message}`);

  const messageIds = (grouped ?? []).map((m: { id: string }) => m.id);
  if (messageIds.length === 0) return { updatedMessages: 0 };

  // Stamp partner_id on all messages in group
  const { error: updateError } = await db
    .from("messages")
    .update({ partner_id: partnerId })
    .in("id", messageIds);

  if (updateError) throw new Error(`Failed to update messages: ${updateError.message}`);

  // Stamp partner_id on any linked meetings that have no partner yet
  await db
    .from("meetings")
    .update({ partner_id: partnerId })
    .in("message_id", messageIds)
    .is("partner_id", null);

  return { updatedMessages: messageIds.length };
}

export async function getMessagesForInboxItem(messageId: string): Promise<Message[]> {
  const db = getSupabaseClient();

  // Get the target message first
  const { data: target, error: targetError } = await db
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (targetError || !target) throw new Error(`Message ${messageId} not found`);

  // Find grouped messages (same forwarded_at within grouping window)
  const targetTime = new Date(target.forwarded_at).getTime();
  const windowStart = new Date(targetTime - INBOX_GROUP_WINDOW_MS).toISOString();
  const windowEnd = new Date(targetTime + INBOX_GROUP_WINDOW_MS).toISOString();

  const { data: grouped, error: groupError } = await db
    .from("messages")
    .select("*")
    .is("engagement_id", null)
    .gte("forwarded_at", windowStart)
    .lte("forwarded_at", windowEnd);

  if (groupError) throw new Error(`Failed to fetch grouped messages: ${groupError.message}`);

  return (grouped ?? [target]) as Message[];
}
