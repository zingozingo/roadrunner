export const dynamic = "force-dynamic";

import { getAllProgramsWithCounts } from "@/lib/supabase";
import TracksClient from "./TracksClient";

export default async function TracksPage() {
  const tracks = await getAllProgramsWithCounts();
  return <TracksClient tracks={tracks} />;
}
