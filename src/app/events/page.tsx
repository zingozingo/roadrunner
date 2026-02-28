export const dynamic = "force-dynamic";

import { getAllEventsWithCounts } from "@/lib/db";
import EventsClient from "./EventsClient";

export default async function EventsPage() {
  const events = await getAllEventsWithCounts();
  return <EventsClient events={events} />;
}
