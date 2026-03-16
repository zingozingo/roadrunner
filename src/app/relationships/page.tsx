export const dynamic = "force-dynamic";

import { getRelationshipsWithCounts, getContactsByRelationshipBulk } from "@/lib/db";
import RelationshipsClient from "./RelationshipsClient";

export default async function RelationshipsPage() {
  const relationships = await getRelationshipsWithCounts();

  // Bulk-fetch registry contacts for all relationships (replaces JSONB rel.contacts reads)
  const relIds = relationships.map((r) => r.id);
  const contactsByRelationship = await getContactsByRelationshipBulk(relIds);

  // Serialize Map to plain object for client component
  const contactsMap: Record<string, { name: string | null; role: string | null }[]> = {};
  for (const [relId, contacts] of contactsByRelationship) {
    contactsMap[relId] = contacts.map((c) => ({ name: c.name, role: c.role }));
  }

  return <RelationshipsClient relationships={relationships} contactsByRelationship={contactsMap} />;
}
