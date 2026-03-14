import { getSupabaseClient } from "./client";
import { Relationship, Contact, Engagement } from "../types";

export async function getRelationships(): Promise<Relationship[]> {
  const { data, error } = await getSupabaseClient()
    .from("relationships")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as Relationship[];
}

export async function getRelationshipsWithCounts(): Promise<
  (Relationship & { linked_count: number })[]
> {
  const { data: relationships, error } = await getSupabaseClient()
    .from("relationships")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);

  const { data: junctions } = await getSupabaseClient()
    .from("engagement_relationships")
    .select("relationship_id");

  const linkCounts = new Map<string, number>();
  for (const j of junctions ?? []) {
    const row = j as { relationship_id: string };
    linkCounts.set(row.relationship_id, (linkCounts.get(row.relationship_id) ?? 0) + 1);
  }

  return ((relationships ?? []) as Relationship[]).map((r) => ({
    ...r,
    linked_count: linkCounts.get(r.id) ?? 0,
  }));
}

export async function getRelationship(id: string): Promise<Relationship | null> {
  const { data, error } = await getSupabaseClient()
    .from("relationships")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch relationship: ${error.message}`);
  return data as Relationship | null;
}

export async function getEngagementsByRelationship(
  relationshipId: string
): Promise<(Engagement & { partner_name: string | null })[]> {
  const db = getSupabaseClient();

  const { data: junctionRows, error: junctionErr } = await db
    .from("engagement_relationships")
    .select("engagement_id")
    .eq("relationship_id", relationshipId);

  if (junctionErr) throw new Error(`Failed to fetch junction: ${junctionErr.message}`);

  const ids = (junctionRows ?? []).map((r: { engagement_id: string }) => r.engagement_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("engagements")
    .select("*")
    .in("id", ids)
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

export async function updateRelationship(
  id: string,
  updates: {
    notes?: string | null;
    contacts?: Contact[] | null;
  }
): Promise<Relationship> {
  const { data, error } = await getSupabaseClient()
    .from("relationships")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update relationship: ${error.message}`);
  return data as Relationship;
}

export async function getRelationshipsByEngagement(engagementId: string): Promise<Relationship[]> {
  const db = getSupabaseClient();

  const { data: junctionRows, error: junctionErr } = await db
    .from("engagement_relationships")
    .select("relationship_id")
    .eq("engagement_id", engagementId);

  if (junctionErr) throw new Error(`Failed to fetch engagement relationships: ${junctionErr.message}`);

  const ids = (junctionRows ?? []).map((r: { relationship_id: string }) => r.relationship_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("relationships")
    .select("*")
    .in("id", ids)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as Relationship[];
}

export async function getRelationshipsByPartner(partnerId: string): Promise<Relationship[]> {
  const db = getSupabaseClient();

  // Get all engagement IDs for this partner
  const { data: engagements, error: engErr } = await db
    .from("engagements")
    .select("id")
    .eq("partner_id", partnerId);

  if (engErr) throw new Error(`Failed to fetch engagements: ${engErr.message}`);

  const engIds = (engagements ?? []).map((e: { id: string }) => e.id);
  if (engIds.length === 0) return [];

  // Get all relationship IDs from the junction table
  const { data: junctionRows, error: junctionErr } = await db
    .from("engagement_relationships")
    .select("relationship_id")
    .in("engagement_id", engIds);

  if (junctionErr) throw new Error(`Failed to fetch junction: ${junctionErr.message}`);

  const relIds = [...new Set((junctionRows ?? []).map((r: { relationship_id: string }) => r.relationship_id))];
  if (relIds.length === 0) return [];

  const { data, error } = await db
    .from("relationships")
    .select("*")
    .in("id", relIds)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as Relationship[];
}
