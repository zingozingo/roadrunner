export const dynamic = "force-dynamic";

import { getMeetingsWithEngagements, getPartners, getActiveEngagements } from "@/lib/db";
import { getOverdueRecurringMeetings, spawnNextOccurrence } from "@/lib/meeting-recurrence";
import MeetingsClient from "./MeetingsClient";

export default async function MeetingsPage() {
  // Best-effort: spawn next occurrences for overdue recurring meetings
  try {
    const overdue = await getOverdueRecurringMeetings();
    await Promise.all(overdue.map((m) => spawnNextOccurrence(m)));
  } catch (err) {
    console.error("Auto-spawn recurring meetings failed:", err);
  }

  const [meetings, partners, engagements] = await Promise.all([
    getMeetingsWithEngagements(),
    getPartners(),
    getActiveEngagements(),
  ]);

  return <MeetingsClient meetings={meetings} partners={partners} engagements={engagements} />;
}
