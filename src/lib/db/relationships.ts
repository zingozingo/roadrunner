import { getSupabaseClient } from "./client";
import { AwsRelationship, Contact, Engagement, Meeting } from "../types";

export async function getAwsRelationships(): Promise<AwsRelationship[]> {
  const { data, error } = await getSupabaseClient()
    .from("aws_relationships")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as AwsRelationship[];
}

export async function getAwsRelationshipsWithCounts(): Promise<
  (AwsRelationship & { linked_count: number })[]
> {
  const { data: relationships, error } = await getSupabaseClient()
    .from("aws_relationships")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);

  const { data: junctions } = await getSupabaseClient()
    .from("engagement_aws_relationships")
    .select("aws_relationship_id");

  const linkCounts = new Map<string, number>();
  for (const j of junctions ?? []) {
    const row = j as { aws_relationship_id: string };
    linkCounts.set(row.aws_relationship_id, (linkCounts.get(row.aws_relationship_id) ?? 0) + 1);
  }

  return ((relationships ?? []) as AwsRelationship[]).map((r) => ({
    ...r,
    linked_count: linkCounts.get(r.id) ?? 0,
  }));
}

export async function getAwsRelationship(id: string): Promise<AwsRelationship | null> {
  const { data, error } = await getSupabaseClient()
    .from("aws_relationships")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch relationship: ${error.message}`);
  return data as AwsRelationship | null;
}

export async function getEngagementsByAwsRelationship(relationshipId: string): Promise<Engagement[]> {
  const db = getSupabaseClient();

  const { data: junctionRows, error: junctionErr } = await db
    .from("engagement_aws_relationships")
    .select("engagement_id")
    .eq("aws_relationship_id", relationshipId);

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
  return (data ?? []) as Engagement[];
}

export async function updateAwsRelationship(
  id: string,
  updates: {
    notes?: string | null;
    contacts?: Contact[] | null;
  }
): Promise<AwsRelationship> {
  const { data, error } = await getSupabaseClient()
    .from("aws_relationships")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update relationship: ${error.message}`);
  return data as AwsRelationship;
}

export async function getAwsRelationshipsByMeeting(meetingId: string): Promise<AwsRelationship[]> {
  const db = getSupabaseClient();

  const { data: junctionRows, error: junctionErr } = await db
    .from("meeting_aws_relationships")
    .select("aws_relationship_id")
    .eq("meeting_id", meetingId);

  if (junctionErr) throw new Error(`Failed to fetch meeting relationships: ${junctionErr.message}`);

  const ids = (junctionRows ?? []).map((r: { aws_relationship_id: string }) => r.aws_relationship_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("aws_relationships")
    .select("*")
    .in("id", ids)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as AwsRelationship[];
}

export async function getAwsRelationshipsByEngagement(engagementId: string): Promise<AwsRelationship[]> {
  const db = getSupabaseClient();

  const { data: junctionRows, error: junctionErr } = await db
    .from("engagement_aws_relationships")
    .select("aws_relationship_id")
    .eq("engagement_id", engagementId);

  if (junctionErr) throw new Error(`Failed to fetch engagement relationships: ${junctionErr.message}`);

  const ids = (junctionRows ?? []).map((r: { aws_relationship_id: string }) => r.aws_relationship_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("aws_relationships")
    .select("*")
    .in("id", ids)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as AwsRelationship[];
}

export async function getAwsRelationshipsByPartner(partnerId: string): Promise<AwsRelationship[]> {
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
    .from("engagement_aws_relationships")
    .select("aws_relationship_id")
    .in("engagement_id", engIds);

  if (junctionErr) throw new Error(`Failed to fetch junction: ${junctionErr.message}`);

  const relIds = [...new Set((junctionRows ?? []).map((r: { aws_relationship_id: string }) => r.aws_relationship_id))];
  if (relIds.length === 0) return [];

  const { data, error } = await db
    .from("aws_relationships")
    .select("*")
    .in("id", relIds)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  return (data ?? []) as AwsRelationship[];
}
