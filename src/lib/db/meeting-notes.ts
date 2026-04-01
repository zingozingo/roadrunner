import { getSupabaseClient } from "./client";
import type {
  MeetingNote,
  MeetingNoteWithTasks,
  Task,
  CreateMeetingNoteInput,
  UpdateMeetingNoteInput,
  CreateTaskInput,
  UpdateTaskInput,
} from "../types";

// ============================================================
// Meeting Notes CRUD
// ============================================================

export async function createMeetingNote(
  input: CreateMeetingNoteInput
): Promise<MeetingNote> {
  const { data, error } = await getSupabaseClient()
    .from("meeting_notes")
    .insert({
      partner_id: input.partner_id,
      meeting_id: input.meeting_id ?? null,
      engagement_id: input.engagement_id ?? null,
      note_type: input.note_type ?? "meeting",
      title: input.title ?? null,
      meeting_date: input.meeting_date ?? null,
      date_range_start: input.date_range_start ?? null,
      date_range_end: input.date_range_end ?? null,
      raw_notes: input.raw_notes,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create meeting note: ${error.message}`);
  return data as MeetingNote;
}

export async function getMeetingNote(
  id: string
): Promise<MeetingNoteWithTasks | null> {
  const db = getSupabaseClient();

  const { data: note, error } = await db
    .from("meeting_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch meeting note: ${error.message}`);
  if (!note) return null;

  const typedNote = note as MeetingNote;

  // Fetch partner name
  const { data: partner } = await db
    .from("partners")
    .select("name")
    .eq("id", typedNote.partner_id)
    .maybeSingle();

  // Fetch tasks
  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .eq("meeting_note_id", id)
    .order("created_at", { ascending: true });

  if (tasksError)
    throw new Error(`Failed to fetch note tasks: ${tasksError.message}`);

  return {
    ...typedNote,
    tasks: (tasks ?? []) as Task[],
    partner_name: (partner as { name: string } | null)?.name,
  };
}

export async function getMeetingNoteByMeetingId(
  meetingId: string
): Promise<MeetingNoteWithTasks | null> {
  const db = getSupabaseClient();

  // Use order + limit instead of maybeSingle to handle rare duplicates gracefully
  const { data: notes, error } = await db
    .from("meeting_notes")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to fetch meeting note by meeting_id: ${error.message}`);
  const note = notes?.[0] ?? null;
  if (!note) return null;

  const typedNote = note as MeetingNote;

  // Fetch partner name
  const { data: partner } = await db
    .from("partners")
    .select("name")
    .eq("id", typedNote.partner_id)
    .maybeSingle();

  // Fetch tasks
  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .eq("meeting_note_id", typedNote.id)
    .order("created_at", { ascending: true });

  if (tasksError)
    throw new Error(`Failed to fetch note tasks: ${tasksError.message}`);

  return {
    ...typedNote,
    tasks: (tasks ?? []) as Task[],
    partner_name: (partner as { name: string } | null)?.name,
  };
}

export async function getMeetingNotesByPartner(
  partnerId: string,
  options?: { limit?: number; noteType?: "meeting" }
): Promise<MeetingNoteWithTasks[]> {
  const db = getSupabaseClient();

  let query = db
    .from("meeting_notes")
    .select("*")
    .eq("partner_id", partnerId)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  if (options?.noteType) {
    query = query.eq("note_type", options.noteType);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: notes, error } = await query;
  if (error)
    throw new Error(`Failed to fetch meeting notes: ${error.message}`);

  // Fetch partner name once
  const { data: partner } = await db
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .maybeSingle();
  const partnerName = (partner as { name: string } | null)?.name;

  // Fetch all tasks for these notes in one query
  const noteIds = ((notes ?? []) as MeetingNote[]).map((n) => n.id);
  let allTasks: Task[] = [];
  if (noteIds.length > 0) {
    const { data: tasks, error: tasksError } = await db
      .from("tasks")
      .select("*")
      .in("meeting_note_id", noteIds)
      .order("created_at", { ascending: true });

    if (tasksError)
      throw new Error(`Failed to fetch note tasks: ${tasksError.message}`);
    allTasks = (tasks ?? []) as Task[];
  }

  // Group tasks by note
  const tasksByNote = new Map<string, Task[]>();
  for (const task of allTasks) {
    if (!task.meeting_note_id) continue;
    const list = tasksByNote.get(task.meeting_note_id) ?? [];
    list.push(task);
    tasksByNote.set(task.meeting_note_id, list);
  }

  return ((notes ?? []) as MeetingNote[]).map((n) => ({
    ...n,
    tasks: tasksByNote.get(n.id) ?? [],
    partner_name: partnerName,
  }));
}

export async function updateMeetingNote(
  id: string,
  input: UpdateMeetingNoteInput
): Promise<MeetingNote> {
  const { data, error } = await getSupabaseClient()
    .from("meeting_notes")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update meeting note: ${error.message}`);
  return data as MeetingNote;
}

export async function deleteMeetingNote(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("meeting_notes")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete meeting note: ${error.message}`);
}

export async function listMeetingNotes(
  options?: {
    partnerId?: string;
    status?: string;
    noteType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ notes: MeetingNoteWithTasks[]; total: number }> {
  const db = getSupabaseClient();

  // Count query
  let countQuery = db
    .from("meeting_notes")
    .select("id", { count: "exact", head: true });

  // Data query
  let dataQuery = db
    .from("meeting_notes")
    .select("*")
    .order("meeting_date", { ascending: false, nullsFirst: false });

  // Apply filters to both
  if (options?.partnerId) {
    countQuery = countQuery.eq("partner_id", options.partnerId);
    dataQuery = dataQuery.eq("partner_id", options.partnerId);
  }
  if (options?.status) {
    countQuery = countQuery.eq("status", options.status);
    dataQuery = dataQuery.eq("status", options.status);
  }
  if (options?.noteType) {
    countQuery = countQuery.eq("note_type", options.noteType);
    dataQuery = dataQuery.eq("note_type", options.noteType);
  }
  if (options?.limit) {
    dataQuery = dataQuery.limit(options.limit);
  }
  if (options?.offset) {
    dataQuery = dataQuery.range(
      options.offset,
      options.offset + (options?.limit ?? 50) - 1
    );
  }

  const [{ count, error: countError }, { data: notes, error }] =
    await Promise.all([countQuery, dataQuery]);

  if (countError)
    throw new Error(`Failed to count meeting notes: ${countError.message}`);
  if (error)
    throw new Error(`Failed to list meeting notes: ${error.message}`);

  const typedNotes = (notes ?? []) as MeetingNote[];

  // Resolve partner names
  const partnerIds = [...new Set(typedNotes.map((n) => n.partner_id))];
  const partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", partnerIds);
    for (const p of (partners ?? []) as { id: string; name: string }[]) {
      partnerNames.set(p.id, p.name);
    }
  }

  // Fetch all tasks
  const noteIds = typedNotes.map((n) => n.id);
  let allTasks: Task[] = [];
  if (noteIds.length > 0) {
    const { data: tasks, error: tasksError } = await db
      .from("tasks")
      .select("*")
      .in("meeting_note_id", noteIds)
      .order("created_at", { ascending: true });

    if (tasksError)
      throw new Error(`Failed to fetch note tasks: ${tasksError.message}`);
    allTasks = (tasks ?? []) as Task[];
  }

  const tasksByNote = new Map<string, Task[]>();
  for (const task of allTasks) {
    if (!task.meeting_note_id) continue;
    const list = tasksByNote.get(task.meeting_note_id) ?? [];
    list.push(task);
    tasksByNote.set(task.meeting_note_id, list);
  }

  return {
    notes: typedNotes.map((n) => ({
      ...n,
      tasks: tasksByNote.get(n.id) ?? [],
      partner_name: partnerNames.get(n.partner_id),
    })),
    total: count ?? 0,
  };
}

// ============================================================
// Note Tasks CRUD
// ============================================================

export async function createTask(
  input: CreateTaskInput
): Promise<Task> {
  const { data, error } = await getSupabaseClient()
    .from("tasks")
    .insert({
      meeting_note_id: input.meeting_note_id,
      partner_id: input.partner_id,
      engagement_id: input.engagement_id ?? null,
      description: input.description,
      owner: input.owner,
      owner_name: input.owner_name ?? null,
      owner_participant_id: input.owner_participant_id ?? null,
      due_date: input.due_date ?? null,
      origin: input.origin ?? "manual",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return data as Task;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  const { data, error } = await getSupabaseClient()
    .from("tasks")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return data as Task;
}

export async function deleteAiTasksForNote(meetingNoteId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("tasks")
    .delete()
    .eq("meeting_note_id", meetingNoteId)
    .eq("origin", "ai_extracted");

  if (error) throw new Error(`Failed to delete AI tasks: ${error.message}`);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

export async function getTasksByPartner(
  partnerId: string,
  options?: { status?: "open" | "done" | "cancelled" }
): Promise<Task[]> {
  let query = getSupabaseClient()
    .from("tasks")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
  return (data ?? []) as Task[];
}

export async function getOpenTasks(): Promise<
  (Task & { partner_name: string | null; note_title: string | null; meeting_id: string | null; meeting_title: string | null; engagement_name: string | null })[]
> {
  const db = getSupabaseClient();

  const { data: tasks, error } = await db
    .from("tasks")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch open tasks: ${error.message}`);

  const typedTasks = (tasks ?? []) as Task[];
  if (typedTasks.length === 0) return [];

  // Resolve partner names
  const partnerIds = [...new Set(typedTasks.map((t) => t.partner_id))];
  const partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await db
      .from("partners")
      .select("id, name")
      .in("id", partnerIds);
    for (const p of (partners ?? []) as { id: string; name: string }[]) {
      partnerNames.set(p.id, p.name);
    }
  }

  // Resolve note titles + meeting_ids from meeting_notes
  const noteIds = [...new Set(typedTasks.map((t) => t.meeting_note_id).filter((id): id is string => id !== null))];
  const noteInfo = new Map<string, { title: string | null; meeting_id: string | null }>();
  if (noteIds.length > 0) {
    const { data: notes } = await db
      .from("meeting_notes")
      .select("id, title, meeting_id")
      .in("id", noteIds);
    for (const n of (notes ?? []) as { id: string; title: string | null; meeting_id: string | null }[]) {
      noteInfo.set(n.id, { title: n.title, meeting_id: n.meeting_id });
    }
  }

  // Resolve meeting titles from meetings table
  const meetingIds = [...new Set([...noteInfo.values()].map((n) => n.meeting_id).filter((id): id is string => id !== null))];
  const meetingTitles = new Map<string, string>();
  if (meetingIds.length > 0) {
    const { data: meetings } = await db
      .from("meetings")
      .select("id, title")
      .in("id", meetingIds);
    for (const m of (meetings ?? []) as { id: string; title: string | null }[]) {
      meetingTitles.set(m.id, m.title ?? "Untitled Meeting");
    }
  }

  // Resolve engagement names
  const engagementIds = [...new Set(typedTasks.map((t) => t.engagement_id).filter((id): id is string => id !== null))];
  const engagementNames = new Map<string, string>();
  if (engagementIds.length > 0) {
    const { data: engagements } = await db
      .from("engagements")
      .select("id, name")
      .in("id", engagementIds);
    for (const e of (engagements ?? []) as { id: string; name: string | null }[]) {
      engagementNames.set(e.id, e.name ?? "Untitled Engagement");
    }
  }

  return typedTasks.map((t) => {
    const note = t.meeting_note_id ? noteInfo.get(t.meeting_note_id) : null;
    const meetingId = note?.meeting_id ?? null;
    return {
      ...t,
      partner_name: partnerNames.get(t.partner_id) ?? null,
      note_title: note?.title ?? null,
      meeting_id: meetingId,
      meeting_title: meetingId ? meetingTitles.get(meetingId) ?? null : null,
      engagement_name: t.engagement_id ? engagementNames.get(t.engagement_id) ?? null : null,
    };
  });
}

// ============================================================
// Context helpers
// ============================================================

export async function getRecentNoteSummaries(
  partnerId: string,
  limit: number = 5
): Promise<{ title: string | null; meeting_date: string | null; ai_summary: string }[]> {
  const db = getSupabaseClient();

  // Seed notes first (foundational), then meeting notes by date desc
  const { data, error } = await db
    .from("meeting_notes")
    .select("title, meeting_date, ai_summary, note_type")
    .eq("partner_id", partnerId)
    .eq("status", "complete")
    .not("ai_summary", "is", null)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error)
    throw new Error(`Failed to fetch note summaries: ${error.message}`);

  return ((data ?? []) as { title: string | null; meeting_date: string | null; ai_summary: string }[]).map(
    ({ title, meeting_date, ai_summary }) => ({ title, meeting_date, ai_summary })
  );
}

/**
 * Get condensed meeting digests for meetings linked to a specific engagement.
 * Returns only notes with non-null condensed field.
 * Used by engagement synthesis (Call 1) to include meeting outcomes in context.
 */
export async function getCondensedDigestsByEngagement(
  engagementId: string
): Promise<{ title: string; meeting_date: string | null; condensed: string }[]> {
  const db = getSupabaseClient();

  // meeting_notes has meeting_id; meetings has engagement_id
  // Inner join: only notes whose linked meeting belongs to this engagement
  const { data: notes, error } = await db
    .from("meeting_notes")
    .select("title, meeting_date, condensed, meetings!inner(engagement_id)")
    .eq("meetings.engagement_id", engagementId)
    .not("condensed", "is", null)
    .order("meeting_date", { ascending: false });

  if (error) {
    console.error("[getCondensedDigestsByEngagement] Error:", error);
    return [];
  }

  return (notes ?? []).map((n: { title: string; meeting_date: string | null; condensed: string }) => ({
    title: n.title,
    meeting_date: n.meeting_date,
    condensed: n.condensed,
  }));
}

/**
 * Get condensed meeting digests for standalone meetings (no engagement link).
 * These are meetings like partner cadences and unlinked executive meetings
 * that feed directly into partner brain synthesis (Call 3), not through
 * the engagement layer.
 */
export async function getStandaloneCondensedDigests(
  partnerId: string
): Promise<{ title: string; meeting_date: string | null; condensed: string }[]> {
  const db = getSupabaseClient();

  // meeting_notes has meeting_id; we need notes where the linked meeting
  // has NO engagement_id (standalone). Join through meetings table.
  const { data: notes, error } = await db
    .from("meeting_notes")
    .select("title, meeting_date, condensed, meetings!inner(engagement_id)")
    .eq("partner_id", partnerId)
    .not("condensed", "is", null)
    .order("meeting_date", { ascending: false });

  if (error) {
    console.error("[getStandaloneCondensedDigests] Error:", error);
    return [];
  }

  // Filter to standalone meetings (no engagement link)
  return ((notes ?? []) as unknown as { title: string; meeting_date: string | null; condensed: string; meetings: { engagement_id: string | null } }[])
    .filter((n) => !n.meetings?.engagement_id)
    .map(n => ({
      title: n.title,
      meeting_date: n.meeting_date,
      condensed: n.condensed,
    }));
}
