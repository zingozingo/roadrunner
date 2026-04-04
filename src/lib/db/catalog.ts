import { getSupabaseClient } from "./client";
import { Event, Program } from "../types";

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

  return ((events ?? []) as Event[]).map((e) => ({
    ...e,
    linked_count: 0,
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

  return ((programs ?? []) as Program[]).map((p) => ({
    ...p,
    linked_count: 0,
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
    category?: Program["category"];
    subtype?: Program["subtype"];
    mdf_value?: number | null;
    sca_stackable?: boolean;
    partner_path?: string | null;
    parent_program_airtable_id?: string | null;
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

  const { error: progErr } = await db
    .from("programs")
    .delete()
    .eq("id", id);
  if (progErr) throw new Error(`Failed to delete program: ${progErr.message}`);
}
