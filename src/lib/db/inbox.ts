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
    messages.map((m: any) => m.partner_id).filter(Boolean)
  )];

  const partnerMap = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", partnerIds);

    for (const p of partners ?? []) {
      partnerMap.set((p as any).id, (p as any).name);
    }
  }

  return messages.map((row: any) => ({
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

  // Delete any meeting linked to this message first
  await db
    .from("meetings")
    .delete()
    .eq("message_id", messageId);

  // Delete the message itself
  const { error } = await db
    .from("messages")
    .delete()
    .eq("id", messageId);

  if (error) throw new Error(`Failed to delete message: ${error.message}`);
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
