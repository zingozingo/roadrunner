"use client";

import { useState } from "react";

interface Props {
  defaultTitle: string;
  onCancel: () => void;
  onCreate: (title: string) => void;
  disabled?: boolean;
}

export default function CreateEngagementForm({
  defaultTitle,
  onCancel,
  onCreate,
  disabled,
}: Props) {
  const [title, setTitle] = useState(defaultTitle);

  return (
    <div className="mt-3 pt-3 border-t border-border/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted">
          Create new engagement
        </span>
        <button
          onClick={onCancel}
          className="text-sm text-muted hover:text-foreground transition-colors min-h-[32px]"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Engagement title"
          className="flex-1 bg-transparent border-b border-border/30 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none py-1"
          onKeyDown={(e) => e.key === "Enter" && title.trim() && onCreate(title.trim())}
          autoFocus
        />
        <button
          onClick={() => title.trim() && onCreate(title.trim())}
          disabled={disabled || !title.trim()}
          className="bg-accent text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </div>
  );
}
