"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  onDismiss: () => void;
}

/** Compact inline error display with auto-dismiss after 8 seconds. */
export default function InlineError({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 text-sm text-red-400">
      <span className="flex-1 min-w-0 truncate">{message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
        aria-label="Dismiss error"
      >
        &times;
      </button>
    </div>
  );
}
