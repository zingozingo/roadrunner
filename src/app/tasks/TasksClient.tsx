"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Task } from "@/lib/types";

type TaskWithContext = Task & { partner_name: string | null; note_title: string | null };

const OWNER_FILTER_OPTIONS = [
  { label: "Me", value: "me" },
  { label: "Internal", value: "internal" },
  { label: "Partner", value: "partner" },
  { label: "Third Party", value: "third_party" },
];

const OWNER_OPTIONS = [
  { label: "Me", value: "me" },
  { label: "Internal", value: "internal" },
  { label: "Partner", value: "partner" },
  { label: "Third Party", value: "third_party" },
];

interface TasksClientProps {
  tasks: TaskWithContext[];
  partners: { id: string; name: string }[];
}

export default function TasksClient({ tasks: initialTasks, partners }: TasksClientProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formPartnerId, setFormPartnerId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOwner, setFormOwner] = useState("me");
  const [formDueDate, setFormDueDate] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = task.description.toLowerCase().includes(q);
        const matchesPartner = task.partner_name?.toLowerCase().includes(q);
        const matchesOwner = task.owner_name?.toLowerCase().includes(q);
        const matchesNote = task.note_title?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesPartner && !matchesOwner && !matchesNote) return false;
      }
      if (activeFilter && task.owner !== activeFilter) return false;
      return true;
    });
  }, [tasks, searchQuery, activeFilter]);

  const partnerGroups = useMemo(() => {
    const groupMap = new Map<string, TaskWithContext[]>();

    for (const task of filteredTasks) {
      const key = task.partner_name ?? "Unassigned";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(task);
    }

    // Sort groups alphabetically, Unassigned last
    const entries = [...groupMap.entries()].sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });

    // Within each group: due_date tasks first (ascending), then no due_date
    for (const [, groupTasks] of entries) {
      groupTasks.sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return 0;
      });
    }

    return entries;
  }, [filteredTasks]);

  function resetForm() {
    setFormPartnerId("");
    setFormDescription("");
    setFormOwner("me");
    setFormDueDate("");
    setFormError(null);
  }

  async function handleCreate() {
    if (!formPartnerId || !formDescription.trim()) {
      setFormError("Partner and description are required");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/notes/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: formPartnerId,
          description: formDescription.trim(),
          owner: formOwner,
          due_date: formDueDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to create task (${res.status})`);
      }

      const { task: newTask } = await res.json();
      const partnerName = partners.find((p) => p.id === formPartnerId)?.name ?? null;

      setTasks((prev) => [
        ...prev,
        { ...newTask, partner_name: partnerName, note_title: null } as TaskWithContext,
      ]);

      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
  const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Tasks"
          subtitle={`${tasks.length} open task${tasks.length !== 1 ? "s" : ""}`}
        />
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          + Add Task
        </button>
      </div>

      {/* Create Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">New Task</h2>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Partner *</label>
                <select
                  value={formPartnerId}
                  onChange={(e) => setFormPartnerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a partner...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Description *</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What needs to be done?"
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Owner</label>
                  <select
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className={inputClass}
                  >
                    {OWNER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Due Date</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="No open tasks"
          description="Tasks will appear here as they are created from meeting notes"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search tasks..."
            filterOptions={OWNER_FILTER_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredTasks.length}
            totalCount={tasks.length}
            entityName="tasks"
          />

          {filteredTasks.length === 0 ? (
            <EmptyState
              title="No matching tasks"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {partnerGroups.map(([partnerName, groupTasks]) => (
                <section key={partnerName}>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {partnerName}
                    <span className="ml-2 text-sm font-normal text-muted">
                      ({groupTasks.length})
                    </span>
                  </h2>
                  {groupTasks.map((task) => {
                    const href = task.meeting_note_id
                      ? `/notes/${task.meeting_note_id}`
                      : `/partners/${task.partner_id}`;

                    return (
                      <Link
                        key={task.id}
                        href={href}
                        className="flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {task.description}
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs text-muted">
                          {task.due_date
                            ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : ""}
                        </span>
                        <span className={`w-20 shrink-0 text-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          task.owner === "me" ? "bg-accent/10 text-accent" :
                          task.owner === "partner" ? "bg-emerald-500/10 text-emerald-400" :
                          task.owner === "third_party" ? "bg-purple-500/10 text-purple-400" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>
                          {task.owner === "me" ? "Me" : task.owner === "partner" ? "Partner" : task.owner === "third_party" ? "3rd Party" : "Internal"}
                        </span>
                      </Link>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
