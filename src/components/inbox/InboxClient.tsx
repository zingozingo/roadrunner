"use client";

import { useState } from "react";
import type { InboxItem } from "@/lib/db/inbox";

interface Props {
  items: InboxItem[];
}

interface EngagementOption {
  id: string;
  name: string;
}

export default function InboxClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"none" | "assign" | "create">("none");
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEngagements, setLoadingEngagements] = useState(false);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-text-tertiary)]">
        <p className="text-lg">Inbox is empty</p>
        <p className="text-sm mt-1">Forward emails to your Relay address to see them here</p>
      </div>
    );
  }

  async function handleDiscard(messageId: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, action: "discard" }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== messageId));
      }
    } catch (err) {
      console.error("Discard failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function startAssign(item: InboxItem) {
    setActiveItem(item.id);
    setActionMode("assign");
    setLoadingEngagements(true);
    try {
      // Fetch engagements filtered by partner
      const url = item.partner_id
        ? `/api/engagements?partner_id=${item.partner_id}`
        : "/api/engagements";
      const res = await fetch(url);
      const data = await res.json();
      setEngagements(
        (data.engagements ?? data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch engagements:", err);
    } finally {
      setLoadingEngagements(false);
    }
  }

  function startCreate(item: InboxItem) {
    setActiveItem(item.id);
    setActionMode("create");
    const partnerPrefix = item.partner_name ? `${item.partner_name} - ` : "";
    const cleanedSubject = cleanSubject(item.subject);
    setNewTitle(`${partnerPrefix}${cleanedSubject}`);
  }

  function cancelAction() {
    setActiveItem(null);
    setActionMode("none");
    setEngagements([]);
    setNewTitle("");
  }

  async function confirmAssign(messageId: string, engagementId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          action: "assign_existing",
          engagement_id: engagementId,
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== messageId));
        cancelAction();
      }
    } catch (err) {
      console.error("Assign failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmCreate(messageId: string) {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          action: "create_new",
          title: newTitle.trim(),
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== messageId));
        cancelAction();
      }
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-border-hover)] transition-colors"
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                {item.partner_name && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                    {item.partner_name}
                  </span>
                )}
                {!item.partner_name && item.partner_id === null && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                    Unknown Partner
                  </span>
                )}
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(item.forwarded_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {item.subject || "(no subject)"}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                From: {item.sender_name || item.sender_email || "Unknown"}
              </p>
              {item.body_text && (
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1 line-clamp-2">
                  {item.body_text.slice(0, 200)}
                </p>
              )}
            </div>

            {/* Action buttons — only show when not in action mode for this item */}
            {activeItem !== item.id && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => startAssign(item)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  Assign
                </button>
                <button
                  onClick={() => startCreate(item)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  New
                </button>
                <button
                  onClick={() => handleDiscard(item.id)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Discard
                </button>
              </div>
            )}
          </div>

          {/* Assign to existing — engagement picker */}
          {activeItem === item.id && actionMode === "assign" && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Assign to engagement{item.partner_name ? ` (${item.partner_name})` : ""}
                </span>
                <button
                  onClick={cancelAction}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
              </div>
              {loadingEngagements ? (
                <p className="text-xs text-[var(--color-text-tertiary)]">Loading engagements...</p>
              ) : engagements.length === 0 ? (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  No existing engagements for this partner.{" "}
                  <button
                    onClick={() => startCreate(item)}
                    className="text-blue-400 hover:underline"
                  >
                    Create new instead?
                  </button>
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {engagements.map((eng) => (
                    <button
                      key={eng.id}
                      onClick={() => confirmAssign(item.id, eng.id)}
                      disabled={loading}
                      className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors"
                    >
                      {eng.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create new engagement */}
          {activeItem === item.id && actionMode === "create" && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Create new engagement
                </span>
                <button
                  onClick={cancelAction}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Engagement title"
                  className="flex-1 text-sm px-3 py-1.5 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && confirmCreate(item.id)}
                  autoFocus
                />
                <button
                  onClick={() => confirmCreate(item.id)}
                  disabled={loading || !newTitle.trim()}
                  className="text-xs px-4 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
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
