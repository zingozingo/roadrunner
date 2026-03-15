"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";

const OWNER_LABELS: Record<string, string> = {
  me: "My Tasks",
  partner: "Partner Tasks",
  internal: "Internal",
  third_party: "Third Party",
};

const OWNER_OPTIONS = [
  { value: "me", label: "Me" },
  { value: "internal", label: "Internal" },
  { value: "partner", label: "Partner" },
  { value: "third_party", label: "Third Party" },
];

interface PartnerTask extends Task {
  note_title: string;
}

interface PartnerTasksSectionProps {
  partnerId: string;
  tasks: PartnerTask[];
}

export default function PartnerTasksSection({ partnerId, tasks: initialTasks }: PartnerTasksSectionProps) {
  const [tasks, setTasks] = useState<PartnerTask[]>(initialTasks);

  // Add-task form state
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("me");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  function openForm() {
    setDescription("");
    setOwner("me");
    setDueDate("");
    setFormError(null);
    setShowForm(true);
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    setFormError(null);

    const body: Record<string, string> = {
      partner_id: partnerId,
      description: description.trim(),
      owner,
    };
    if (dueDate) body.due_date = dueDate;

    try {
      const res = await fetch("/api/notes/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed to create task (${res.status})`);
      }

      const { task } = await res.json();
      const newTask: PartnerTask = { ...task, note_title: "" };
      setTasks((prev) => [newTask, ...prev]);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Tasks{openCount > 0 && ` (${openCount} open)`}
        </h2>
        {!showForm && (
          <button
            onClick={openForm}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Inline add-task form */}
      {showForm && (
        <form onSubmit={handleAddTask} className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            required
            autoFocus
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            >
              {OWNER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </div>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
        </form>
      )}

      {tasks.length === 0 && !showForm ? (
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
