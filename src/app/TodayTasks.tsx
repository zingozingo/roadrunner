"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import InlineError from "@/components/shared/InlineError";
import type { Task } from "@/lib/types";

type TaskWithContext = Task & {
  partner_name: string | null;
  note_title: string | null;
  meeting_id: string | null;
  meeting_title: string | null;
  engagement_name: string | null;
};

export default function TodayTasks({
  tasks: initialTasks,
  today,
}: {
  tasks: TaskWithContext[];
  today: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async (taskId: string, currentStatus: string) => {
    setError(null);
    const newStatus = currentStatus === "open" ? "done" : "open";
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t
      )
    );
    try {
      const res = await fetch(`/api/notes/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: currentStatus as Task["status"] }
            : t
        )
      );
      setError("Failed to update task");
    }
  }, []);

  // Group tasks by partner
  const grouped = new Map<string, { name: string; id: string; tasks: typeof tasks }>();
  for (const task of tasks) {
    const key = task.partner_id;
    if (!grouped.has(key)) {
      grouped.set(key, { name: task.partner_name ?? "Unknown", id: key, tasks: [] });
    }
    grouped.get(key)!.tasks.push(task);
  }
  const groups = Array.from(grouped.values());

  return (
    <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
      {error && <div className="mb-2"><InlineError message={error} onDismiss={() => setError(null)} /></div>}
      {groups.map((group, gi) => (
        <div key={group.id}>
          {/* Partner group header */}
          <div className={`px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/40 ${gi > 0 ? "border-t border-border/30" : ""}`}>
            <Link href={`/partners/${group.id}`} className="hover:text-muted/60 transition-colors">
              {group.name}
            </Link>
          </div>
          {group.tasks.map((task, i) => {
            const isDone = task.status !== "open";
            const isOverdue = !!(task.due_date && task.due_date < today && !isDone);
            const isDueToday = task.due_date === today && !isDone;
            const threeDays = getDateOffset(today, 3);
            const isDueSoon =
              !!(task.due_date &&
              !isOverdue &&
              !isDueToday &&
              task.due_date <= threeDays &&
              !isDone);

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover ${
                  i < group.tasks.length - 1 ? "border-b border-border/20" : ""
                }${isDone ? " opacity-40" : ""}`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(task.id, task.status)}
                  className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isDone
                      ? "border-accent bg-accent"
                      : isOverdue
                        ? "border-status-blocked/60 hover:border-status-blocked"
                        : "border-border hover:border-accent"
                  }`}
                >
                  {isDone && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 5.5l2 2L7.5 3.5" />
                    </svg>
                  )}
                </button>

                {/* Description */}
                <span
                  className={`flex-1 min-w-0 text-sm truncate ${
                    isDone
                      ? "line-through text-muted"
                      : "text-foreground/80"
                  }`}
                >
                  {task.description}
                </span>

                {/* Due date */}
                {task.due_date && !isDone && (
                  <span
                    className={`shrink-0 text-[11px] font-medium ${
                      isOverdue
                        ? "text-status-blocked"
                        : isDueToday || isDueSoon
                          ? "text-status-blocked/70"
                          : "text-muted/60"
                    }`}
                  >
                    {formatDueDate(task.due_date, today)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatDueDate(date: string, today: string): string {
  if (date < today) {
    const d = new Date(date + "T12:00:00");
    return (
      "Overdue \u00b7 " +
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }
  if (date === today) return "Today";
  const tomorrow = getDateOffset(today, 1);
  if (date === tomorrow) return "Tomorrow";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDateOffset(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
