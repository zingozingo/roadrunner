"use client";

import { useState, useMemo } from "react";
import type { InboxItem } from "@/lib/db/inbox";
import EmptyState from "@/components/layout/EmptyState";

interface Props {
  items: InboxItem[];
}

interface EngagementOption {
  id: string;
  name: string;
}

/** Group of messages from the same email forward (within 5s window) */
interface InboxGroup {
  key: string;        // first message id — used as group key + API id
  items: InboxItem[];
  primary: InboxItem; // first item — used for display
}

function groupByForwardedAt(items: InboxItem[]): InboxGroup[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => new Date(b.forwarded_at).getTime() - new Date(a.forwarded_at).getTime()
  );

  const groups: InboxGroup[] = [];
  let current: InboxItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].forwarded_at).getTime();
    const currTime = new Date(sorted[i].forwarded_at).getTime();

    if (Math.abs(currTime - prevTime) <= 5000) {
      current.push(sorted[i]);
    } else {
      groups.push(makeGroup(current));
      current = [sorted[i]];
    }
  }
  groups.push(makeGroup(current));

  return groups;
}

/** Pick the best representative message for display: prefer one with sender info */
function makeGroup(items: InboxItem[]): InboxGroup {
  const primary = items.find((i) => i.sender_name || i.sender_email) ?? items[0];
  return { key: items[0].id, items, primary };
}

export default function InboxClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"none" | "assign" | "create">("none");
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEngagements, setLoadingEngagements] = useState(false);

  const groups = useMemo(() => groupByForwardedAt(items), [items]);

  if (groups.length === 0) {
    return <EmptyState title="Inbox is empty" description="Forward emails to your Relay address to see them here" />;
  }

  function removeGroup(groupKey: string) {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    const idsToRemove = new Set(group.items.map((i) => i.id));
    setItems((prev) => prev.filter((item) => !idsToRemove.has(item.id)));
  }

  async function handleDiscard(groupKey: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: groupKey, action: "discard" }),
      });
      if (res.ok) removeGroup(groupKey);
    } catch (err) {
      console.error("Discard failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function startAssign(group: InboxGroup) {
    const item = group.primary;
    if (!item.partner_id) return; // guard — shouldn't be callable
    setActiveGroup(group.key);
    setActionMode("assign");
    setLoadingEngagements(true);
    try {
      const res = await fetch(`/api/engagements?partner_id=${item.partner_id}`);
      const data = await res.json();
      setEngagements(
        (data.engagements ?? []).map((e: any) => ({ id: e.id, name: e.name }))
      );
    } catch (err) {
      console.error("Failed to fetch engagements:", err);
    } finally {
      setLoadingEngagements(false);
    }
  }

  function startCreate(group: InboxGroup) {
    const item = group.primary;
    setActiveGroup(group.key);
    setActionMode("create");
    const partnerPrefix = item.partner_name ? `${item.partner_name} - ` : "";
    setNewTitle(`${partnerPrefix}${cleanSubject(item.subject)}`);
  }

  function cancelAction() {
    setActiveGroup(null);
    setActionMode("none");
    setEngagements([]);
    setNewTitle("");
  }

  async function confirmAssign(groupKey: string, engagementId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: groupKey,
          action: "assign_existing",
          engagement_id: engagementId,
        }),
      });
      if (res.ok) {
        removeGroup(groupKey);
        cancelAction();
      }
    } catch (err) {
      console.error("Assign failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmCreate(groupKey: string) {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: groupKey,
          action: "create_new",
          title: newTitle.trim(),
        }),
      });
      if (res.ok) {
        removeGroup(groupKey);
        cancelAction();
      }
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Unrouted Messages
        <span className="ml-1.5 font-normal text-muted/50">{groups.length}</span>
      </h2>

      <div>
        {groups.map((group) => {
          const item = group.primary;
          const count = group.items.length;

          return (
            <div
              key={group.key}
              className="border-b border-border/20 px-3 py-3 transition-colors hover:bg-surface/50"
            >
              {/* Main row */}
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {item.partner_name ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent whitespace-nowrap">
                        {item.partner_name}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 whitespace-nowrap">
                        Unknown Partner
                      </span>
                    )}
                    {count > 1 && (
                      <span className="text-xs text-muted/50">{count} messages</span>
                    )}
                    <span className="text-xs text-muted">
                      {new Date(item.forwarded_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.subject || "(no subject)"}
                  </p>
                  {(item.sender_name || item.sender_email) && (
                    <p className="text-xs text-muted mt-0.5">
                      {item.sender_name || item.sender_email}
                    </p>
                  )}
                </div>

                {/* Actions — only when not expanded */}
                {activeGroup !== group.key && (
                  <div className="flex items-center gap-3 shrink-0">
                    {item.partner_id ? (
                      <button
                        onClick={() => startAssign(group)}
                        disabled={loading}
                        className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Assign
                      </button>
                    ) : null}
                    <button
                      onClick={() => startCreate(group)}
                      disabled={loading}
                      className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                    >
                      New
                    </button>
                    <button
                      onClick={() => handleDiscard(group.key)}
                      disabled={loading}
                      className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>

              {/* Assign panel */}
              {activeGroup === group.key && actionMode === "assign" && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">
                      Assign to engagement{item.partner_name ? ` (${item.partner_name})` : ""}
                    </span>
                    <button
                      onClick={cancelAction}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {loadingEngagements ? (
                    <p className="text-xs text-muted">Loading...</p>
                  ) : engagements.length === 0 ? (
                    <p className="text-xs text-muted">
                      No existing engagements.{" "}
                      <button
                        onClick={() => startCreate(group)}
                        className="text-accent hover:underline"
                      >
                        Create new?
                      </button>
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      {engagements.map((eng) => (
                        <button
                          key={eng.id}
                          onClick={() => confirmAssign(group.key, eng.id)}
                          disabled={loading}
                          className="w-full text-left flex items-baseline gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                        >
                          <span className="text-sm font-medium text-foreground">{eng.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create panel */}
              {activeGroup === group.key && actionMode === "create" && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">
                      Create new engagement
                    </span>
                    <button
                      onClick={cancelAction}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Engagement title"
                      className="flex-1 bg-transparent border-b border-border/30 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none py-1"
                      onKeyDown={(e) => e.key === "Enter" && confirmCreate(group.key)}
                      autoFocus
                    />
                    <button
                      onClick={() => confirmCreate(group.key)}
                      disabled={loading || !newTitle.trim()}
                      className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                    >
                      {loading ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function cleanSubject(subject: string | null): string {
  if (!subject) return "New Engagement";
  return subject
    .replace(/^(RE|FW|FWD|Fwd|Re|Fw):\s*/gi, "")
    .replace(/^\[EXTERNAL\]\s*/i, "")
    .replace(/^\[.*?\]\s*/, "")
    .trim() || "New Engagement";
}
