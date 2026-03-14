"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";

const OWNER_LABELS: Record<string, string> = {
  me: "My Tasks",
  partner: "Partner Tasks",
  internal: "Internal",
  third_party: "Third Party",
};

interface PartnerTask extends Task {
  note_title: string;
}

interface PartnerTasksSectionProps {
  tasks: PartnerTask[];
}

export default function PartnerTasksSection({ tasks: initialTasks }: PartnerTasksSectionProps) {
  const [tasks, setTasks] = useState<PartnerTask[]>(initialTasks);

  const openCount = tasks.filter((t) => t.status === "open").length;

  // Group tasks by owner
  const taskGroups = new Map<string, PartnerTask[]>();
  for (const t of tasks) {
    const group = taskGroups.get(t.owner) ?? [];
    group.push(t);
    taskGroups.set(t.owner, group);
  }

  async function handleToggle(task: PartnerTask) {
    const newStatus = task.status === "open" ? "done" : "open";
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus as "open" | "done" } : t))
    );
    await fetch(`/api/notes/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Tasks{openCount > 0 && ` (${openCount} open)`}
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">No open tasks</p>
      ) : (
        <div className="space-y-4">
          {(["me", "internal", "partner", "third_party"] as const).map((ownerKey) => {
            const group = taskGroups.get(ownerKey);
            if (!group || group.length === 0) return null;
            return (
              <div key={ownerKey}>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  {OWNER_LABELS[ownerKey]}
                </h4>
                <div className="space-y-1">
                  {group.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-hover"
                    >
                      <button
                        onClick={() => handleToggle(t)}
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors ${
                          t.status === "done"
                            ? "border-emerald-500 bg-emerald-500/20"
                            : "border-border hover:border-accent"
                        }`}
                      >
                        {t.status === "done" && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-emerald-400"
                          >
                            <path d="M3 7l3 3 5-5" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            t.status === "done"
                              ? "text-muted line-through"
                              : "text-foreground"
                          }`}
                        >
                          {t.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          {t.owner_name && <span>{t.owner_name}</span>}
                          {t.due_date && <span>due {t.due_date}</span>}
                          {t.note_title && (
                            <span className="truncate">from: {t.note_title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
