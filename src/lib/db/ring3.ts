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
    .select("*, programs(name)")
    .eq("partner_id", partnerId)
    .order("status", { ascending: true });
  if (error) throw new Error(`getPartnerProgramEnrollments: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    program_name: (row.programs as { name: string } | null)?.name ?? row.program_name ?? undefined,
    programs: undefined,
  }));
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
