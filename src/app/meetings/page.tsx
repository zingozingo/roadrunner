export const dynamic = "force-dynamic";

import { getMeetingsWithEngagements, getPartners, getActiveEngagements } from "@/lib/db";
import MeetingsClient from "./MeetingsClient";

export default async function MeetingsPage() {
  const [meetings, partners, engagements] = await Promise.all([
    getMeetingsWithEngagements(),
    getPartners(),
    getActiveEngagements(),
  ]);

  return <MeetingsClient meetings={meetings} partners={partners} engagements={engagements} />;
}
