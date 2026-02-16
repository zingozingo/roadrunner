export const dynamic = "force-dynamic";

import {
  getMeetingsWithEngagements,
  getAllEngagements,
} from "@/lib/supabase";
import MeetingsClient from "./MeetingsClient";

export default async function MeetingsPage() {
  const [meetings, engagements] = await Promise.all([
    getMeetingsWithEngagements(),
    getAllEngagements(),
  ]);

  return (
    <MeetingsClient
      meetings={meetings}
      engagements={engagements}
    />
  );
}
