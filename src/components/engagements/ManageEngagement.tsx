"use client";

import { useState, useMemo } from "react";
import type { Message, Meeting } from "@/lib/types";

interface Props {
  messages: Message[];
  meetings: Meeting[];
  engagementName: string;
  onClose: () => void;
  onMove: (params: {
    messageIds: string[];
    meetingIds: string[];
    action: "move_to_existing" | "move_to_new" | "return_to_inbox";
    targetEngagementId?: string;
    newEngagementTitle?: string;
  }) => Promise<void>;
}

/** Combined row — either a message or a standalone meeting */
interface ItemRow {
  id: string;
  type: "message" | "meeting";
  date: string;
  // Message fields
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  bodyPreview?: string | null;
  // Meeting fields
  title?: string;
  startTime?: string | null;
  endTime?: string | null;
  // Linked meetings (sub-items of a message, not independently selectable)
  linkedMeetings: Meeting[];
}

function buildItemRows(messages: Message[], meetings: Meeting[]): ItemRow[] {
  // Index meetings by message_id for linked sub-items
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

  // Message rows with linked meetings as sub-items
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

  // Standalone meeting rows
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

  // Sort most recent first
  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return rows;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  // time is "HH:mm" or "HH:mm:ss" — display as-is or parse
  return time.slice(0, 5);
}

/** Email icon (16px) */
function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted/60">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2 5l6 4 6-4" />
    </svg>
  );
}

/** Calendar icon (16px) */
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted/60">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12" />
      <path d="M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

export default function ManageEngagement({
  messages,
  meetings,
  engagementName,
  onClose,
  onMove,
}: Props) {
  const rows = useMemo(() => buildItemRows(messages, meetings), [messages, meetings]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Count selectable items (messages + standalone meetings only)
  const selectableCount = rows.length;

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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

  // Split selection into messageIds and meetingIds for the API
  const selectedMessageIds = rows
    .filter((r) => r.type === "message" && selected.has(r.id))
    .map((r) => r.id);
  const selectedMeetingIds = rows
    .filter((r) => r.type === "meeting" && selected.has(r.id))
    .map((r) => r.id);

  const selectionCount = selected.size;
  const allSelected = selectionCount === selectableCount && selectableCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

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
            className="text-muted hover:text-foreground transition-colors p-1"
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
                {/* Main row */}
                <label
                  className="flex items-start gap-3 px-6 py-3 border-b border-border/20 cursor-pointer hover:bg-surface-hover/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleItem(row.id)}
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

                {/* Linked meeting sub-items (not independently selectable) */}
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
        </div>

        {/* Action bar — visible when items selected */}
        {selectionCount > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30 bg-surface">
            <span className="text-sm text-muted">
              {selectionCount} item{selectionCount !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onMove({
                  messageIds: selectedMessageIds,
                  meetingIds: selectedMeetingIds,
                  action: "move_to_existing",
                })}
                className="bg-surface border border-border/50 text-foreground/70 rounded-md px-3 py-1.5 text-sm hover:bg-surface-hover hover:text-foreground transition-colors"
              >
                Move to Engagement
              </button>
              <button
                onClick={() => onMove({
                  messageIds: selectedMessageIds,
                  meetingIds: selectedMeetingIds,
                  action: "move_to_new",
                })}
                className="bg-accent text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Move to New
              </button>
              <button
                onClick={() => onMove({
                  messageIds: selectedMessageIds,
                  meetingIds: selectedMeetingIds,
                  action: "return_to_inbox",
                })}
                className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5"
              >
                Return to Inbox
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
