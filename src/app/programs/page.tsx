export const dynamic = "force-dynamic";

import { getAllProgramsWithCounts } from "@/lib/db";
import ProgramsClient from "./ProgramsClient";

export default async function ProgramsPage() {
  const programs = await getAllProgramsWithCounts();
  return <ProgramsClient programs={programs} />;
}
