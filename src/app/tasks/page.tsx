export const dynamic = "force-dynamic";

import { getOpenTasks, getPartners } from "@/lib/db";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const [tasks, partners] = await Promise.all([
    getOpenTasks(),
    getPartners(),
  ]);

  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  return <TasksClient tasks={tasks} partners={partnerOptions} />;
}
