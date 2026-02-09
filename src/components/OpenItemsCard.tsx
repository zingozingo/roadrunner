"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OpenItem } from "@/lib/types";

export default function OpenItemsCard({
  items,
  initiativeId,
}: {
  items: OpenItem[];
  initiativeId: string;
}) {
  const router = useRouter();
  const [resolving, setResolving] = useState<number | null>(null);

  if (items.length === 0) return null;

  const unresolvedItems = items.filter((item) => !item.resolved);
  if (unresolvedItems.length === 0) return null;

  async function handleResolve(index: number) {
    setResolving(index);
    try {
      // Mark the item resolved by updating the initiative's open_items array
      const updatedItems = items.map((item, i) =>
        i === index ? { ...item, resolved: true } : item
      );

      await fetch(`/api/initiatives/${initiativeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open_items: updatedItems }),
      });

      router.refresh();
    } catch (err) {
      console.error("Failed to resolve item:", err);
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Open Items ({unresolvedItems.length})
      </h2>
      <ul className="space-y-2">
        {items.map((item, i) => {
          if (item.resolved) return null;
          return (
            <li key={i} className="flex items-start gap-2 text-sm group">
              <button
                onClick={() => handleResolve(i)}
                disabled={resolving === i}
                className="mt-1 h-4 w-4 shrink-0 rounded border border-border bg-background transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                title="Mark as done"
              />
              <div className="flex-1 min-w-0">
                <span className="text-foreground/90">{item.description}</span>
                {(item.assignee || item.due_date) && (
                  <span className="ml-2 text-xs text-muted">
                    {item.assignee && <span>{item.assignee}</span>}
                    {item.assignee && item.due_date && <span> · </span>}
                    {item.due_date && (
                      <span>
                        due {new Date(item.due_date + "T00:00:00").toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
