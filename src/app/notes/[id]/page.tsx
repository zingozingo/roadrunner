"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { MeetingNoteWithTasks, NoteTask } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/20 text-zinc-400",
  complete: "bg-emerald-500/20 text-emerald-400",
};

const OWNER_LABELS: Record<string, string> = {
  me: "My Tasks",
  partner: "Partner Tasks",
  aws_internal: "AWS Internal",
};

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<MeetingNoteWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRawNotes, setShowRawNotes] = useState(false);

  // New task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState<"me" | "partner" | "aws_internal">("me");
  const [newTaskDue, setNewTaskDue] = useState("");

  const fetchNote = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error("Failed to load note");
      const data = await res.json();
      setNote(data.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted">Loading...</div>;
  if (error || !note) return <div className="p-6 lg:p-8 text-sm text-red-400">{error ?? "Note not found"}</div>;

  const openTasks = note.tasks.filter((t) => t.status === "open");

  // Group tasks by owner
  const taskGroups = new Map<string, NoteTask[]>();
  for (const t of note.tasks) {
    const group = taskGroups.get(t.owner) ?? [];
    group.push(t);
    taskGroups.set(t.owner, group);
  }

  const dateDisplay = note.meeting_date
    ? new Date(note.meeting_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })
    : note.date_range_start
      ? `${note.date_range_start} — ${note.date_range_end ?? "present"}`
      : "No date";

  async function handleSaveSummary() {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_summary: summaryDraft }),
    });
    if (res.ok) {
      setEditingSummary(false);
      fetchNote();
    }
  }

  async function handleSaveTitle() {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    if (res.ok) {
      setEditingTitle(false);
      fetchNote();
    }
  }

  async function handleSummarize() {
    if (note?.status !== "draft" && !confirm("This will overwrite the current summary. Continue?")) return;
    setSummarizing(true);
    try {
      const res = await fetch(`/api/notes/${id}/summarize`, { method: "POST" });
      if (!res.ok) throw new Error("Summarization failed");
      await fetchNote();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to summarize");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.push("/notes");
  }

  async function handleToggleTask(task: NoteTask) {
    const newStatus = task.status === "open" ? "done" : "open";
    await fetch(`/api/notes/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchNote();
  }

  async function handleDeleteTask(taskId: string) {
    await fetch(`/api/notes/tasks/${taskId}`, { method: "DELETE" });
    fetchNote();
  }

  async function handleAddTask() {
    if (!newTaskDesc.trim()) return;
    await fetch(`/api/notes/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: newTaskDesc.trim(),
        owner: newTaskOwner,
        due_date: newTaskDue || null,
      }),
    });
    setNewTaskDesc("");
    setNewTaskDue("");
    setShowTaskForm(false);
    fetchNote();
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/notes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Notes
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Title */}
            <div className="flex items-center gap-2 flex-wrap">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-1 text-lg font-bold text-foreground focus:border-accent focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  />
                  <button onClick={handleSaveTitle} className="text-xs text-accent hover:underline">Save</button>
                  <button onClick={() => setEditingTitle(false)} className="text-xs text-muted hover:underline">Cancel</button>
                </div>
              ) : (
                <h1
                  className="text-xl font-bold text-foreground cursor-pointer hover:text-accent transition-colors"
                  onClick={() => { setTitleDraft(note.title ?? ""); setEditingTitle(true); }}
                  title="Click to edit title"
                >
                  {note.title ?? "Untitled"}
                </h1>
              )}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[note.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {note.status}
              </span>
              {note.note_type === "seed" && (
                <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
                  SEED
                </span>
              )}
            </div>

            {/* Metadata */}
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-muted">Date</span>
                <p className="text-foreground">{dateDisplay}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Partner</span>
                <p>
                  <Link href={`/partners/${note.partner_id}`} className="text-accent hover:underline">
                    {note.partner_name ?? "Unknown"}
                  </Link>
                </p>
              </div>
              {note.engagement_id && (
                <div>
                  <span className="text-xs text-muted">Engagement</span>
                  <p>
                    <Link href={`/engagements/${note.engagement_id}`} className="text-accent hover:underline">
                      View engagement
                    </Link>
                  </p>
                </div>
              )}
              {note.meeting_id && (
                <div>
                  <span className="text-xs text-muted">Meeting</span>
                  <p>
                    <Link href={`/meetings/${note.meeting_id}`} className="text-accent hover:underline">
                      View meeting
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-red-400 transition-colors hover:border-red-500 hover:text-red-300"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        {/* Left column — content */}
        <div className="space-y-6">
          {/* Raw notes */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <button
              onClick={() => setShowRawNotes(!showRawNotes)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Raw Notes</h2>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
                className={`text-muted transition-transform ${showRawNotes ? "rotate-180" : ""}`}
              >
                <path d="M3 5l4 4 4-4" />
              </svg>
            </button>
            {showRawNotes && (
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                {note.raw_notes}
              </pre>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Summary</h2>
              <div className="flex items-center gap-2">
                {note.ai_summary && !editingSummary && (
                  <button
                    onClick={() => { setSummaryDraft(note.ai_summary ?? ""); setEditingSummary(true); }}
                    className="text-xs text-accent hover:underline"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={handleSummarize}
                  disabled={summarizing}
                  className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {summarizing ? "Summarizing..." : note.ai_summary ? "Re-summarize" : "Summarize"}
                </button>
              </div>
            </div>

            {editingSummary ? (
              <div className="space-y-2">
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none resize-y"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveSummary} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">Save</button>
                  <button onClick={() => setEditingSummary(false)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted hover:text-foreground">Cancel</button>
                </div>
              </div>
            ) : note.ai_summary ? (
              <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {note.ai_summary}
              </div>
            ) : (
              <p className="text-sm text-muted">No summary yet. Click &ldquo;Summarize&rdquo; to generate one with AI.</p>
            )}
          </div>
        </div>

        {/* Right column — tasks */}
        <div className="space-y-6">
          {/* Action Items */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Action Items{openTasks.length > 0 && ` (${openTasks.length} open)`}
              </h2>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="text-xs text-accent hover:underline"
              >
                {showTaskForm ? "Cancel" : "+ Add"}
              </button>
            </div>

            {/* Add task form */}
            {showTaskForm && (
              <div className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3">
                <input
                  type="text"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Task description..."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newTaskOwner}
                    onChange={(e) => setNewTaskOwner(e.target.value as typeof newTaskOwner)}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="me">Me</option>
                    <option value="partner">Partner</option>
                    <option value="aws_internal">AWS Internal</option>
                  </select>
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={handleAddTask}
                    className="ml-auto rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Task groups */}
            {note.tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks yet</p>
            ) : (
              <div className="space-y-4">
                {(["me", "partner", "aws_internal"] as const).map((ownerKey) => {
                  const tasks = taskGroups.get(ownerKey);
                  if (!tasks || tasks.length === 0) return null;
                  return (
                    <div key={ownerKey}>
                      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                        {OWNER_LABELS[ownerKey]}
                      </h3>
                      <div className="space-y-1">
                        {tasks.map((t) => (
                          <div key={t.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                            <button
                              onClick={() => handleToggleTask(t)}
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
                              onClick={() => handleDeleteTask(t.id)}
                              className="shrink-0 text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                              title="Delete task"
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
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted">
        Created {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        {note.updated_at !== note.created_at && (
          <> · Updated {new Date(note.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
        )}
      </p>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
              <h3 className="text-lg font-bold text-foreground">Delete Note</h3>
              <p className="mt-2 text-sm text-muted">
                This will permanently delete this note and all its tasks. This cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground hover:border-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
