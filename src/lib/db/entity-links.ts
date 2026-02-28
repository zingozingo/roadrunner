import { getSupabaseClient } from "./client";
import { EntityLink } from "../types";

export async function getEntityLinksForEntity(
  type: EntityLink["source_type"],
  id: string
): Promise<EntityLink[]> {
  const client = getSupabaseClient();

  const [asSource, asTarget] = await Promise.all([
    client
      .from("entity_links")
      .select("*")
      .eq("source_type", type)
      .eq("source_id", id),
    client
      .from("entity_links")
      .select("*")
      .eq("target_type", type)
      .eq("target_id", id),
  ]);

  if (asSource.error) throw new Error(`Failed to fetch entity links: ${asSource.error.message}`);
  if (asTarget.error) throw new Error(`Failed to fetch entity links: ${asTarget.error.message}`);

  return [...(asSource.data ?? []), ...(asTarget.data ?? [])] as EntityLink[];
}

export async function createEntityLink(link: {
  source_type: EntityLink["source_type"];
  source_id: string;
  target_type: EntityLink["target_type"];
  target_id: string;
  relationship: string;
  context: string | null;
}): Promise<void> {
  const db = getSupabaseClient();

  // Check for existing to avoid duplicates
  const { data: existing } = await db
    .from("entity_links")
    .select("id")
    .eq("source_type", link.source_type)
    .eq("source_id", link.source_id)
    .eq("target_type", link.target_type)
    .eq("target_id", link.target_id)
    .eq("relationship", link.relationship)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { error } = await db.from("entity_links").insert({
    ...link,
    created_by: "ai",
  });

  if (error) throw new Error(`Failed to create entity link: ${error.message}`);
}

/**
 * Resolve entity link target IDs to their display names.
 * Returns a map of entityId → name.
 */
export async function resolveEntityLinkNames(
  links: EntityLink[]
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (links.length === 0) return nameMap;

  const db = getSupabaseClient();

  // Collect unique IDs by type (both source and target)
  const idsByType: Record<string, Set<string>> = {
    engagement: new Set(),
    event: new Set(),
    program: new Set(),
  };
  for (const link of links) {
    idsByType[link.source_type]?.add(link.source_id);
    idsByType[link.target_type]?.add(link.target_id);
  }

  const tableMap: Record<string, string> = {
    engagement: "engagements",
    event: "events",
    program: "programs",
  };

  await Promise.all(
    Object.entries(idsByType).map(async ([type, ids]) => {
      if (ids.size === 0) return;
      const { data } = await db
        .from(tableMap[type])
        .select("id, name")
        .in("id", [...ids]);
      for (const row of (data ?? []) as { id: string; name: string }[]) {
        nameMap.set(row.id, row.name);
      }
    })
  );

  return nameMap;
}
