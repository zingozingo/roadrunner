"use client";

import { useState } from "react";
import { Message } from "@/lib/types";

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

export default function Timeline({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">No messages yet.</p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      {messages.map((msg) => (
        <div key={msg.id} className="relative flex gap-4 py-3">
          {/* Dot */}
          <div className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent ring-4 ring-background" />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {msg.sender_name || msg.sender_email || "Unknown"}
              </p>
              <time className="shrink-0 text-xs text-muted">
                {msg.sent_at
                  ? new Date(msg.sent_at).toLocaleDateString()
                  : ""}
              </time>
            </div>
            {msg.subject && (
              <p className="mt-0.5 text-sm text-foreground/80">
                {msg.subject}
              </p>
            )}
            {msg.body_text && <MessageBody text={msg.body_text} />}
          </div>
        </div>
      ))}
    </div>
  );
}
