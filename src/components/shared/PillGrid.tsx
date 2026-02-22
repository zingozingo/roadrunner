/**
 * PillGrid — Compact grid of same-height pill elements for catalog items.
 *
 * Use for entities with 10+ same-type items where identity (name) is
 * the primary scan dimension and metadata is minimal. Programs are the
 * canonical use case.
 *
 * Each pill shows only the entity name (truncated if long) and an
 * optional count. No badges, no descriptions, no status indicators.
 */

import Link from "next/link";

interface PillGridItem {
  id: string;
  name: string;
  href: string;
  count?: number;
}

interface PillGridProps {
  items: PillGridItem[];
  columns?: 2 | 3 | 4;
}

export default function PillGrid({ items, columns = 3 }: PillGridProps) {
  if (items.length === 0) return null;

  const colClass =
    columns === 2
      ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-2"
      : columns === 4
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        : "grid-cols-2 md:grid-cols-3 lg:grid-cols-3";

  return (
    <div className={`grid ${colClass} gap-1.5`}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:border-accent/50"
        >
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {item.name}
          </span>
          {item.count != null && item.count > 0 && (
            <span className="shrink-0 text-xs text-muted">{item.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
