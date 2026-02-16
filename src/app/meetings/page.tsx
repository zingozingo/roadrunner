export const dynamic = "force-dynamic";

import {
  getMeetingsWithEngagements,
  getAllEngagements,
  getAllEventsWithCounts,
} from "@/lib/supabase";
import MeetingsClient from "./MeetingsClient";

export default async function MeetingsPage() {
  const [meetings, engagements, events] = await Promise.all([
    getMeetingsWithEngagements(),
    getAllEngagements(),
    getAllEventsWithCounts(),
  ]);

  return (
    <MeetingsClient
      meetings={meetings}
      engagements={engagements}
      events={events}
    />
  );
}
