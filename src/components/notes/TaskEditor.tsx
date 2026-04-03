import { useState, useCallback } from "react";
import type { Task } from "@/lib/types";
import InlineError from "@/components/shared/InlineError";

const OWNER_LABELS: Record<string, string> = {
  me: "My Tasks",
  partner: "Partner Tasks",
  internal: "Internal",
  third_party: "Third Party",
};

interface ContactEntry {
  name: string | null;
  email: string | null;
  title: string | null;
  role: string | null;
  org_type: string | null;
}

interface TaskEditorProps {
  tasks: Task[];
  noteId: string;
  contacts?: ContactEntry[];
  onRefresh: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export default function TaskEditor({ tasks, noteId, contacts, onRefresh, onBusyChange }: TaskEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState<"me" | "internal" | "partner" | "third_party">("me");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Mutation state
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic state for toggles and deletes
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null);
  const displayTasks = optimisticTasks ?? tasks;

  const clearError = useCallback(() => setError(null), []);

  // Group tasks by owner
  const taskGroups = new Map<string, Task[]>();
  for (const t of displayTasks) {
    const group = taskGroups.get(t.owner) ?? [];
    group.push(t);
    taskGroups.set(t.owner, group);
  }

  const openCount = displayTasks.filter((t) => t.status === "open").length;

  // ── Add Task (Class 2 — Async Submit) ─────────────────────
  async function handleAddTask() {
    if (!desc.trim()) return;
    setAdding(true);
    setError(null);
    onBusyChange?.(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc.trim(), owner, owner_name: ownerName.trim() || null, due_date: dueDate || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Add task failed (${res.status})`);
      }
      setDesc("");
      setOwnerName("");
      setDueDate("");
      setShowForm(false);
      onRefresh();
    } catch (err) {
      console.error("Add task failed:", err);
      setError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAdding(false);
      onBusyChange?.(false);
    }
  }

  // ── Toggle Task (Class 1 — Optimistic Toggle) ────────────
  async function handleToggle(task: Task) {
    const newStatus = task.status === "open" ? "done" : "open";
    // Optimistic update
    setOptimisticTasks(
      displayTasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    try {
      const res = await fetch(`/api/notes/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Toggle failed (${res.status})`);
      setOptimisticTasks(null);
      onRefresh();
    } catch (err) {
      console.error("Toggle task failed:", err);
      setOptimisticTasks(null); // revert
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  // ── Delete Task (Class 3 — Destructive) ───────────────────
  async function handleDelete(task: Task) {
    if (!confirm(`Delete task: "${task.description}"?`)) return;
    // Optimistic removal with snapshot for revert
    const snapshot = [...displayTasks];
    setOptimisticTasks(displayTasks.filter((t) => t.id !== task.id));
    onBusyChange?.(true);
    try {
      const res = await fetch(`/api/notes/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setOptimisticTasks(null);
      onRefresh();
    } catch (err) {
      console.error("Delete task failed:", err);
      setOptimisticTasks(snapshot); // revert
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      onBusyChange?.(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tasks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Action Items{openCount > 0 && ` (${openCount} open)`}
          </h3>
          <button onClick={() => setShowForm(!showForm)} className="text-xs text-accent hover:underline">
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>

        {/* Inline error */}
        {error && (
          <div className="mb-3">
            <InlineError message={error} onDismiss={clearError} />
          </div>
        )}

        {showForm && (
          <div className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3">
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Task description..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !adding) handleAddTask(); }}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                value={owner}
                onChange={(e) => { setOwner(e.target.value as typeof owner); setOwnerName(""); }}
                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
              >
                <option value="me">Me</option>
                <option value="internal">Internal</option>
                <option value="partner">Partner</option>
                <option value="third_party">Third Party</option>
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleAddTask}
                disabled={adding || !desc.trim()}
                className="ml-auto rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
            {owner !== "me" && (
              <div className="flex items-center gap-2 flex-wrap">
                {contacts && (() => {
                  const picks: string[] = [];
                  const orgFilter = owner === "partner" ? "partner" : "internal";
                  for (const c of contacts) {
                    if (c.org_type === orgFilter && c.name && !picks.includes(c.name)) {
                      picks.push(c.name);
                    }
                  }
                  return picks.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setOwnerName(name)}
                      className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                        ownerName === name
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted hover:text-foreground hover:border-muted"
                      }`}
                    >
                      {name}
                    </button>
                  ));
                })()}
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Name (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-0.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {displayTasks.length === 0 ? (
          <p className="text-sm text-muted">No tasks yet</p>
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
                      <div key={t.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                        <button
                          onClick={() => handleToggle(t)}
                          className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors ${
                            t.status === "done"
                              ? "border-emerald-500 bg-emerald-500/20"
                              : "border-border hover:border-accent"
                          }`}
                        >
                          {t.status === "done" && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                              <path d="M3 7l3 3 5-5" />
                            </svg>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${t.status === "done" ? "text-muted line-through" : "text-foreground"}`}>
                            {t.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted">
                            {t.owner_name && <span>{t.owner_name}</span>}
                            {t.due_date && <span>due {t.due_date}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(t)}
                          className="shrink-0 text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 4l6 6M10 4l-6 6" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
