import { getSupabaseClient } from "./client";
import type { PartnerContextEntry } from "../types";

export async function getPartnerContext(
  partnerId: string
): Promise<PartnerContextEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from("partner_context")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch partner context: ${error.message}`);
  return (data ?? []) as PartnerContextEntry[];
}

export async function addPartnerContext(input: {
  partner_id: string;
  content: string;
  source?: string;
}): Promise<PartnerContextEntry> {
  const { data, error } = await getSupabaseClient()
    .from("partner_context")
    .insert({
      partner_id: input.partner_id,
      content: input.content,
      source: input.source ?? "scratchpad",
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to add partner context: ${error.message}`);
  return data as PartnerContextEntry;
}

export async function deletePartnerContext(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("partner_context")
    .delete()
    .eq("id", id);

  if (error)
    throw new Error(`Failed to delete partner context: ${error.message}`);
}

/**
 * Get only scratchpad entries for a partner (excludes ai_synthesis and seed_dump).
 * Used by engagement synthesis (Call 1) for tribal knowledge context.
 */
export async function getPartnerScratchpad(
  partnerId: string
): Promise<{ content: string; created_at: string }[]> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("partner_context")
    .select("content, created_at")
    .eq("partner_id", partnerId)
    .eq("source", "scratchpad")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getPartnerScratchpad] Error:", error);
    return [];
  }

  return data ?? [];
}
