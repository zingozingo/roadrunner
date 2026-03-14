export const dynamic = "force-dynamic";

import { getRelationshipsWithCounts } from "@/lib/db";
import RelationshipsClient from "./RelationshipsClient";

export default async function RelationshipsPage() {
  const relationships = await getRelationshipsWithCounts();
  return <RelationshipsClient relationships={relationships} />;
}
