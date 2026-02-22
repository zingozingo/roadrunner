/**
 * CalendarCard — Date-anchored cards for temporal/event items.
 *
 * Use for entities where date is the primary scan dimension.
 * Events are the canonical use case.
 *
 * Each card shows a compact date text line (e.g. "Mar 9–12") above
 * the entity name and location. An optional type color renders as
 * a subtle left border accent.
 */

import Link from "next/link";
import { formatCompactDateRange } from "@/lib/format-utils";

interface CalendarCardItem {
  id: string;
  href: string;
  name: string;
  startDate: string;
  endDate?: string;
  location?: string;
  typeColor?: string;
}

interface CalendarCardProps {
  items: CalendarCardItem[];
  columns?: 1 | 2;
}

export default function CalendarCard({
  items,
  columns = 2,
}: CalendarCardProps) {
  if (items.length === 0) return null;

  const colClass =
    columns === 1
      ? "grid-cols-1"
      : "grid-cols-1 lg:grid-cols-2";

  return (
    <div className={`grid ${colClass} gap-2`}>
      {items.map((item) => {
        const dateText = formatCompactDateRange(item.startDate, item.endDate ?? null);

        return (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent/50"
            style={
              item.typeColor
                ? { borderLeftWidth: "2px", borderLeftColor: item.typeColor }
                : undefined
            }
          >
            <p className="text-xs font-medium text-muted">
              {dateText}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">
              {item.name}
            </p>
            {item.location && (
              <p className="mt-0.5 truncate text-xs text-muted">
                {item.location}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
