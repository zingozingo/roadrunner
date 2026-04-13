"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { INBOX_GROUP_WINDOW_MS, type InboxItem } from "@/lib/db/inbox";
import EmptyState from "@/components/layout/EmptyState";
import InlineError from "@/components/shared/InlineError";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

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

/** 16px inline spinner */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function InboxClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"none" | "assign" | "create" | "pick-partner">("none");
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loadingEngagements, setLoadingEngagements] = useState(false);

  // Per-group mutation state: which group is busy, with what status text
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [actionError, setActionError] = useState<{ groupKey: string; message: string } | null>(null);

  // Partner picker state — cached across interactions
  const partnersCache = useRef<PartnerOption[] | null>(null);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnerFilter, setPartnerFilter] = useState("");

  const groups = useMemo(() => groupByForwardedAt(items), [items]);

  // Navigation guard — blocks sidebar/back/reload during any mutation
  useNavigationGuard(busyGroup !== null);

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

    setBusyGroup(groupKey);
    setBusyLabel("Discarding...");
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
      setActionError({
        groupKey,
        message: err instanceof Error ? err.message : "Discard failed",
      });
    } finally {
      setBusyGroup(null);
      setBusyLabel("");
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
        (data.engagements ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))
      );
    } catch (err) {
      console.error("Failed to fetch engagements:", err);
      setActionError({
        groupKey: group.key,
        message: "Failed to load engagements",
      });
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

    if (partnersCache.current) {
      setPartners(partnersCache.current);
      return;
    }

    setLoadingPartners(true);
    try {
      const res = await fetch("/api/partners");
      const data = await res.json();
      const list: PartnerOption[] = (data.partners ?? data ?? [])
        .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        .sort((a: PartnerOption, b: PartnerOption) => a.name.localeCompare(b.name));
      partnersCache.current = list;
      setPartners(list);
    } catch (err) {
      console.error("Failed to fetch partners:", err);
      setActionError({
        groupKey: group.key,
        message: "Failed to load partners",
      });
    } finally {
      setLoadingPartners(false);
    }
  }

  // ── Confirm Pick Partner (Class 2 — Async Submit) ─────────
  async function confirmPickPartner(groupKey: string, partnerId: string, partnerName: string) {
    setBusyGroup(groupKey);
    setBusyLabel(`Setting partner to ${partnerName}...`);
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
      setActionError({
        groupKey,
        message: err instanceof Error ? err.message : "Failed to set partner",
      });
    } finally {
      setBusyGroup(null);
      setBusyLabel("");
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
  async function confirmAssign(groupKey: string, engagementId: string, engagementName: string) {
    setBusyGroup(groupKey);
    setBusyLabel(`Assigning to ${engagementName}...`);
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
      setActionError({
        groupKey,
        message: err instanceof Error ? err.message : "Failed to assign",
      });
    } finally {
      setBusyGroup(null);
      setBusyLabel("");
    }
  }

  // ── Confirm Create (Class 2 — Async Submit) ──────────────
  async function confirmCreate(groupKey: string) {
    if (!newTitle.trim()) return;
    setBusyGroup(groupKey);
    setBusyLabel("Creating engagement...");
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
      setActionError({
        groupKey,
        message: err instanceof Error ? err.message : "Failed to create engagement",
      });
    } finally {
      setBusyGroup(null);
      setBusyLabel("");
    }
  }

  const filteredPartners = partnerFilter
    ? partners.filter((p) => p.name.toLowerCase().includes(partnerFilter.toLowerCase()))
    : partners;

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
          const isBusy = busyGroup === group.key;
          const error = actionError?.groupKey === group.key ? actionError : null;

          return (
            <div
              key={group.key}
              className={`border-b border-border/20 px-3 py-3 transition-colors ${
                isBusy ? "opacity-60 pointer-events-none" : "hover:bg-surface/50"
              }`}
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
                        disabled={busyGroup !== null}
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
                  {item.body_text?.trim() && (
                    <p className="text-xs text-muted/60 mt-1 line-clamp-2">
                      {item.body_text.replace(/\s+/g, " ").trim()}
                    </p>
                  )}
                </div>

                {/* Row-level loading: spinner + status replaces action buttons */}
                {isBusy ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Spinner />
                    <span className="text-sm text-muted">{busyLabel}</span>
                  </div>
                ) : activeGroup !== group.key ? (
                  /* Action button group: safe → creation → destructive */
                  <div className="flex items-center gap-3 shrink-0">
                    {item.partner_id && (
                      <button
                        onClick={() => startAssign(group)}
                        disabled={busyGroup !== null}
                        className="text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50 min-h-[32px]"
                      >
                        Assign
                      </button>
                    )}
                    {item.partner_id && (
                      <button
                        onClick={() => startCreate(group)}
                        disabled={busyGroup !== null}
                        className="text-sm text-accent hover:text-accent-hover transition-colors disabled:opacity-50 min-h-[32px]"
                      >
                        New
                      </button>
                    )}
                    <button
                      onClick={() => handleDiscard(group.key)}
                      disabled={busyGroup !== null}
                      className="text-sm text-muted hover:text-red-400 transition-colors disabled:opacity-50 min-h-[32px]"
                    >
                      Discard
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Inline error for this group */}
              {error && (
                <div className="mt-2">
                  <InlineError message={error.message} onDismiss={clearError} />
                </div>
              )}

              {/* Partner picker panel */}
              {activeGroup === group.key && actionMode === "pick-partner" && !isBusy && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">
                      Select partner
                    </span>
                    <button
                      onClick={cancelAction}
                      className="text-sm text-muted hover:text-foreground transition-colors min-h-[32px]"
                    >
                      Cancel
                    </button>
                  </div>
                  {loadingPartners ? (
                    <div className="flex items-center gap-2 py-2">
                      <Spinner />
                      <span className="text-sm text-muted">Loading partners...</span>
                    </div>
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
                        {filteredPartners.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => confirmPickPartner(group.key, p.id, p.name)}
                            disabled={busyGroup !== null}
                            className="w-full text-left flex items-baseline gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 disabled:opacity-50"
                          >
                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                          </button>
                        ))}
                        {filteredPartners.length === 0 && (
                          <p className="text-xs text-muted px-3 py-2">No matches</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Assign panel */}
              {activeGroup === group.key && actionMode === "assign" && !isBusy && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">
                      Assign to engagement{item.partner_name ? ` (${item.partner_name})` : ""}
                    </span>
                    <button
                      onClick={cancelAction}
                      className="text-sm text-muted hover:text-foreground transition-colors min-h-[32px]"
                    >
                      Cancel
                    </button>
                  </div>
                  {loadingEngagements ? (
                    <div className="flex items-center gap-2 py-2">
                      <Spinner />
                      <span className="text-sm text-muted">Loading engagements...</span>
                    </div>
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
                          onClick={() => confirmAssign(group.key, eng.id, eng.name)}
                          disabled={busyGroup !== null}
                          className="w-full text-left flex items-baseline gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 disabled:opacity-50"
                        >
                          <span className="text-sm font-medium text-foreground">{eng.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create panel */}
              {activeGroup === group.key && actionMode === "create" && !isBusy && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted">
                      Create new engagement
                    </span>
                    <button
                      onClick={cancelAction}
                      className="text-sm text-muted hover:text-foreground transition-colors min-h-[32px]"
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
                      disabled={busyGroup !== null || !newTitle.trim()}
                      className="bg-accent text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      Create
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
