export const dynamic = "force-dynamic";

import { getEngagementsWithMessageCounts } from "@/lib/db";
import EngagementsClient from "./EngagementsClient";

export default async function EngagementsPage() {
  const engagements = await getEngagementsWithMessageCounts();
  return <EngagementsClient engagements={engagements} />;
}
