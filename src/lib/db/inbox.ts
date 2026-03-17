import { getSupabaseClient } from "./client";
import type { Message } from "../types";

/**
 * Inbox = unrouted messages (engagement_id IS NULL, not noise).
 */

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
  const { data, error } = await db
    .from("messages")
    .select("id, sender_name, sender_email, subject, body_text, forwarded_at, partner_id, content_type, forwarder_note, partners(name)")
    .is("engagement_id", null)
    .or("content_type.is.null,content_type.neq.noise")
    .order("forwarded_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch inbox items: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    sender_name: row.sender_name,
    sender_email: row.sender_email,
    subject: row.subject,
    body_text: row.body_text,
    forwarded_at: row.forwarded_at,
    partner_id: row.partner_id,
    partner_name: row.partners?.name ?? null,
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

  // Find grouped messages (same forwarded_at within 5 seconds)
  const targetTime = new Date(target.forwarded_at).getTime();
  const windowStart = new Date(targetTime - 5000).toISOString();
  const windowEnd = new Date(targetTime + 5000).toISOString();

  const { data: grouped, error: groupError } = await db
    .from("messages")
    .select("*")
    .is("engagement_id", null)
    .gte("forwarded_at", windowStart)
    .lte("forwarded_at", windowEnd);

  if (groupError) throw new Error(`Failed to fetch grouped messages: ${groupError.message}`);

  return (grouped ?? [target]) as Message[];
}
