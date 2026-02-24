"use client";

import { useState } from "react";
import Link from "next/link";
import type { TimelineItem, Message, Meeting } from "@/lib/types";
import { cleanMeetingTitle, formatFooterDate, displayName } from "@/lib/format-utils";

const PREVIEW_LENGTH = 200;

function MessageBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > PREVIEW_LENGTH;

  return (
    <div className="mt-1">
      <p className={`text-sm text-muted whitespace-pre-wrap ${!expanded ? "line-clamp-2" : ""}`}>
        {expanded ? text : text.slice(0, PREVIEW_LENGTH)}
        {!expanded && needsTruncation ? "..." : ""}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-accent hover:text-accent-hover"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function formatMeetingDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const timeStr = meeting.start_time
    ? `${meeting.start_time}${meeting.end_time ? ` — ${meeting.end_time}` : ""}`
    : null;

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="block rounded-lg border-l-2 border-l-accent border border-border bg-accent/5 p-3 transition-colors hover:bg-accent/10"
    >
      <div className="flex items-center gap-2 mb-1">
        {/* Calendar icon */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent shrink-0">
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M5 1v3M11 1v3M2 7h12" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          Meeting
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">{cleanMeetingTitle(meeting.title)}</p>
      <p className="mt-0.5 text-xs text-muted">
        {formatMeetingDate(meeting.meeting_date)}
        {timeStr && ` · ${timeStr}`}
      </p>
      {meeting.location && (
        <div className="mt-1.5">
          {isUrl(meeting.location) ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 8h4M8 6v4" />
                <rect x="2" y="2" width="12" height="12" rx="3" />
              </svg>
              {meeting.location.includes("zoom") ? "Zoom Meeting" : "Online Meeting"}
            </span>
          ) : (
            <span className="text-xs text-muted">{meeting.location}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function MessageCard({ msg }: { msg: Message }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {displayName(msg.sender_name, msg.sender_email)}
        </p>
        <time className="shrink-0 text-xs text-muted">
          {formatFooterDate(msg.sent_at ?? msg.forwarded_at)}
        </time>
      </div>
      {msg.subject && (
        <p className="mt-0.5 text-sm text-foreground/80">
          {msg.subject}
        </p>
      )}
      {msg.body_text && <MessageBody text={msg.body_text} />}
    </>
  );
}

export default function Timeline({
  items,
}: {
  items: TimelineItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">No activity yet.</p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      {items.map((item) => {
        const key = item.data.id;
        const isMeeting = item.type === "meeting";

        return (
          <div key={key} className="relative flex gap-4 py-3">
            {/* Dot — accent for all items */}
            <div className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-background bg-accent" />

            <div className="min-w-0 flex-1">
              {isMeeting ? (
                <MeetingCard meeting={item.data as Meeting} />
              ) : (
                <MessageCard msg={item.data as Message} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
