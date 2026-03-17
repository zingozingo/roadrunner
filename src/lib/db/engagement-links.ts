import { getSupabaseClient } from "./client";
import { EngagementProgram, EngagementEvent } from "../types";

// ============================================================
// Programs
// ============================================================

export async function getEngagementPrograms(
  engagementId: string
): Promise<EngagementProgram[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagement_programs")
    .select("*, programs(name)")
    .eq("engagement_id", engagementId);

  if (error) throw new Error(`Failed to fetch engagement programs: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    program_name: (row.programs as { name: string } | null)?.name ?? null,
    programs: undefined,
  })) as unknown as EngagementProgram[];
}

export async function getProgramEngagements(
  programId: string
): Promise<EngagementProgram[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagement_programs")
    .select("*, engagements(name)")
    .eq("program_id", programId);

  if (error) throw new Error(`Failed to fetch program engagements: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    engagement_name: (row.engagements as { name: string } | null)?.name ?? null,
    engagements: undefined,
  })) as unknown as EngagementProgram[];
}

export async function linkEngagementToProgram(
  engagementId: string,
  programId: string,
  context?: string,
  createdBy: "ai" | "user" = "ai"
): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db.from("engagement_programs").upsert(
    {
      engagement_id: engagementId,
      program_id: programId,
      context: context ?? null,
      created_by: createdBy,
    },
    { onConflict: "engagement_id,program_id" }
  );

  if (error) throw new Error(`Failed to link engagement to program: ${error.message}`);
}

export async function unlinkEngagementFromProgram(
  engagementId: string,
  programId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("engagement_programs")
    .delete()
    .eq("engagement_id", engagementId)
    .eq("program_id", programId);

  if (error) throw new Error(`Failed to unlink engagement from program: ${error.message}`);
}

// ============================================================
// Events
// ============================================================

export async function getEngagementEvents(
  engagementId: string
): Promise<EngagementEvent[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagement_events")
    .select("*, events(name)")
    .eq("engagement_id", engagementId);

  if (error) throw new Error(`Failed to fetch engagement events: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    event_name: (row.events as { name: string } | null)?.name ?? null,
    events: undefined,
  })) as unknown as EngagementEvent[];
}

export async function getEventEngagements(
  eventId: string
): Promise<EngagementEvent[]> {
  const { data, error } = await getSupabaseClient()
    .from("engagement_events")
    .select("*, engagements(name)")
    .eq("event_id", eventId);

  if (error) throw new Error(`Failed to fetch event engagements: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    engagement_name: (row.engagements as { name: string } | null)?.name ?? null,
    engagements: undefined,
  })) as unknown as EngagementEvent[];
}

export async function linkEngagementToEvent(
  engagementId: string,
  eventId: string,
  context?: string,
  createdBy: "ai" | "user" = "ai"
): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db.from("engagement_events").upsert(
    {
      engagement_id: engagementId,
      event_id: eventId,
      context: context ?? null,
      created_by: createdBy,
    },
    { onConflict: "engagement_id,event_id" }
  );

  if (error) throw new Error(`Failed to link engagement to event: ${error.message}`);
}

export async function unlinkEngagementFromEvent(
  engagementId: string,
  eventId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("engagement_events")
    .delete()
    .eq("engagement_id", engagementId)
    .eq("event_id", eventId);

  if (error) throw new Error(`Failed to unlink engagement from event: ${error.message}`);
}
