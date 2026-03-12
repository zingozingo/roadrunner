export const dynamic = "force-dynamic";

import { getOpenTasks } from "@/lib/db";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const tasks = await getOpenTasks();
  return <TasksClient tasks={tasks} />;
}
