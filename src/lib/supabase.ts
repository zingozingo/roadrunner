import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  Initiative,
  Event,
  Program,
  Message,
  ParsedMessage,
  PendingReview,
  Participant,
  EntityLink,
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

// ============================================================
// Dashboard query helpers
// ============================================================

export async function getUnresolvedReviewCount(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("pending_reviews")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  if (error) throw new Error(`Failed to count reviews: ${error.message}`);
  return count ?? 0;
}

export async function getUnresolvedReviewsWithMessages(): Promise<
  (PendingReview & { message: Message })[]
> {
  const { data, error } = await getSupabaseClient()
    .from("pending_reviews")
    .select("*, message:messages(*)")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
  return (data ?? []) as (PendingReview & { message: Message })[];
}

export async function getOrphanedMessages(): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .is("initiative_id", null)
    .eq("pending_review", false)
    .neq("content_type", "noise")
    .order("forwarded_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch orphaned messages: ${error.message}`);
  return (data ?? []) as Message[];
}

export async function getAllInitiatives(): Promise<Initiative[]> {
  const { data, error } = await getSupabaseClient()
    .from("initiatives")
    .select("*")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);
  return (data ?? []) as Initiative[];
}

export async function getInitiativeById(id: string): Promise<Initiative | null> {
  const { data, error } = await getSupabaseClient()
    .from("initiatives")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch initiative: ${error.message}`);
  return data as Initiative | null;
}

export async function getMessagesByInitiative(id: string): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .eq("initiative_id", id)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return (data ?? []) as Message[];
}

export async function getParticipantsByInitiative(
  initiativeId: string
): Promise<(Participant & { role: string | null })[]> {
  const { data, error } = await getSupabaseClient()
    .from("participant_links")
    .select("role, participant:participants(*)")
    .eq("entity_type", "initiative")
    .eq("entity_id", initiativeId);

  if (error) throw new Error(`Failed to fetch participants: ${error.message}`);

  return ((data ?? []) as unknown as { role: string | null; participant: Participant }[]).map(
    (row) => ({ ...row.participant, role: row.role })
  );
}

export async function getEntityLinksForEntity(
  type: EntityLink["source_type"],
  id: string
): Promise<EntityLink[]> {
  const client = getSupabaseClient();

  const [asSource, asTarget] = await Promise.all([
    client
      .from("entity_links")
      .select("*")
      .eq("source_type", type)
      .eq("source_id", id),
    client
      .from("entity_links")
      .select("*")
      .eq("target_type", type)
      .eq("target_id", id),
  ]);

  if (asSource.error) throw new Error(`Failed to fetch entity links: ${asSource.error.message}`);
  if (asTarget.error) throw new Error(`Failed to fetch entity links: ${asTarget.error.message}`);

  return [...(asSource.data ?? []), ...(asTarget.data ?? [])] as EntityLink[];
}

export async function getAllEventsWithCounts(): Promise<
  (Event & { linked_count: number })[]
> {
  const { data: events, error } = await getSupabaseClient()
    .from("events")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Failed to fetch events: ${error.message}`);

  const { data: links } = await getSupabaseClient()
    .from("entity_links")
    .select("source_type, source_id, target_type, target_id");

  const linkCounts = new Map<string, number>();
  for (const link of links ?? []) {
    const l = link as { source_type: string; source_id: string; target_type: string; target_id: string };
    if (l.source_type === "event") linkCounts.set(l.source_id, (linkCounts.get(l.source_id) ?? 0) + 1);
    if (l.target_type === "event") linkCounts.set(l.target_id, (linkCounts.get(l.target_id) ?? 0) + 1);
  }

  return ((events ?? []) as Event[]).map((e) => ({
    ...e,
    linked_count: linkCounts.get(e.id) ?? 0,
  }));
}

export async function getAllProgramsWithCounts(): Promise<
  (Program & { linked_count: number })[]
> {
  const { data: programs, error } = await getSupabaseClient()
    .from("programs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch programs: ${error.message}`);

  const { data: links } = await getSupabaseClient()
    .from("entity_links")
    .select("source_type, source_id, target_type, target_id");

  const linkCounts = new Map<string, number>();
  for (const link of links ?? []) {
    const l = link as { source_type: string; source_id: string; target_type: string; target_id: string };
    if (l.source_type === "program") linkCounts.set(l.source_id, (linkCounts.get(l.source_id) ?? 0) + 1);
    if (l.target_type === "program") linkCounts.set(l.target_id, (linkCounts.get(l.target_id) ?? 0) + 1);
  }

  return ((programs ?? []) as Program[]).map((p) => ({
    ...p,
    linked_count: linkCounts.get(p.id) ?? 0,
  }));
}

// ============================================================
// Upsert helpers for resolve flow
// ============================================================

export async function findOrCreateEvent(eventData: {
  name: string;
  type: Event["type"];
  start_date?: string | null;
  date_precision?: Event["date_precision"];
}): Promise<Event> {
  const db = getSupabaseClient();

  // Try to find existing by name (case-insensitive)
  const { data: existing } = await db
    .from("events")
    .select("*")
    .ilike("name", eventData.name)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0] as Event;
  }

  const { data: created, error } = await db
    .from("events")
    .insert({
      name: eventData.name,
      type: eventData.type,
      start_date: eventData.start_date ?? null,
      end_date: null,
      date_precision: eventData.date_precision ?? "exact",
      location: null,
      description: null,
      source: "email_extracted" as const,
      verified: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create event: ${error.message}`);
  return created as Event;
}

export async function findOrCreateProgram(programData: {
  name: string;
}): Promise<Program> {
  const db = getSupabaseClient();

  // Try to find existing by name (case-insensitive)
  const { data: existing } = await db
    .from("programs")
    .select("*")
    .ilike("name", programData.name)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0] as Program;
  }

  const { data: created, error } = await db
    .from("programs")
    .insert({
      name: programData.name,
      description: null,
      eligibility: null,
      url: null,
      status: "active" as const,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create program: ${error.message}`);
  return created as Program;
}

export async function createEntityLink(link: {
  source_type: EntityLink["source_type"];
  source_id: string;
  target_type: EntityLink["target_type"];
  target_id: string;
  relationship: string;
  context: string | null;
}): Promise<void> {
  const db = getSupabaseClient();

  // Check for existing to avoid duplicates
  const { data: existing } = await db
    .from("entity_links")
    .select("id")
    .eq("source_type", link.source_type)
    .eq("source_id", link.source_id)
    .eq("target_type", link.target_type)
    .eq("target_id", link.target_id)
    .eq("relationship", link.relationship)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { error } = await db.from("entity_links").insert({
    ...link,
    created_by: "ai",
  });

  if (error) throw new Error(`Failed to create entity link: ${error.message}`);
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

export async function checkDuplicateMessage(
  senderEmail: string,
  subject: string,
  bodyPrefix: string
): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("messages")
    .select("id")
    .eq("sender_email", senderEmail)
    .eq("subject", subject)
    .like("body_text", `${bodyPrefix}%`)
    .limit(1);

  if (error) {
    console.error("Duplicate check failed:", error.message);
    return false; // fail open — allow the message
  }

  return (data?.length ?? 0) > 0;
}

export async function getInitiativesWithMessageCounts(): Promise<
  (Initiative & { message_count: number })[]
> {
  const { data, error } = await getSupabaseClient()
    .from("initiatives")
    .select("*, messages(count)")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);

  return ((data ?? []) as (Initiative & { messages: { count: number }[] })[]).map(
    (row) => ({
      ...row,
      message_count: row.messages?.[0]?.count ?? 0,
      messages: undefined as never,
    })
  );
}
