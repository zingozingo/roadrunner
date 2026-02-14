import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  Engagement,
  Event,
  Program,
  Message,
  ParsedMessage,
  ApprovalQueueItem,
  Participant,
  EntityLink,
  ClassificationResult,
  SMSOption,
  OpenItem,
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
 * Messages are stored as unclassified (engagement_id = null).
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
    engagement_id: null,
    content_type: null,
    classification_confidence: null,
    linked_entities: [],
    forwarder_email: m.forwarder_email ?? null,
    forwarder_name: m.forwarder_name ?? null,
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

export async function getActiveEngagements(): Promise<Engagement[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);
  return data as Engagement[];
}

/** @deprecated Use getActiveEngagements instead */
export const getActiveInitiatives = getActiveEngagements;

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
    .is("engagement_id", null)
    .is("classification_result", null)
    .order("forwarded_at", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch unclassified messages: ${error.message}`);
  return data as Message[];
}

// ============================================================
// Unified approval queue
// ============================================================

export async function createApproval(data: {
  type: ApprovalQueueItem["type"];
  message_id?: string | null;
  engagement_id?: string | null;
  classification_result?: ClassificationResult | null;
  options_sent?: SMSOption[] | null;
  sms_sent?: boolean;
  sms_sent_at?: string | null;
}): Promise<ApprovalQueueItem> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_queue")
    .insert({
      type: data.type,
      message_id: data.message_id ?? null,
      engagement_id: data.engagement_id ?? null,
      classification_result: data.classification_result ?? null,
      options_sent: data.options_sent ?? null,
      sms_sent: data.sms_sent ?? false,
      sms_sent_at: data.sms_sent_at ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create approval: ${error.message}`);
  return row as ApprovalQueueItem;
}

export async function getUnresolvedApprovals(): Promise<
  (ApprovalQueueItem & { message: Message | null; engagement: Engagement | null })[]
> {
  const { data, error } = await getSupabaseClient()
    .from("approval_queue")
    .select("*, message:messages(*), engagement:engagements(*)")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch approvals: ${error.message}`);
  return (data ?? []) as (ApprovalQueueItem & {
    message: Message | null;
    engagement: Engagement | null;
  })[];
}

export async function getUnresolvedApprovalCount(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("approval_queue")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  if (error) throw new Error(`Failed to count approvals: ${error.message}`);
  return count ?? 0;
}

export async function resolveApproval(
  id: string,
  resolution: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("approval_queue")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution,
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to resolve approval: ${error.message}`);
}

export async function getLatestUnresolvedEngagementApproval(): Promise<ApprovalQueueItem | null> {
  const { data, error } = await getSupabaseClient()
    .from("approval_queue")
    .select("*")
    .eq("resolved", false)
    .eq("type", "engagement_assignment")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to fetch pending approval: ${error.message}`);
  return data && data.length > 0 ? (data[0] as ApprovalQueueItem) : null;
}

/** @deprecated Use getLatestUnresolvedEngagementApproval instead */
export const getLatestUnresolvedInitiativeApproval = getLatestUnresolvedEngagementApproval;

// ============================================================
// Engagement CRUD
// ============================================================

export async function createEngagement(data: {
  name: string;
  partner_name?: string | null;
  summary?: string | null;
  current_state?: string | null;
  open_items?: OpenItem[];
  tags?: string[];
}): Promise<Engagement> {
  const { data: engagement, error } = await getSupabaseClient()
    .from("engagements")
    .insert({
      name: data.name,
      partner_name: data.partner_name ?? null,
      summary: data.summary ?? null,
      current_state: data.current_state ?? null,
      open_items: data.open_items ?? [],
      tags: data.tags ?? [],
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create engagement: ${error.message}`);
  return engagement as Engagement;
}

/** @deprecated Use createEngagement instead */
export const createInitiative = createEngagement;

export async function updateMessageEngagement(
  messageId: string,
  engagementId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("messages")
    .update({ engagement_id: engagementId, pending_review: false })
    .eq("id", messageId);

  if (error) throw new Error(`Failed to update message engagement: ${error.message}`);
}

/** @deprecated Use updateMessageEngagement instead */
export const updateMessageInitiative = updateMessageEngagement;

export async function updateEngagementSummary(
  id: string,
  summary: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("engagements")
    .update({ summary })
    .eq("id", id);

  if (error) throw new Error(`Failed to update engagement summary: ${error.message}`);
}

/** @deprecated Use updateEngagementSummary instead */
export const updateInitiativeSummary = updateEngagementSummary;

export async function updateEngagement(
  id: string,
  updates: {
    name?: string;
    partner_name?: string | null;
    status?: Engagement["status"];
    summary?: string | null;
    current_state?: string | null;
    open_items?: OpenItem[];
    tags?: string[];
  }
): Promise<Engagement> {
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.partner_name !== undefined) row.partner_name = updates.partner_name;
  if (updates.summary !== undefined) row.summary = updates.summary;
  if (updates.current_state !== undefined) row.current_state = updates.current_state;
  if (updates.open_items !== undefined) row.open_items = updates.open_items;
  if (updates.tags !== undefined) row.tags = updates.tags;

  if (updates.status !== undefined) {
    row.status = updates.status;
    if (updates.status === "closed") {
      row.closed_at = new Date().toISOString();
    } else {
      row.closed_at = null;
    }
  }

  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update engagement: ${error.message}`);
  return data as Engagement;
}

/** @deprecated Use updateEngagement instead */
export const updateInitiative = updateEngagement;

export async function deleteEngagement(id: string): Promise<void> {
  const db = getSupabaseClient();

  // Application-level cascade for polymorphic FKs (no DB cascade possible):

  // 1. Delete entity links (both directions)
  const { error: linkSrcErr } = await db
    .from("entity_links")
    .delete()
    .eq("source_type", "engagement")
    .eq("source_id", id);
  if (linkSrcErr) throw new Error(`Failed to delete entity links (source): ${linkSrcErr.message}`);

  const { error: linkTgtErr } = await db
    .from("entity_links")
    .delete()
    .eq("target_type", "engagement")
    .eq("target_id", id);
  if (linkTgtErr) throw new Error(`Failed to delete entity links (target): ${linkTgtErr.message}`);

  // 2. Delete participant links
  const { error: plinkErr } = await db
    .from("participant_links")
    .delete()
    .eq("entity_type", "engagement")
    .eq("entity_id", id);
  if (plinkErr) throw new Error(`Failed to delete participant links: ${plinkErr.message}`);

  // 3. Delete unresolved approvals referencing this engagement
  const { error: approvalErr } = await db
    .from("approval_queue")
    .delete()
    .eq("engagement_id", id)
    .eq("resolved", false);
  if (approvalErr) throw new Error(`Failed to delete approvals: ${approvalErr.message}`);

  // 4. Delete the engagement — DB cascades handle:
  //    messages.engagement_id → SET NULL
  //    notes.engagement_id → CASCADE
  const { error: engErr } = await db
    .from("engagements")
    .delete()
    .eq("id", id);
  if (engErr) throw new Error(`Failed to delete engagement: ${engErr.message}`);
}

/**
 * Delete all messages belonging to an engagement.
 * Must be called BEFORE deleteEngagement() since the FK will SET NULL on cascade.
 * Returns the number of messages deleted.
 */
export async function deleteMessagesByEngagement(engagementId: string): Promise<number> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("messages")
    .delete()
    .eq("engagement_id", engagementId)
    .select("id");

  if (error) throw new Error(`Failed to delete messages: ${error.message}`);
  return data?.length ?? 0;
}

/** @deprecated Use deleteEngagement instead */
export const deleteInitiative = deleteEngagement;

// ============================================================
// Dashboard query helpers
// ============================================================


export async function getOrphanedMessages(): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .is("engagement_id", null)
    .eq("pending_review", false)
    .neq("content_type", "noise")
    .order("forwarded_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch orphaned messages: ${error.message}`);
  return (data ?? []) as Message[];
}

export async function getAllEngagements(): Promise<Engagement[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .select("*")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);
  return (data ?? []) as Engagement[];
}

/** @deprecated Use getAllEngagements instead */
export const getAllInitiatives = getAllEngagements;

export async function getEngagementById(id: string): Promise<Engagement | null> {
  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch engagement: ${error.message}`);
  return data as Engagement | null;
}

/** @deprecated Use getEngagementById instead */
export const getInitiativeById = getEngagementById;

export async function getMessagesByEngagement(id: string): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .eq("engagement_id", id)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return (data ?? []) as Message[];
}

/** @deprecated Use getMessagesByEngagement instead */
export const getMessagesByInitiative = getMessagesByEngagement;

export async function getParticipantsByEngagement(
  engagementId: string
): Promise<(Participant & { role: string | null; linkId: string })[]> {
  const { data, error } = await getSupabaseClient()
    .from("participant_links")
    .select("id, role, participant:participants(*)")
    .eq("entity_type", "engagement")
    .eq("entity_id", engagementId);

  if (error) throw new Error(`Failed to fetch participants: ${error.message}`);

  return ((data ?? []) as unknown as { id: string; role: string | null; participant: Participant }[]).map(
    (row) => ({ ...row.participant, role: row.role, linkId: row.id })
  );
}

/** @deprecated Use getParticipantsByEngagement instead */
export const getParticipantsByInitiative = getParticipantsByEngagement;

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

/**
 * Resolve entity link target IDs to their display names.
 * Returns a map of entityId → name.
 */
export async function resolveEntityLinkNames(
  links: EntityLink[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (links.length === 0) return nameMap;

  const db = getSupabaseClient();

  // Collect unique IDs by type (both source and target)
  const idsByType: Record<string, Set<string>> = {
    engagement: new Set(),
    event: new Set(),
    program: new Set(),
  };
  for (const link of links) {
    idsByType[link.source_type]?.add(link.source_id);
    idsByType[link.target_type]?.add(link.target_id);
  }

  const tableMap: Record<string, string> = {
    engagement: "engagements",
    event: "events",
    program: "programs",
  };

  await Promise.all(
    Object.entries(idsByType).map(async ([type, ids]) => {
      if (ids.size === 0) return;
      const { data } = await db
        .from(tableMap[type])
        .select("id, name")
        .in("id", [...ids]);
      for (const row of (data ?? []) as { id: string; name: string }[]) {
        nameMap.set(row.id, row.name);
      }
    })
  );

  return nameMap;
}

// ============================================================
// Event CRUD
// ============================================================

export async function getEventById(id: string): Promise<Event | null> {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch event: ${error.message}`);
  return data as Event | null;
}

export async function getLinkedEngagementsForEntity(
  entityType: "event" | "program",
  entityId: string
): Promise<Engagement[]> {
  const db = getSupabaseClient();

  // Find engagements linked in either direction
  const [asSource, asTarget] = await Promise.all([
    db
      .from("entity_links")
      .select("target_id")
      .eq("source_type", entityType)
      .eq("source_id", entityId)
      .eq("target_type", "engagement"),
    db
      .from("entity_links")
      .select("source_id")
      .eq("target_type", entityType)
      .eq("target_id", entityId)
      .eq("source_type", "engagement"),
  ]);

  const ids = new Set<string>();
  for (const row of asSource.data ?? []) ids.add((row as { target_id: string }).target_id);
  for (const row of asTarget.data ?? []) ids.add((row as { source_id: string }).source_id);

  if (ids.size === 0) return [];

  const { data, error } = await db
    .from("engagements")
    .select("*")
    .in("id", [...ids])
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch linked engagements: ${error.message}`);
  return (data ?? []) as Engagement[];
}

/** @deprecated Use getLinkedEngagementsForEntity instead */
export const getLinkedInitiativesForEntity = getLinkedEngagementsForEntity;

export async function updateEvent(
  id: string,
  updates: {
    name?: string;
    type?: Event["type"];
    start_date?: string | null;
    end_date?: string | null;
    host?: string | null;
    location?: string | null;
    description?: string | null;
    verified?: boolean;
  }
): Promise<Event> {
  const { data, error } = await getSupabaseClient()
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update event: ${error.message}`);
  return data as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  const db = getSupabaseClient();

  // 1. Delete entity links (both directions)
  const { error: linkSrcErr } = await db
    .from("entity_links")
    .delete()
    .eq("source_type", "event")
    .eq("source_id", id);
  if (linkSrcErr) throw new Error(`Failed to delete entity links (source): ${linkSrcErr.message}`);

  const { error: linkTgtErr } = await db
    .from("entity_links")
    .delete()
    .eq("target_type", "event")
    .eq("target_id", id);
  if (linkTgtErr) throw new Error(`Failed to delete entity links (target): ${linkTgtErr.message}`);

  // 2. Delete participant links
  const { error: plinkErr } = await db
    .from("participant_links")
    .delete()
    .eq("entity_type", "event")
    .eq("entity_id", id);
  if (plinkErr) throw new Error(`Failed to delete participant links: ${plinkErr.message}`);

  // 3. Delete the event
  const { error: evtErr } = await db
    .from("events")
    .delete()
    .eq("id", id);
  if (evtErr) throw new Error(`Failed to delete event: ${evtErr.message}`);
}

// ============================================================
// Track (program) CRUD
// ============================================================

export async function getTrackById(id: string): Promise<Program | null> {
  const { data, error } = await getSupabaseClient()
    .from("programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch track: ${error.message}`);
  return data as Program | null;
}

export async function updateTrack(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    eligibility?: string | null;
    url?: string | null;
    status?: Program["status"];
  }
): Promise<Program> {
  const { data, error } = await getSupabaseClient()
    .from("programs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update track: ${error.message}`);
  return data as Program;
}

export async function deleteTrack(id: string): Promise<void> {
  const db = getSupabaseClient();

  // 1. Delete entity links (both directions)
  const { error: linkSrcErr } = await db
    .from("entity_links")
    .delete()
    .eq("source_type", "program")
    .eq("source_id", id);
  if (linkSrcErr) throw new Error(`Failed to delete entity links (source): ${linkSrcErr.message}`);

  const { error: linkTgtErr } = await db
    .from("entity_links")
    .delete()
    .eq("target_type", "program")
    .eq("target_id", id);
  if (linkTgtErr) throw new Error(`Failed to delete entity links (target): ${linkTgtErr.message}`);

  // 2. Delete the track
  const { error: progErr } = await db
    .from("programs")
    .delete()
    .eq("id", id);
  if (progErr) throw new Error(`Failed to delete track: ${progErr.message}`);
}

// ============================================================
// Participant CRUD
// ============================================================

export async function getParticipantById(id: string): Promise<Participant | null> {
  const { data, error } = await getSupabaseClient()
    .from("participants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch participant: ${error.message}`);
  return data as Participant | null;
}

export async function updateParticipant(
  id: string,
  updates: {
    name?: string | null;
    email?: string | null;
    title?: string | null;
    organization?: string | null;
  }
): Promise<Participant> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.organization !== undefined) row.organization = updates.organization;

  const { data, error } = await getSupabaseClient()
    .from("participants")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update participant: ${error.message}`);
  return data as Participant;
}

export async function deleteParticipantLink(linkId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("participant_links")
    .delete()
    .eq("id", linkId);

  if (error) throw new Error(`Failed to delete participant link: ${error.message}`);
}

/**
 * Find or create a participant, then link to an engagement.
 * If email is provided, deduplicates by email.
 */
export async function createParticipantWithLink(
  participant: {
    name: string;
    email?: string | null;
    title?: string | null;
    organization?: string | null;
  },
  engagementId: string,
  role: string | null
): Promise<Participant & { role: string | null; linkId: string }> {
  const db = getSupabaseClient();
  let participantId: string;
  let participantRecord: Participant;

  // Try to find existing by email
  if (participant.email) {
    const { data: existing } = await db
      .from("participants")
      .select("*")
      .eq("email", participant.email)
      .limit(1);

    if (existing && existing.length > 0) {
      participantRecord = existing[0] as Participant;
      participantId = participantRecord.id;
    } else {
      const { data: created, error } = await db
        .from("participants")
        .insert({
          name: participant.name,
          email: participant.email,
          title: participant.title ?? null,
          organization: participant.organization ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create participant: ${error.message}`);
      participantRecord = created as Participant;
      participantId = participantRecord.id;
    }
  } else {
    // No email — always create (no reliable dedup key)
    const { data: created, error } = await db
      .from("participants")
      .insert({
        name: participant.name,
        email: null,
        title: participant.title ?? null,
        organization: participant.organization ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create participant: ${error.message}`);
    participantRecord = created as Participant;
    participantId = participantRecord.id;
  }

  // Create the link
  const { data: link, error: linkErr } = await db
    .from("participant_links")
    .insert({
      participant_id: participantId,
      entity_type: "engagement",
      entity_id: engagementId,
      role,
    })
    .select("id")
    .single();

  if (linkErr) throw new Error(`Failed to link participant: ${linkErr.message}`);

  return {
    ...participantRecord,
    role,
    linkId: (link as { id: string }).id,
  };
}

// ============================================================
// Participant upsert (single source of truth)
// ============================================================

/**
 * Upsert participants from classification results.
 * Creates new participants or updates existing ones with richer info.
 * Optionally links each participant to an engagement.
 */
export async function upsertParticipants(
  participants: ClassificationResult["participants"],
  engagementId: string | null
): Promise<void> {
  if (participants.length === 0) return;

  const db = getSupabaseClient();
  const pdmEmail = process.env.RELAY_EMAIL_ADDRESS?.toLowerCase();

  for (const participant of participants) {
    if (!participant.email && !participant.name) continue;

    // PDM forwarder gets role "forwarder" instead of whatever Claude extracted
    if (pdmEmail && participant.email?.toLowerCase() === pdmEmail) {
      participant.role = "forwarder";
    }

    let participantId: string | null = null;

    try {
      if (participant.email) {
        // Email-based lookup
        const { data: existing } = await db
          .from("participants")
          .select("*")
          .eq("email", participant.email)
          .limit(1);

        if (existing && existing.length > 0) {
          participantId = existing[0].id;
          const updates: Record<string, string> = {};
          if (!existing[0].name && participant.name) {
            updates.name = participant.name;
          }
          if (!existing[0].organization && participant.organization) {
            updates.organization = participant.organization;
          }
          if (!existing[0].title && participant.role && participant.role !== "forwarder") {
            updates.title = participant.role;
          }
          if (Object.keys(updates).length > 0) {
            await db
              .from("participants")
              .update(updates)
              .eq("id", participantId);
          }
        } else {
          const { data: inserted, error: insertErr } = await db
            .from("participants")
            .insert({
              email: participant.email,
              name: participant.name,
              organization: participant.organization,
              title: participant.role !== "forwarder" ? participant.role : null,
            })
            .select("id")
            .maybeSingle();

          if (insertErr) {
            console.error(`Failed to insert participant "${participant.email}":`, insertErr.message);
            continue;
          }
          if (inserted) {
            participantId = inserted.id;
          }
        }
      } else {
        // Name-only participant — dedup by normalized name
        const normalizedName = participant.name!.toLowerCase().trim();
        const { data: existing } = await db
          .from("participants")
          .select("*")
          .ilike("name", normalizedName)
          .limit(1);

        if (existing && existing.length > 0) {
          participantId = existing[0].id;
        } else {
          const { data: inserted, error: insertErr } = await db
            .from("participants")
            .insert({
              email: null,
              name: participant.name,
              organization: participant.organization,
              title: participant.role || null,
            })
            .select("id")
            .maybeSingle();

          if (insertErr) {
            console.error(`Failed to insert participant "${participant.name}":`, insertErr.message);
            continue;
          }
          if (inserted) {
            participantId = inserted.id;
          }
        }
      }

      // Link to engagement if we have one
      if (participantId && engagementId) {
        await ensureParticipantLink(
          participantId,
          "engagement",
          engagementId,
          participant.role
        );
      }
    } catch (err) {
      console.error(
        `Failed to upsert participant "${participant.email || participant.name}":`,
        err
      );
    }
  }
}

/**
 * Ensure a participant_links row exists (idempotent).
 */
export async function ensureParticipantLink(
  participantId: string,
  entityType: string,
  entityId: string,
  role: string | null
): Promise<void> {
  const db = getSupabaseClient();
  const { data: existing } = await db
    .from("participant_links")
    .select("id")
    .eq("participant_id", participantId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  if (!existing || existing.length === 0) {
    await db.from("participant_links").insert({
      participant_id: participantId,
      entity_type: entityType,
      entity_id: entityId,
      role,
    });
  }
}

// ============================================================
// Open items merge helper
// ============================================================

/**
 * Append new open items to an engagement, deduplicating by description.
 * Returns the merged array (existing + new), or null if nothing to add.
 */
export async function appendOpenItems(
  engagementId: string,
  newItems: OpenItem[]
): Promise<OpenItem[] | null> {
  if (newItems.length === 0) return null;

  const db = getSupabaseClient();
  const { data: existing } = await db
    .from("engagements")
    .select("open_items")
    .eq("id", engagementId)
    .maybeSingle();

  const existingItems: (OpenItem & { resolved?: boolean })[] =
    (existing?.open_items as (OpenItem & { resolved?: boolean })[]) ?? [];
  const existingDescs = new Set(
    existingItems.map((i) => i.description.toLowerCase())
  );
  const deduped = newItems.filter(
    (i) => !existingDescs.has(i.description.toLowerCase())
  );

  if (deduped.length === 0) return null;
  return [...existingItems, ...deduped];
}

// ============================================================
// Dashboard query helpers (continued)
// ============================================================

export async function getEngagementsWithMessageCounts(): Promise<
  (Engagement & { message_count: number })[]
> {
  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .select("*, messages(count)")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);

  return ((data ?? []) as (Engagement & { messages: { count: number }[] })[]).map(
    (row) => ({
      ...row,
      message_count: row.messages?.[0]?.count ?? 0,
      messages: undefined as never,
    })
  );
}

/** @deprecated Use getEngagementsWithMessageCounts instead */
export const getInitiativesWithMessageCounts = getEngagementsWithMessageCounts;
