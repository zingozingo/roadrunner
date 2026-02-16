export const dynamic = "force-dynamic";

import { getAwsRelationshipsWithCounts } from "@/lib/supabase";
import RelationshipsClient from "./RelationshipsClient";

export default async function RelationshipsPage() {
  const relationships = await getAwsRelationshipsWithCounts();
  return <RelationshipsClient relationships={relationships} />;
}
