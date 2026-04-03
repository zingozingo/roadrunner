export const dynamic = "force-dynamic";

import { getEngagementsWithMessageCounts } from "@/lib/db";
import { getPartners } from "@/lib/db";
import EngagementsClient from "./EngagementsClient";

export default async function EngagementsPage() {
  const [engagements, partners] = await Promise.all([
    getEngagementsWithMessageCounts(),
    getPartners(),
  ]);

  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  return <EngagementsClient engagements={engagements} partnerOptions={partnerOptions} />;
}
