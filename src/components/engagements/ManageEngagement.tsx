"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Message, Meeting } from "@/lib/types";
import EngagementPicker from "@/components/shared/EngagementPicker";
import type { EngagementOption } from "@/components/shared/EngagementPicker";
import CreateEngagementForm from "@/components/shared/CreateEngagementForm";
import InlineError from "@/components/shared/InlineError";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

interface Props {
  engagementId: string;
  engagementName: string;
  partnerId: string;
  partnerName: string | null;
  messages: Message[];
  meetings: Meeting[];
  onClose: () => void;
}

/** Combined row — either a message or a standalone meeting */
interface ItemRow {
  id: string;
  type: "message" | "meeting";
  date: string;
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  bodyPreview?: string | null;
  title?: string;
  startTime?: string | null;
  endTime?: string | null;
  linkedMeetings: Meeting[];
}

function buildItemRows(messages: Message[], meetings: Meeting[]): ItemRow[] {
  const meetingsByMessageId = new Map<string, Meeting[]>();
  const standaloneMeetings: Meeting[] = [];

  for (const mtg of meetings) {
    if (mtg.message_id) {
      const list = meetingsByMessageId.get(mtg.message_id) ?? [];
      list.push(mtg);
      meetingsByMessageId.set(mtg.message_id, list);
    } else {
      standaloneMeetings.push(mtg);
    }
  }

  const rows: ItemRow[] = [];

  for (const msg of messages) {
    rows.push({
      id: msg.id,
      type: "message",
      date: msg.sent_at ?? msg.forwarded_at,
      subject: msg.subject,
      senderName: msg.sender_name,
      senderEmail: msg.sender_email,
      bodyPreview: msg.body_text?.replace(/\s+/g, " ").trim() ?? null,
      linkedMeetings: meetingsByMessageId.get(msg.id) ?? [],
    });
  }

  for (const mtg of standaloneMeetings) {
    rows.push({
      id: mtg.id,
      type: "meeting",
      date: mtg.meeting_date ? mtg.meeting_date + "T00:00:00" : mtg.created_at,
      title: mtg.title,
      startTime: mtg.start_time,
      endTime: mtg.end_time,
      linkedMeetings: [],
    });
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted/60">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2 5l6 4 6-4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted/60">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12" />
      <path d="M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ManageEngagement({
  engagementId,
  engagementName,
  partnerId,
  partnerName,
  messages,
  meetings,
  onClose,
}: Props) {
  const router = useRouter();
  const rows = useMemo(() => buildItemRows(messages, meetings), [messages, meetings]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMode, setActionMode] = useState<"none" | "pick_existing" | "create_new">("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLabel, setSubmitLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useNavigationGuard(isSubmitting);

  const selectableCount = rows.length;

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === selectableCount) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  const selectedMessageIds = rows
    .filter((r) => r.type === "message" && selected.has(r.id))
    .map((r) => r.id);
  const selectedMeetingIds = rows
    .filter((r) => r.type === "meeting" && selected.has(r.id))
    .map((r) => r.id);

  const selectionCount = selected.size;
  const allSelected = selectionCount === selectableCount && selectableCount > 0;

  function cancelActionMode() {
    setActionMode("none");
    setError(null);
  }

  // ── Execute reassignment API call ──────────────────────────
  async function executeReassign(body: Record<string, unknown>) {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIds: selectedMessageIds,
          meetingIds: selectedMeetingIds,
          ...body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Reassign failed (${res.status})`);
      }
      const result = await res.json();

      onClose();

      if (result.sourceDeleted) {
        // Source engagement was auto-deleted — redirect away
        router.push(partnerId ? `/partners/${partnerId}` : "/engagements");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reassignment failed");
    } finally {
      setIsSubmitting(false);
      setSubmitLabel("");
    }
  }

  // ── Move to existing ──────────────────────────────────────
  function handleMoveToExisting(engagement: EngagementOption) {
    setSubmitLabel(`Moving to ${engagement.name}...`);
    executeReassign({
      action: "move_to_existing",
      targetEngagementId: engagement.id,
    });
  }

  // ── Move to new ───────────────────────────────────────────
  function handleMoveToNew(title: string) {
    setSubmitLabel("Creating engagement and moving...");
    executeReassign({
      action: "move_to_new",
      newEngagementTitle: title,
    });
  }

  // ── Return to inbox ───────────────────────────────────────
  function handleReturnToInbox() {
    if (!confirm("Return selected items to inbox? They will need to be re-routed.")) return;
    setSubmitLabel("Returning to inbox...");
    executeReassign({ action: "return_to_inbox" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={isSubmitting ? undefined : onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col bg-surface rounded-lg border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              Manage Items
            </h2>
            <p className="text-sm text-muted mt-0.5 truncate">{engagementName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted hover:text-foreground transition-colors p-1 disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Select all header */}
        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/20 bg-surface-hover/30">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
          />
          <span className="text-xs text-muted">
            {selectionCount > 0
              ? `${selectionCount} item${selectionCount !== 1 ? "s" : ""} selected`
              : `${selectableCount} item${selectableCount !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted/60 text-center">
              No items in this engagement
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.id}>
                <label
                  className={`flex items-start gap-3 px-6 py-3 border-b border-border/20 cursor-pointer hover:bg-surface-hover/30 transition-colors ${
                    isSubmitting ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleItem(row.id)}
                    disabled={isSubmitting}
                    className="h-4 w-4 mt-0.5 rounded border-border accent-accent cursor-pointer shrink-0"
                  />

                  {row.type === "message" ? (
                    <>
                      <EmailIcon />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {row.subject || "(no subject)"}
                        </p>
                        {(row.senderName || row.senderEmail) && (
                          <p className="text-xs text-muted mt-0.5 truncate">
                            {row.senderName}{row.senderEmail && row.senderName ? ` <${row.senderEmail}>` : row.senderEmail}
                          </p>
                        )}
                        {row.bodyPreview && (
                          <p className="text-xs text-muted/60 mt-1 line-clamp-1">
                            {row.bodyPreview}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted shrink-0 mt-0.5">
                        {formatDate(row.date)}
                      </span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {row.title}
                        </p>
                        {(row.startTime || row.endTime) && (
                          <p className="text-xs text-muted/60 mt-0.5">
                            {formatTime(row.startTime)}
                            {row.startTime && row.endTime ? ` - ${formatTime(row.endTime)}` : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted shrink-0 mt-0.5">
                        {formatDate(row.date)}
                      </span>
                    </>
                  )}
                </label>

                {/* Linked meeting sub-items */}
                {row.linkedMeetings.map((mtg) => (
                  <div
                    key={mtg.id}
                    className="flex items-center gap-3 pl-[4.25rem] pr-6 py-2 border-b border-border/10 bg-surface-hover/10"
                  >
                    <CalendarIcon />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground/70 truncate">
                        {mtg.title}
                      </p>
                      <p className="text-[10px] text-muted/50 mt-0.5">
                        Linked meeting{selected.has(row.id) ? " — will move with email" : ""}
                      </p>
                    </div>
                    {mtg.meeting_date && (
                      <span className="text-[10px] text-muted/50 shrink-0">
                        {formatDate(mtg.meeting_date + "T00:00:00")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}

          {/* Picker / Create form shown below the list */}
          {actionMode === "pick_existing" && (
            <div className="px-6 pb-3">
              <EngagementPicker
                partnerId={partnerId}
                partnerName={partnerName ?? undefined}
                excludeIds={[engagementId]}
                onSelect={handleMoveToExisting}
                onCancel={cancelActionMode}
                onCreateNew={() => setActionMode("create_new")}
                disabled={isSubmitting}
              />
            </div>
          )}

          {actionMode === "create_new" && (
            <div className="px-6 pb-3">
              <CreateEngagementForm
                defaultTitle={`${partnerName ?? ""} - `}
                onCancel={cancelActionMode}
                onCreate={handleMoveToNew}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="px-6 py-2 border-t border-border/20">
            <InlineError message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Action bar */}
        {selectionCount > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30 bg-surface">
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Spinner />
                <span className="text-sm text-muted">{submitLabel}</span>
              </div>
            ) : (
              <>
                <span className="text-sm text-muted">
                  {selectionCount} item{selectionCount !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActionMode("pick_existing")}
                    className="bg-surface border border-border/50 text-foreground/70 rounded-md px-3 py-1.5 text-sm hover:bg-surface-hover hover:text-foreground transition-colors"
                  >
                    Move to Engagement
                  </button>
                  <button
                    onClick={() => setActionMode("create_new")}
                    className="bg-accent text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Move to New
                  </button>
                  <button
                    onClick={handleReturnToInbox}
                    className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5"
                  >
                    Return to Inbox
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
