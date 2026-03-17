import { getSupabaseClient } from "./client";
import { Engagement, Message, Meeting, Participant, Pillar } from "../types";

export async function getActiveEngagements(): Promise<
  (Engagement & { partner_name: string | null })[]
> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("engagements")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);

  const engagements = (data ?? []) as Engagement[];

  // Resolve partner names via batch lookup
  const partnerIds = new Set<string>();
  for (const e of engagements) {
    if (e.partner_id) partnerIds.add(e.partner_id);
  }

  const partnerNames = new Map<string, string>();
  if (partnerIds.size > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);
    for (const p of partners ?? []) {
      const row = p as { id: string; name: string };
      partnerNames.set(row.id, row.name);
    }
  }

  return engagements.map((e) => ({
    ...e,
    partner_name: e.partner_id ? partnerNames.get(e.partner_id) ?? null : null,
  }));
}

export async function getAllEngagements(): Promise<
  (Engagement & { partner_name: string | null })[]
> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("engagements")
    .select("*")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);

  const engagements = (data ?? []) as Engagement[];

  // Resolve partner names via batch lookup
  const partnerIds = new Set<string>();
  for (const e of engagements) {
    if (e.partner_id) partnerIds.add(e.partner_id);
  }

  const partnerNames = new Map<string, string>();
  if (partnerIds.size > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);
    for (const p of partners ?? []) {
      const row = p as { id: string; name: string };
      partnerNames.set(row.id, row.name);
    }
  }

  return engagements.map((e) => ({
    ...e,
    partner_name: e.partner_id ? partnerNames.get(e.partner_id) ?? null : null,
  }));
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
  (Engagement & { message_count: number; partner_name: string | null })[]
> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("engagements")
    .select("*, messages(count)")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch engagements: ${error.message}`);

  const rows = ((data ?? []) as (Engagement & { messages: { count: number }[] })[]).map(
    (row) => ({
      ...row,
      message_count: row.messages?.[0]?.count ?? 0,
      messages: undefined as never,
    })
  );

  // Resolve partner names via batch lookup
  const partnerIds = new Set<string>();
  for (const r of rows) {
    if (r.partner_id) partnerIds.add(r.partner_id);
  }

  const partnerNames = new Map<string, string>();
  if (partnerIds.size > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);
    for (const p of partners ?? []) {
      const row = p as { id: string; name: string };
      partnerNames.set(row.id, row.name);
    }
  }

  return rows.map((r) => ({
    ...r,
    partner_name: r.partner_id ? partnerNames.get(r.partner_id) ?? null : null,
  }));
}

export async function createEngagement(data: {
  name: string;
  partner_name?: string | null;
  partner_id?: string | null;
  current_state?: string | null;
  topic?: string | null;
  goal?: string | null;
  pillar?: Pillar | null;
}): Promise<Engagement> {
  const db = getSupabaseClient();

  // Resolve partner_id: use explicit partner_id if provided, else resolve from partner_name
  let partnerId: string | null = data.partner_id ?? null;
  if (!partnerId && data.partner_name) {
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
    partner_id?: string | null;
    status?: Engagement["status"];
    current_state?: string | null;
    pillar?: Pillar | null;
  }
): Promise<Engagement> {
  const db = getSupabaseClient();
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.partner_id !== undefined) row.partner_id = updates.partner_id;
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

  // engagement_programs, engagement_events, engagement_participants
  // all cascade-deleted via FK ON DELETE CASCADE

  // Delete unresolved approvals referencing this engagement
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
    .from("engagement_participants")
    .select("id, role, participant:participants(*)")
    .eq("engagement_id", engagementId);

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
