"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Task } from "@/lib/types";
import { stripPartnerPrefix } from "@/lib/format-utils";

type TaskWithContext = Task & { partner_name: string | null; note_title: string | null; meeting_id: string | null; meeting_title: string | null; engagement_name: string | null };

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
  const [activeFilter, setActiveFilter] = useState<string | null>("me");
  const [groupByPartner, setGroupByPartner] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [linkingEngagements, setLinkingEngagements] = useState<{ id: string; name: string }[]>([]);
  const [linkingLoading, setLinkingLoading] = useState(false);

  // Form state
  const [formPartnerId, setFormPartnerId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOwner, setFormOwner] = useState("me");
  const [formDueDate, setFormDueDate] = useState("");
  const [formEngagementId, setFormEngagementId] = useState("");
  const [formEngagements, setFormEngagements] = useState<{ id: string; name: string }[]>([]);
  const [formEngagementsLoading, setFormEngagementsLoading] = useState(false);

  const openCount = useMemo(() => tasks.filter((t) => t.status === "open").length, [tasks]);

  async function handleToggleStatus(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "open" ? "done" : "open";
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t));
    try {
      const res = await fetch(`/api/notes/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update task status");
    } catch {
      // Revert on error
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: currentStatus as Task["status"] } : t));
    }
  }

  async function handleDelete(task: TaskWithContext) {
    if (!window.confirm(`Delete task: "${task.description}"?`)) return;
    // Optimistic removal
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      const res = await fetch(`/api/notes/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    } catch {
      // Revert on error
      setTasks((prev) => [...prev, task]);
    }
  }

  function startEditing(task: TaskWithContext) {
    setEditingTaskId(task.id);
    setEditingText(task.description);
  }

  async function saveEdit(taskId: string, originalDescription: string) {
    const trimmed = editingText.trim();
    setEditingTaskId(null);
    if (!trimmed || trimmed === originalDescription) return;
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, description: trimmed } : t));
    try {
      const res = await fetch(`/api/notes/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to update task");
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, description: originalDescription } : t));
    }
  }

  async function openEngagementLinker(task: TaskWithContext) {
    setLinkingTaskId(task.id);
    setLinkingLoading(true);
    try {
      const res = await fetch(`/api/engagements?partner_id=${task.partner_id}`);
      if (!res.ok) throw new Error("Failed to fetch engagements");
      const { engagements } = await res.json();
      setLinkingEngagements(engagements.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
    } catch {
      setLinkingEngagements([]);
    } finally {
      setLinkingLoading(false);
    }
  }

  async function handleLinkEngagement(taskId: string, engagementId: string | null, engagementName: string | null) {
    const prev = tasks.find((t) => t.id === taskId);
    setLinkingTaskId(null);
    // Optimistic update
    setTasks((ts) => ts.map((t) => t.id === taskId ? { ...t, engagement_id: engagementId, engagement_name: engagementName } : t));
    try {
      const res = await fetch(`/api/notes/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagement_id: engagementId }),
      });
      if (!res.ok) throw new Error("Failed to update engagement link");
    } catch {
      if (prev) setTasks((ts) => ts.map((t) => t.id === taskId ? { ...t, engagement_id: prev.engagement_id, engagement_name: prev.engagement_name } : t));
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Hide completed unless showCompleted is on
      if (task.status !== "open" && !showCompleted) return false;
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
  }, [tasks, searchQuery, activeFilter, showCompleted]);

  // Flat list sorted by recency (newest first), then completed at bottom
  const sortedFlatTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredTasks]);

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

    // Within each group: open tasks first, then completed. Within each: due_date ascending, then no due_date.
    for (const [, groupTasks] of entries) {
      groupTasks.sort((a, b) => {
        // Completed tasks sink to bottom
        if (a.status === "open" && b.status !== "open") return -1;
        if (a.status !== "open" && b.status === "open") return 1;
        // Then by due_date
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
    setFormEngagementId("");
    setFormEngagements([]);
    setFormError(null);
  }

  async function handleFormPartnerChange(partnerId: string) {
    setFormPartnerId(partnerId);
    setFormEngagementId("");
    setFormEngagements([]);
    if (!partnerId) return;
    setFormEngagementsLoading(true);
    try {
      const res = await fetch(`/api/engagements?partner_id=${partnerId}`);
      if (!res.ok) return;
      const { engagements } = await res.json();
      setFormEngagements(engagements.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
    } catch { /* ignore */ } finally {
      setFormEngagementsLoading(false);
    }
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
          engagement_id: formEngagementId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to create task (${res.status})`);
      }

      const { task: newTask } = await res.json();
      const partnerName = partners.find((p) => p.id === formPartnerId)?.name ?? null;
      const engName = formEngagements.find((e) => e.id === formEngagementId)?.name ?? null;

      setTasks((prev) => [
        ...prev,
        { ...newTask, partner_name: partnerName, note_title: null, meeting_id: null, meeting_title: null, engagement_name: engName } as TaskWithContext,
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

  function renderTaskRow(task: TaskWithContext) {
    const isDone = task.status !== "open";
    const isMe = task.owner === "me";

    return (
      <div
        key={task.id}
        className={`flex items-center gap-3 border-b border-border/20 px-3 py-3.5 transition-colors hover:bg-surface/50${isDone ? " opacity-50" : ""}`}
      >
        <button
          onClick={() => handleToggleStatus(task.id, task.status)}
          className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
            isDone
              ? "border-accent bg-accent text-white"
              : "border-border hover:border-accent"
          }`}
          aria-label={isDone ? "Reopen task" : "Complete task"}
        >
          {isDone && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          {editingTaskId === task.id ? (
            <input
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(task.id, task.description);
                if (e.key === "Escape") setEditingTaskId(null);
              }}
              onBlur={() => saveEdit(task.id, task.description)}
              className="w-full rounded border border-accent bg-background px-2 py-0.5 text-sm font-medium text-foreground outline-none"
            />
          ) : (
            <span
              onClick={() => startEditing(task)}
              className={`block truncate text-sm font-medium cursor-text ${isDone ? "text-muted line-through" : isMe ? "text-foreground" : "text-muted"}`}
            >
              {task.description}
            </span>
          )}
          <div className="flex items-center gap-2 empty:hidden">
            {!groupByPartner && task.partner_name && (
              <span className="text-xs text-muted/50">{task.partner_name}</span>
            )}
            {(() => {
              // Show engagement name if linked, else cleaned meeting title
              const contextLabel = task.engagement_id && task.engagement_name
                ? task.engagement_name
                : task.meeting_id && task.meeting_title
                  ? stripPartnerPrefix(task.meeting_title, task.partner_name)
                  : null;
              if (!contextLabel) return null;
              const href = task.engagement_id
                ? `/engagements/${task.engagement_id}`
                : `/meetings/${task.meeting_id}`;
              return (
                <>
                  {!groupByPartner && task.partner_name && <span className="text-xs text-muted/30">·</span>}
                  <Link href={href} className="truncate text-xs text-muted/60 hover:text-accent transition-colors">
                    {contextLabel}
                  </Link>
                </>
              );
            })()}
            {!task.engagement_id && (
              <button
                onClick={() => openEngagementLinker(task)}
                className="text-xs text-muted/40 hover:text-accent transition-colors"
              >
                + eng
              </button>
            )}
          </div>
          {linkingTaskId === task.id && (
            <div className="mt-1 rounded border border-border bg-background p-1.5">
              {linkingLoading ? (
                <span className="text-xs text-muted">Loading...</span>
              ) : linkingEngagements.length === 0 ? (
                <span className="text-xs text-muted">No engagements for this partner</span>
              ) : (
                <div className="space-y-0.5">
                  {task.engagement_id && (
                    <button
                      onClick={() => handleLinkEngagement(task.id, null, null)}
                      className="block w-full rounded px-2 py-1 text-left text-xs text-red-400 hover:bg-surface"
                    >
                      Unlink
                    </button>
                  )}
                  {linkingEngagements.map((eng) => (
                    <button
                      key={eng.id}
                      onClick={() => handleLinkEngagement(task.id, eng.id, eng.name)}
                      className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-surface transition-colors ${
                        eng.id === task.engagement_id ? "text-accent font-medium" : "text-foreground"
                      }`}
                    >
                      {eng.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setLinkingTaskId(null)}
                    className="block w-full rounded px-2 py-1 text-left text-xs text-muted hover:bg-surface"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
        <button
          onClick={() => handleDelete(task)}
          className="shrink-0 p-1 text-muted/30 hover:text-red-400 transition-colors"
          aria-label="Delete task"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <PageHeader
            title="Tasks"
            subtitle={`${openCount} open task${openCount !== 1 ? "s" : ""}${tasks.length - openCount > 0 ? ` · ${tasks.length - openCount} done` : ""}`}
          />
          {tasks.length - openCount > 0 && (
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="mt-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              {showCompleted ? "Hide completed" : "Show completed"}
            </button>
          )}
        </div>
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
                  onChange={(e) => handleFormPartnerChange(e.target.value)}
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

              {formPartnerId && (
                <div>
                  <label className={labelClass}>Engagement</label>
                  <select
                    value={formEngagementId}
                    onChange={(e) => setFormEngagementId(e.target.value)}
                    disabled={formEngagementsLoading}
                    className={inputClass}
                  >
                    <option value="">{formEngagementsLoading ? "Loading..." : "None"}</option>
                    {formEngagements.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

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
          <div className="flex items-center gap-3">
            <div className="flex-1">
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
            </div>
            <button
              onClick={() => setGroupByPartner((v) => !v)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                groupByPartner
                  ? "border-accent/50 text-accent bg-accent/5"
                  : "border-border/30 text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              Group by partner
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              title="No matching tasks"
              description="Try adjusting your search or filters"
            />
          ) : groupByPartner ? (
            <div className="space-y-8">
              {partnerGroups.map(([partnerName, groupTasks]) => (
                <section key={partnerName}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70">
                    {partnerName}
                    <span className="ml-1.5 font-normal text-muted/50">{groupTasks.length}</span>
                  </h2>
                  {groupTasks.map(renderTaskRow)}
                </section>
              ))}
            </div>
          ) : (
            <div>
              {sortedFlatTasks.map(renderTaskRow)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
