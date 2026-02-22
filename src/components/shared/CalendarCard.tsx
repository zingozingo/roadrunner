/**
 * CalendarCard — Date-anchored cards for temporal/event items.
 *
 * Use for entities where date is the primary scan dimension.
 * Events are the canonical use case.
 *
 * Each card features a compact date block (month + day like a
 * mini calendar page) on the left, with the entity name and
 * location on the right. Multi-day events show a day range
 * with start day prominent and range subordinate.
 * An optional type color renders as a subtle left border on
 * the date block.
 */

import Link from "next/link";

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

function parseDateParts(dateStr: string): { month: string; day: number } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: d.getDate(),
  };
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
        const start = parseDateParts(item.startDate);
        const end = item.endDate ? parseDateParts(item.endDate) : null;
        const isSameDay = !end || (start.month === end.month && start.day === end.day);
        const isSameMonth = end && start.month === end.month;

        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent/50"
          >
            {/* Date block */}
            <div
              className="flex w-14 shrink-0 flex-col items-center rounded py-1"
              style={
                item.typeColor
                  ? { borderLeft: `2px solid ${item.typeColor}`, paddingLeft: "6px" }
                  : undefined
              }
            >
              <span className="text-xs font-medium uppercase text-muted">
                {start.month}
              </span>
              <span className="text-xl font-bold leading-tight text-foreground">
                {start.day}
              </span>
              {!isSameDay && isSameMonth && (
                <span className="text-xs text-muted leading-tight">
                  –{end!.day}
                </span>
              )}
              {!isSameDay && !isSameMonth && (
                <span className="text-xs text-muted leading-tight text-center">
                  –{end!.month} {end!.day}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1 py-0.5">
              <p className="truncate text-sm font-medium text-foreground">
                {item.name}
              </p>
              {item.location && (
                <p className="mt-0.5 truncate text-xs text-muted">
                  {item.location}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
