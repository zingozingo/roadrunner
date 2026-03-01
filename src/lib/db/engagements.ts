import { getSupabaseClient } from "./client";
import { Engagement, Message, Meeting, Participant, Pillar } from "../types";

export async function getActiveEngagements(): Promise<Engagement[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);
  return data as Engagement[];
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

export async function getEngagementById(id: string): Promise<Engagement | null> {
  const { data, error } = await getSupabaseClient()
    .from("engagements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch engagement: ${error.message}`);
  return data as Engagement | null;
}

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

export async function createEngagement(data: {
  name: string;
  partner_name?: string | null;
  current_state?: string | null;
  topic?: string | null;
  goal?: string | null;
  pillar?: Pillar | null;
}): Promise<Engagement> {
  const db = getSupabaseClient();

  // Resolve partner_id from partner_name (inline to avoid cross-module dep)
  let partnerId: string | null = null;
  if (data.partner_name) {
    const { data: partnerRows } = await db
      .from("partners")
      .select("id")
      .ilike("name", data.partner_name)
      .limit(1);
    if (partnerRows && partnerRows.length > 0) {
      partnerId = (partnerRows[0] as { id: string }).id;
    }
  }

  const { data: engagement, error } = await db
    .from("engagements")
    .insert({
      name: data.name,
      partner_name: data.partner_name ?? null,
      partner_id: partnerId,
      current_state: data.current_state ?? null,
      topic: data.topic ?? null,
      goal: data.goal ?? null,
      status: "active",
      pillar: data.pillar ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create engagement: ${error.message}`);
  return engagement as Engagement;
}

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

export async function updateEngagement(
  id: string,
  updates: {
    name?: string;
    partner_name?: string | null;
    status?: Engagement["status"];
    current_state?: string | null;
    pillar?: Pillar | null;
  }
): Promise<Engagement> {
  const db = getSupabaseClient();
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.partner_name !== undefined) {
    row.partner_name = updates.partner_name;
    // Re-resolve partner_id when partner_name changes (inline)
    if (updates.partner_name) {
      const { data: partnerRows } = await db
        .from("partners")
        .select("id")
        .ilike("name", updates.partner_name)
        .limit(1);
      row.partner_id = partnerRows && partnerRows.length > 0
        ? (partnerRows[0] as { id: string }).id
        : null;
    } else {
      row.partner_id = null;
    }
  }
  if (updates.current_state !== undefined) row.current_state = updates.current_state;
  if (updates.pillar !== undefined) row.pillar = updates.pillar;

  if (updates.status !== undefined) {
    row.status = updates.status;
    if (updates.status === "archived") {
      row.closed_at = new Date().toISOString();
    } else {
      row.closed_at = null;
    }
  }

  const { data, error } = await db
    .from("engagements")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update engagement: ${error.message}`);
  return data as Engagement;
}

export async function deleteEngagement(id: string): Promise<void> {
  const db = getSupabaseClient();

  // Delete from Airtable if synced (awaited to prevent serverless termination)
  const { data: eng } = await db
    .from("engagements")
    .select("airtable_record_id")
    .eq("id", id)
    .maybeSingle();

  if (eng?.airtable_record_id) {
    try {
      const { deleteEngagementFromAirtable } = await import("../sync");
      await deleteEngagementFromAirtable(eng.airtable_record_id);
    } catch (err) {
      console.error(`Airtable delete failed for engagement ${id}:`, err);
    }
  }

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

// ============================================================
// Dashboard query helpers
// ============================================================

export async function getMessagesByEngagement(id: string): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .eq("engagement_id", id)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return (data ?? []) as Message[];
}

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

// ============================================================
// Phase 2 context loader
// ============================================================

/**
 * Fetch full engagement history for Phase 2 classification.
 * Returns the engagement record plus all messages (chronological),
 * meetings, and participants with roles.
 */
export async function getEngagementHistory(engagementId: string): Promise<{
  engagement: Engagement;
  messages: Message[];
  meetings: Meeting[];
  participants: (Participant & { role: string | null })[];
} | null> {
  const engagement = await getEngagementById(engagementId);
  if (!engagement) return null;

  const db = getSupabaseClient();

  const [messages, meetings, participants] = await Promise.all([
    getMessagesByEngagement(engagementId).then((msgs) =>
      // Re-sort ASC (oldest first) — getMessagesByEngagement returns DESC
      msgs.sort((a, b) => {
        const aTime = a.sent_at ? new Date(a.sent_at).getTime() : 0;
        const bTime = b.sent_at ? new Date(b.sent_at).getTime() : 0;
        return aTime - bTime;
      })
    ),
    // Inline meeting query to avoid cross-module dep
    db
      .from("meetings")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) throw new Error(`Failed to fetch meetings: ${error.message}`);
        return (data ?? []) as Meeting[];
      }),
    getParticipantsByEngagement(engagementId).then((ps) =>
      // Strip linkId — Phase 2 doesn't need it
      ps.map(({ linkId: _, ...rest }) => rest)
    ),
  ]);

  return { engagement, messages, meetings, participants };
}
