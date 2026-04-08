import { getSupabaseClient } from "./client";
import { Partner } from "../types";

export async function getPartners(): Promise<Partner[]> {
  const { data, error } = await getSupabaseClient()
    .from("partners")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch partners: ${error.message}`);
  return (data ?? []) as Partner[];
}

export async function getPartner(id: string): Promise<Partner | null> {
  const { data, error } = await getSupabaseClient()
    .from("partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch partner: ${error.message}`);
  return data as Partner | null;
}

/** Resolve a partner name to its UUID (case-insensitive). Returns null if not found. */
export async function resolvePartnerByName(name: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from("partners")
    .select("id")
    .ilike("name", name.trim())
    .limit(1);

  if (error) throw new Error(`Failed to resolve partner by name: ${error.message}`);
  return data?.[0]?.id ?? null;
}

export async function getPartnerByName(name: string): Promise<Partner | null> {
  const { data, error } = await getSupabaseClient()
    .from("partners")
    .select("*")
    .ilike("name", name)
    .limit(1);

  if (error) throw new Error(`Failed to fetch partner by name: ${error.message}`);
  return data && data.length > 0 ? (data[0] as Partner) : null;
}
