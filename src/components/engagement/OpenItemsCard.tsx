"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OpenItem } from "@/lib/types";
import { safeDateDisplay } from "@/lib/format-utils";

export default function OpenItemsCard({
  items,
  engagementId,
}: {
  items: OpenItem[];
  engagementId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  if (items.length === 0) return null;

  const unresolvedCount = items.filter((item) => !item.resolved).length;
  const resolvedCount = items.length - unresolvedCount;

  const headerCount =
    resolvedCount > 0
      ? `${unresolvedCount} of ${items.length}`
      : `${unresolvedCount}`;

  async function updateItems(updatedItems: OpenItem[]) {
    try {
      await fetch(`/api/engagements/${engagementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open_items: updatedItems }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to update open items:", err);
    } finally {
      setBusy(null);
    }
  }

  async function handleToggle(index: number) {
    setBusy(index);
    const updatedItems = items.map((item, i) =>
      i === index ? { ...item, resolved: !item.resolved } : item
    );
    await updateItems(updatedItems);
  }

  async function handleDelete(index: number) {
    setBusy(index);
    const updatedItems = items.filter((_, i) => i !== index);
    await updateItems(updatedItems);
  }

  const unresolved = items
    .map((item, i) => ({ item, index: i }))
    .filter(({ item }) => !item.resolved);
  const resolved = items
    .map((item, i) => ({ item, index: i }))
    .filter(({ item }) => item.resolved);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Open Items ({headerCount})
      </h2>
      <ul className="space-y-2">
        {unresolved.map(({ item, index }) => (
          <ItemRow
            key={index}
            item={item}
            index={index}
            busy={busy}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </ul>
      {resolved.length > 0 && (
        <ul className={`space-y-2 ${unresolved.length > 0 ? "mt-4" : ""}`}>
          {resolved.map(({ item, index }) => (
            <ItemRow
              key={index}
              item={item}
              index={index}
              busy={busy}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({
  item,
  index,
  busy,
  onToggle,
  onDelete,
}: {
  item: OpenItem;
  index: number;
  busy: number | null;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const isResolved = !!item.resolved;
  const isBusy = busy === index;

  return (
    <li className="flex items-start gap-2 text-sm group">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(index)}
        disabled={isBusy}
        className={`mt-1 h-4 w-4 shrink-0 rounded border transition-colors disabled:opacity-50 flex items-center justify-center ${
          isResolved
            ? "border-accent bg-accent"
            : "border-border bg-background hover:border-accent hover:bg-accent/10"
        }`}
        title={isResolved ? "Mark as open" : "Mark as done"}
      >
        {isResolved && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M2 5l2.5 2.5L8 3" />
          </svg>
        )}
      </button>

      {/* Description + metadata */}
      <div className="flex-1 min-w-0">
        <span className={isResolved ? "line-through text-muted" : "text-foreground/90"}>
          {item.description}
        </span>
        {(item.assignee || item.due_date) && (
          <span className="ml-2 text-xs text-muted">
            {item.assignee && <span>{item.assignee}</span>}
            {item.assignee && item.due_date && <span> · </span>}
            {item.due_date && safeDateDisplay(item.due_date) && (
              <span>due {safeDateDisplay(item.due_date)}</span>
            )}
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(index)}
        disabled={isBusy}
        className="mt-1 h-3.5 w-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 disabled:opacity-50"
        title="Remove item"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </li>
  );
}
