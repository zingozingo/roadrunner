export const dynamic = "force-dynamic";

import { getMeetingsWithEngagements } from "@/lib/db";
import MeetingsClient from "./MeetingsClient";

export default async function MeetingsPage() {
  const meetings = await getMeetingsWithEngagements();

  return <MeetingsClient meetings={meetings} />;
}
