/**
 * CalendarCard — Date-anchored cards for temporal/event items.
 *
 * Use for entities where date is the primary scan dimension.
 * Events are the canonical use case.
 *
 * Each card features a compact date block (month + day like a
 * mini calendar page) on the left, with the entity name and
 * location on the right. Multi-day events show a day range.
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

function formatDayRange(start: string, end?: string): string {
  const s = parseDateParts(start);
  if (!end) return String(s.day);
  const e = parseDateParts(end);
  if (s.day === e.day && s.month === e.month) return String(s.day);
  if (s.month === e.month) return `${s.day}–${e.day}`;
  return `${s.day}–${e.day}`;
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
        const { month } = parseDateParts(item.startDate);
        const dayDisplay = formatDayRange(item.startDate, item.endDate);

        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent/50"
          >
            {/* Date block */}
            <div
              className="flex w-12 shrink-0 flex-col items-center rounded py-1"
              style={
                item.typeColor
                  ? { borderLeft: `2px solid ${item.typeColor}`, paddingLeft: "6px" }
                  : undefined
              }
            >
              <span className="text-xs font-medium uppercase text-muted">
                {month}
              </span>
              <span className="text-lg font-semibold leading-tight text-foreground">
                {dayDisplay}
              </span>
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
