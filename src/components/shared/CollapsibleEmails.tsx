"use client";

import { useState } from "react";
import { Message } from "@/lib/types";
import Timeline from "./Timeline";

export default function CollapsibleEmails({
  messages,
}: {
  messages: Message[];
}) {
  const [open, setOpen] = useState(true);

  if (messages.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted hover:text-foreground transition-colors"
      >
        <span>Source Emails ({messages.length})</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="mt-3">
          <Timeline messages={messages} />
        </div>
      )}
    </div>
  );
}
