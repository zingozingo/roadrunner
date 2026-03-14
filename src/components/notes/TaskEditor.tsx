import { useState } from "react";
import type { Task } from "@/lib/types";

const OWNER_LABELS: Record<string, string> = {
  me: "My Tasks",
  partner: "Partner Tasks",
  internal: "Internal",
  third_party: "Third Party",
};

interface ContactInfo {
  alliance_lead: string | null;
  account_manager: string | null;
  psa: string | null;
  others: string[];
}

interface TaskEditorProps {
  tasks: Task[];
  noteId: string;
  contacts?: ContactInfo;
  onRefresh: () => void;
}

function extractName(contact: string | null): string | null {
  if (!contact) return null;
  const idx = contact.indexOf(" <");
  return idx > 0 ? contact.slice(0, idx) : contact;
}

export default function TaskEditor({ tasks, noteId, contacts, onRefresh }: TaskEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState<"me" | "internal" | "partner" | "third_party">("me");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Group tasks by owner
  const taskGroups = new Map<string, Task[]>();
  for (const t of tasks) {
    const group = taskGroups.get(t.owner) ?? [];
    group.push(t);
    taskGroups.set(t.owner, group);
  }

  const openCount = tasks.filter((t) => t.status === "open").length;

  async function handleAddTask() {
    if (!desc.trim()) return;
    await fetch(`/api/notes/${noteId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc.trim(), owner, owner_name: ownerName.trim() || null, due_date: dueDate || null }),
    });
    setDesc("");
    setOwnerName("");
    setDueDate("");
    setShowForm(false);
    onRefresh();
  }

  async function handleToggle(task: Task) {
    await fetch(`/api/notes/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "open" ? "done" : "open" }),
    });
    onRefresh();
  }

  async function handleDelete(taskId: string) {
    await fetch(`/api/notes/tasks/${taskId}`, { method: "DELETE" });
    onRefresh();
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

        {showForm && (
          <div className="mb-4 space-y-2 rounded-lg border border-border bg-background p-3">
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Task description..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
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
                className="ml-auto rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Add
              </button>
            </div>
            {owner !== "me" && (
              <div className="flex items-center gap-2 flex-wrap">
                {contacts && (() => {
                  const picks: string[] = [];
                  if (owner === "partner") {
                    const al = extractName(contacts.alliance_lead);
                    if (al) picks.push(al);
                    for (const o of contacts.others) {
                      const n = extractName(o);
                      if (n && !picks.includes(n)) picks.push(n);
                    }
                  } else {
                    const psa = extractName(contacts.psa);
                    if (psa) picks.push(psa);
                    const am = extractName(contacts.account_manager);
                    if (am) picks.push(am);
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

        {tasks.length === 0 ? (
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
                          onClick={() => handleDelete(t.id)}
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
