"use client";

import { useState, Children, ReactNode } from "react";

interface ExpandableListProps {
  children: ReactNode;
  maxVisible?: number;
  label: string;
}

/**
 * Shows first N children, with a "Show all X →" button if more exist.
 * Used on detail pages to prevent long lists of items.
 */
export default function ExpandableList({
  children,
  maxVisible = 3,
  label,
}: ExpandableListProps) {
  const [expanded, setExpanded] = useState(false);
  const childArray = Children.toArray(children);
  const total = childArray.length;

  if (total <= maxVisible) {
    return <>{children}</>;
  }

  const visible = expanded ? childArray : childArray.slice(0, maxVisible);

  return (
    <>
      {visible}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Show all {total} {label}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      )}
    </>
  );
}
