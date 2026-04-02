"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { INBOX_GROUP_WINDOW_MS, type InboxItem } from "@/lib/db/inbox";
import EmptyState from "@/components/layout/EmptyState";
import InlineError from "@/components/shared/InlineError";

interface Props {
  items: InboxItem[];
}

interface EngagementOption {
  id: string;
  name: string;
}

interface PartnerOption {
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

    if (Math.abs(currTime - prevTime) <= INBOX_GROUP_WINDOW_MS) {
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
  const [actionMode, setActionMode] = useState<"none" | "assign" | "create" | "pick-partner">("none");
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loadingEngagements, setLoadingEngagements] = useState(false);

  // Per-action loading and error state
  const [busyAction, setBusyAction] = useState<string | null>(null); // "discard:{key}" | "assign:{engId}" | "create:{key}" | "partner:{partnerId}"
  const [actionError, setActionError] = useState<string | null>(null);

  // Partner picker state — cached across interactions
  const partnersCache = useRef<PartnerOption[] | null>(null);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnerFilter, setPartnerFilter] = useState("");

  const groups = useMemo(() => groupByForwardedAt(items), [items]);

  const clearError = useCallback(() => setActionError(null), []);

  if (groups.length === 0) {
    return <EmptyState title="Inbox is empty" description="Forward emails to your Relay address to see them here" />;
  }

  function removeGroup(groupKey: string) {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    const idsToRemove = new Set(group.items.map((i) => i.id));
    setItems((prev) => prev.filter((item) => !idsToRemove.has(item.id)));
  }

  function restoreGroup(snapshot: InboxItem[]) {
    setItems((prev) => [...prev, ...snapshot]);
  }

  // ── Discard (Class 3 — Destructive + Scoped) ──────────────
  async function handleDiscard(groupKey: string) {
    if (!confirm("Delete this message group? This cannot be undone.")) return;

    const group = groups.find((g) => g.key === groupKey);
    const snapshot = group ? [...group.items] : [];

    setBusyAction(`discard:${groupKey}`);
    setActionError(null);
    removeGroup(groupKey);

    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: groupKey, action: "discard" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Discard failed (${res.status})`);
      }
    } catch (err) {
      console.error("Discard failed:", err);
      restoreGroup(snapshot);
      setActionError(err instanceof Error ? err.message : "Discard failed");
    } finally {
      setBusyAction(null);
    }
  }

  // ── Start Assign (fetch engagements) ──────────────────────
  async function startAssign(group: InboxGroup) {
    const item = group.primary;
    if (!item.partner_id) return;
    setActiveGroup(group.key);
    setActionMode("assign");
    setActionError(null);
    setLoadingEngagements(true);
    try {
      const res = await fetch(`/api/engagements?partner_id=${item.partner_id}`);
      const data = await res.json();
      setEngagements(
        (data.engagements ?? []).map((e: any) => ({ id: e.id, name: e.name }))
      );
    } catch (err) {
      console.error("Failed to fetch engagements:", err);
      setActionError("Failed to load engagements");
    } finally {
      setLoadingEngagements(false);
    }
  }

  function startCreate(group: InboxGroup) {
    const item = group.primary;
    setActiveGroup(group.key);
    setActionMode("create");
    setActionError(null);
    const partnerPrefix = item.partner_name ? `${item.partner_name} - ` : "";
    setNewTitle(`${partnerPrefix}${cleanSubject(item.subject)}`);
  }

  // ── Pick Partner (fetch + select) ─────────────────────────
  async function startPickPartner(group: InboxGroup) {
    setActiveGroup(group.key);
    setActionMode("pick-partner");
    setPartnerFilter("");
    setActionError(null);

    // Use cache if available
    if (partnersCache.current) {
      setPartners(partnersCache.current);
      return;
    }

    setLoadingPartners(true);
    try {
      const res = await fetch("/api/partners");
      const data = await res.json();
      const list: PartnerOption[] = (data.partners ?? data ?? [])
        .map((p: any) => ({ id: p.id, name: p.name }))
        .sort((a: PartnerOption, b: PartnerOption) => a.name.localeCompare(b.name));
      partnersCache.current = list;
      setPartners(list);
    } catch (err) {
      console.error("Failed to fetch partners:", err);
      setActionError("Failed to load partners");
    } finally {
      setLoadingPartners(false);
    }
  }

  // ── Confirm Pick Partner (Class 2 — Async Submit) ─────────
  async function confirmPickPartner(groupKey: string, partnerId: string, partnerName: string) {
    setBusyAction(`partner:${partnerId}`);
    setActionError(null);
    try {
      const res = await fetch("/api/inbox/set-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: groupKey, partner_id: partnerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Set partner failed (${res.status})`);
      }
      // Update local state — stamp partner on all items in this group
      const group = groups.find((g) => g.key === groupKey);
      if (group) {
        const groupIds = new Set(group.items.map((i) => i.id));
        setItems((prev) =>
          prev.map((item) =>
            groupIds.has(item.id)
              ? { ...item, partner_id: partnerId, partner_name: partnerName }
              : item
          )
        );
      }
      cancelAction();
    } catch (err) {
      console.error("Set partner failed:", err);
      setActionError(err instanceof Error ? err.message : "Failed to set partner");
    } finally {
      setBusyAction(null);
    }
  }

  function cancelAction() {
    setActiveGroup(null);
    setActionMode("none");
    setEngagements([]);
    setNewTitle("");
    setPartnerFilter("");
    setActionError(null);
  }

  // ── Confirm Assign (Class 2 — Async Submit) ──────────────
  async function confirmAssign(groupKey: string, engagementId: string) {
    setBusyAction(`assign:${engagementId}`);
    setActionError(null);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Assign failed (${res.status})`);
      }
      removeGroup(groupKey);
      cancelAction();
    } catch (err) {
      console.error("Assign failed:", err);
      setActionError(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setBusyAction(null);
    }
  }

  // ── Confirm Create (Class 2 — Async Submit) ──────────────
  async function confirmCreate(groupKey: string) {
    if (!newTitle.trim()) return;
    setBusyAction(`create:${groupKey}`);
    setActionError(null);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Create failed (${res.status})`);
      }
      removeGroup(groupKey);
      cancelAction();
    } catch (err) {
      console.error("Create failed:", err);
      setActionError(err instanceof Error ? err.message : "Failed to create engagement");
    } finally {
      setBusyAction(null);
    }
  }

  const filteredPartners = partnerFilter
    ? partners.filter((p) => p.name.toLowerCase().includes(partnerFilter.toLowerCase()))
    : partners;

  const isBusy = busyAction !== null;

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
          const isDiscarding = busyAction === `discard:${group.key}`;
          const isCreating = busyAction === `create:${group.key}`;
          const showError = actionError && activeGroup === group.key;
          // Show discard errors on the group that was being discarded
          const showDiscardError = actionError && busyAction === null && !activeGroup && group.items.some((i) => i.id === group.key);

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
                      <button
                        onClick={() => startPickPartner(group)}
                        disabled={isBusy}
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 whitespace-nowrap hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                      >
                        Pick Partner
                      </button>
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
                        disabled={isBusy}
                        className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Assign
                      </button>
                    ) : null}
                    {item.partner_id ? (
                      <button
                        onClick={() => startCreate(group)}
                        disabled={isBusy}
                        className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                      >
                        New
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleDiscard(group.key)}
                      disabled={isBusy}
                      className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-50 min-w-[60px]"
                    >
                      {isDiscarding ? "Discarding..." : "Discard"}
                    </button>
                  </div>
                )}
              </div>

              {/* Inline error for this group */}
              {showError && (
                <div className="mt-2">
                  <InlineError message={actionError} onDismiss={clearError} />
                </div>
              )}

              {/* Partner picker panel */}
              {activeGroup === group.key && actionMode === "pick-partner" && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">
                      Select partner
                    </span>
                    <button
                      onClick={cancelAction}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {loadingPartners ? (
                    <p className="text-xs text-muted">Loading partners...</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={partnerFilter}
                        onChange={(e) => setPartnerFilter(e.target.value)}
                        placeholder="Filter partners..."
                        className="w-full bg-transparent border-b border-border/30 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none py-1 mb-2"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto">
                        {filteredPartners.map((p) => {
                          const isSettingThis = busyAction === `partner:${p.id}`;
                          return (
                            <button
                              key={p.id}
                              onClick={() => confirmPickPartner(group.key, p.id, p.name)}
                              disabled={isBusy}
                              className="w-full text-left flex items-baseline gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 disabled:opacity-50"
                            >
                              <span className="text-sm font-medium text-foreground">
                                {isSettingThis ? "Setting..." : p.name}
                              </span>
                            </button>
                          );
                        })}
                        {filteredPartners.length === 0 && (
                          <p className="text-xs text-muted px-3 py-2">No matches</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

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
                    <p className="text-xs text-muted">Loading engagements...</p>
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
                      {engagements.map((eng) => {
                        const isAssigningThis = busyAction === `assign:${eng.id}`;
                        return (
                          <button
                            key={eng.id}
                            onClick={() => confirmAssign(group.key, eng.id)}
                            disabled={isBusy}
                            className="w-full text-left flex items-baseline gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 disabled:opacity-50"
                          >
                            <span className="text-sm font-medium text-foreground">
                              {isAssigningThis ? "Assigning..." : eng.name}
                            </span>
                          </button>
                        );
                      })}
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
                      disabled={isBusy || !newTitle.trim()}
                      className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50 min-w-[60px]"
                    >
                      {isCreating ? "Creating..." : "Create"}
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
