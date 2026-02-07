import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  Initiative,
  Event,
  Program,
  Message,
  ParsedMessage,
  PendingReview,
  ClassificationResult,
  SMSOption,
} from "./types";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
    }
    client = createClient(url, key);
  }
  return client;
}

/** Convenience alias for existing imports */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[
      prop
    ];
  },
});

/**
 * Bulk insert parsed messages into the messages table.
 * Messages are stored as unclassified (initiative_id = null).
 */
export async function storeMessages(
  messages: ParsedMessage[]
): Promise<Message[]> {
  if (messages.length === 0) return [];

  const rows = messages.map((m) => ({
    sender_name: m.sender_name,
    sender_email: m.sender_email,
    sent_at: m.sent_at,
    subject: m.subject,
    body_text: m.body_text,
    body_raw: m.body_raw,
    initiative_id: null,
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
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

export async function getActiveInitiatives(): Promise<Initiative[]> {
  const { data, error } = await getSupabaseClient()
    .from("initiatives")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);
  return data as Initiative[];
}

export async function getActiveEvents(): Promise<Event[]> {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Failed to fetch events: ${error.message}`);
  return data as Event[];
}

export async function getActivePrograms(): Promise<Program[]> {
  const { data, error } = await getSupabaseClient()
    .from("programs")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch programs: ${error.message}`);
  return data as Program[];
}

export async function getUnclassifiedMessages(): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .is("initiative_id", null)
    .order("forwarded_at", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch unclassified messages: ${error.message}`);
  return data as Message[];
}

// ============================================================
// Pending reviews
// ============================================================

export async function createPendingReview(data: {
  message_id: string;
  classification_result: ClassificationResult;
  options_sent: SMSOption[];
  sms_sent: boolean;
  sms_sent_at: string | null;
}): Promise<PendingReview> {
  const { data: review, error } = await getSupabaseClient()
    .from("pending_reviews")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Failed to create pending review: ${error.message}`);
  return review as PendingReview;
}

export async function getLatestUnresolvedReview(): Promise<PendingReview | null> {
  const { data, error } = await getSupabaseClient()
    .from("pending_reviews")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to fetch pending review: ${error.message}`);
  return data && data.length > 0 ? (data[0] as PendingReview) : null;
}

export async function resolvePendingReview(
  id: string,
  resolution: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("pending_reviews")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution,
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to resolve pending review: ${error.message}`);
}

// ============================================================
// Initiative CRUD
// ============================================================

export async function createInitiative(data: {
  name: string;
  partner_name?: string | null;
  summary?: string | null;
}): Promise<Initiative> {
  const { data: initiative, error } = await getSupabaseClient()
    .from("initiatives")
    .insert({
      name: data.name,
      partner_name: data.partner_name ?? null,
      summary: data.summary ?? null,
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create initiative: ${error.message}`);
  return initiative as Initiative;
}

export async function updateMessageInitiative(
  messageId: string,
  initiativeId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("messages")
    .update({ initiative_id: initiativeId, pending_review: false })
    .eq("id", messageId);

  if (error) throw new Error(`Failed to update message initiative: ${error.message}`);
}

export async function updateInitiativeSummary(
  id: string,
  summary: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("initiatives")
    .update({ summary })
    .eq("id", id);

  if (error) throw new Error(`Failed to update initiative summary: ${error.message}`);
}
