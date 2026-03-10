import { getSupabaseClient } from "./client";
import { Event, Program, Engagement } from "../types";

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
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch programs: ${error.message}`);
  return data as Program[];
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
): Promise<(Engagement & { partner_name: string | null })[]> {
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

  const engagements = (data ?? []) as Engagement[];

  // Resolve partner names
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
// Program CRUD
// ============================================================

export async function getProgramById(id: string): Promise<Program | null> {
  const { data, error } = await getSupabaseClient()
    .from("programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch program: ${error.message}`);
  return data as Program | null;
}

export async function updateProgram(
  id: string,
  updates: {
    name?: string;
    type?: Program["type"];
    description?: string | null;
    requirements?: string | null;
    what_it_unlocks?: string | null;
    notes?: string | null;
  }
): Promise<Program> {
  const { data, error } = await getSupabaseClient()
    .from("programs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update program: ${error.message}`);
  return data as Program;
}

export async function deleteProgram(id: string): Promise<void> {
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

  // 2. Delete the program
  const { error: progErr } = await db
    .from("programs")
    .delete()
    .eq("id", id);
  if (progErr) throw new Error(`Failed to delete program: ${progErr.message}`);
}
