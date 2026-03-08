export const dynamic = "force-dynamic";

import { listMeetingNotes } from "@/lib/db";
import { getPartners } from "@/lib/db";
import NotesClient from "./NotesClient";

export default async function NotesPage() {
  const [{ notes }, partners] = await Promise.all([
    listMeetingNotes({ limit: 100 }),
    getPartners(),
  ]);

  return (
    <NotesClient
      notes={notes}
      partners={partners.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
