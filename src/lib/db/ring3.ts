/**
 * Ring 3 DB operations — Partner Goals, Program Enrollments,
 * Event Participations, MPOPP Funding, MDF Funding.
 * All upsert by airtable_id (ON CONFLICT DO UPDATE).
 */

import { getSupabaseClient } from "./client";
import type {
  PartnerGoal,
  PartnerProgramEnrollment,
  PartnerEventParticipation,
  PartnerFundingMpopp,
  PartnerFundingMdf,
} from "../types";

// ── Upsert functions ────────────────────────────────────────

type UpsertPartnerGoal = Omit<PartnerGoal, "id" | "created_at" | "updated_at">;

export async function upsertPartnerGoal(data: UpsertPartnerGoal): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("partner_goals")
    .upsert(data, { onConflict: "airtable_id" });
  if (error) throw new Error(`upsertPartnerGoal: ${error.message}`);
}

type UpsertPartnerProgramEnrollment = Omit<PartnerProgramEnrollment, "id" | "created_at" | "updated_at">;

export async function upsertPartnerProgramEnrollment(data: UpsertPartnerProgramEnrollment): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("partner_program_enrollments")
    .upsert(data, { onConflict: "airtable_id" });
  if (error) throw new Error(`upsertPartnerProgramEnrollment: ${error.message}`);
}

type UpsertPartnerEventParticipation = Omit<PartnerEventParticipation, "id" | "created_at" | "updated_at">;

export async function upsertPartnerEventParticipation(data: UpsertPartnerEventParticipation): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("partner_event_participations")
    .upsert(data, { onConflict: "airtable_id" });
  if (error) throw new Error(`upsertPartnerEventParticipation: ${error.message}`);
}

type UpsertMpoppFunding = Omit<PartnerFundingMpopp, "id" | "created_at" | "updated_at">;

export async function upsertMpoppFunding(data: UpsertMpoppFunding): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("partner_funding_mpopp")
    .upsert(data, { onConflict: "airtable_id" });
  if (error) throw new Error(`upsertMpoppFunding: ${error.message}`);
}

type UpsertMdfFunding = Omit<PartnerFundingMdf, "id" | "created_at" | "updated_at">;

export async function upsertMdfFunding(data: UpsertMdfFunding): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("partner_funding_mdf")
    .upsert(data, { onConflict: "airtable_id" });
  if (error) throw new Error(`upsertMdfFunding: ${error.message}`);
}

// ── CRUD functions (for API routes) ──────────────────────────

export async function createEnrollment(data: {
  partner_id: string;
  program_name: string;
  status: string;
  date_achieved?: string | null;
  notes?: string | null;
  program_id?: string | null;
}): Promise<PartnerProgramEnrollment> {
  const { data: enrollment, error } = await getSupabaseClient()
    .from("partner_program_enrollments")
    .insert({
      partner_id: data.partner_id,
      program_name: data.program_name,
      status: data.status,
      date_achieved: data.date_achieved ?? null,
      notes: data.notes ?? null,
      program_id: data.program_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return enrollment as PartnerProgramEnrollment;
}

export async function updateEnrollment(
  id: string,
  updates: Record<string, unknown>
): Promise<PartnerProgramEnrollment> {
  updates.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("partner_program_enrollments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as PartnerProgramEnrollment;
}

export async function deleteEnrollment(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("partner_program_enrollments")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function createEventParticipation(data: {
  partner_id: string;
  event_id: string;
  status: string;
  sponsoring?: boolean;
  notes?: string | null;
}): Promise<PartnerEventParticipation> {
  const { data: participation, error } = await getSupabaseClient()
    .from("partner_event_participations")
    .insert({
      partner_id: data.partner_id,
      event_id: data.event_id,
      status: data.status,
      sponsoring: data.sponsoring === true,
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return participation as PartnerEventParticipation;
}

export async function updateEventParticipation(
  id: string,
  updates: Record<string, unknown>
): Promise<PartnerEventParticipation> {
  updates.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("partner_event_participations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as PartnerEventParticipation;
}

export async function deleteEventParticipation(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("partner_event_participations")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ── Query functions (for partner detail page) ───────────────

export async function getPartnerGoals(partnerId: string): Promise<PartnerGoal[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("partner_goals")
    .select("*")
    .eq("partner_id", partnerId)
    .order("status", { ascending: true })
    .order("category", { ascending: true });
  if (error) throw new Error(`getPartnerGoals: ${error.message}`);
  return data ?? [];
}

export async function getPartnerProgramEnrollments(
  partnerId: string
): Promise<(PartnerProgramEnrollment & { program_name?: string })[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("partner_program_enrollments")
    .select("*, programs(name, category, mdf_value)")
    .eq("partner_id", partnerId)
    .order("status", { ascending: true });
  if (error) throw new Error(`getPartnerProgramEnrollments: ${error.message}`);
  return (data ?? []).map((row) => {
    const prog = row.programs as { name: string; category: string | null; mdf_value: number | null } | null;
    return {
      ...row,
      program_name: prog?.name ?? row.program_name ?? undefined,
      program_category: prog?.category ?? null,
      program_mdf_value: prog?.mdf_value ?? null,
      programs: undefined,
    };
  });
}

export async function getPartnerEventParticipations(
  partnerId: string
): Promise<(PartnerEventParticipation & { event_name?: string; event_start_date?: string | null })[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("partner_event_participations")
    .select("*, events(name, start_date)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPartnerEventParticipations: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    event_name: (row.events as { name: string; start_date: string | null } | null)?.name ?? undefined,
    event_start_date: (row.events as { name: string; start_date: string | null } | null)?.start_date ?? null,
    events: undefined,
  }));
}

export async function getPartnerMpoppFunding(partnerId: string): Promise<PartnerFundingMpopp[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("partner_funding_mpopp")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPartnerMpoppFunding: ${error.message}`);
  return data ?? [];
}

export async function getPartnerMdfFunding(partnerId: string): Promise<PartnerFundingMdf[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("partner_funding_mdf")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPartnerMdfFunding: ${error.message}`);
  return data ?? [];
}
