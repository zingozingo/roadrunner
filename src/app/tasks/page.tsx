export const dynamic = "force-dynamic";

import { getOpenTasks, getCompletedTasks, getPartners } from "@/lib/db";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const [tasks, completedTasks, partners] = await Promise.all([
    getOpenTasks(),
    getCompletedTasks(),
    getPartners(),
  ]);

  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  return <TasksClient tasks={tasks} completedTasks={completedTasks} partners={partnerOptions} />;
}
