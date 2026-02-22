/**
 * TableList — Aligned rows with consistent columns for portfolio items.
 *
 * Use for entities where comparable metadata across rows matters more
 * than individual item richness. Partners and Relationships are the
 * canonical use cases.
 *
 * Rows are separated by subtle bottom borders, not card wrappers.
 * Column values align across all rows for easy scanning.
 * No badges, no pills, no colored indicators — just clean text
 * with weight/color hierarchy.
 */

import Link from "next/link";

interface TableListColumn {
  value: string;
  width?: string;
  muted?: boolean;
}

interface TableListItem {
  id: string;
  href: string;
  columns: TableListColumn[];
}

interface TableListHeader {
  label: string;
  width?: string;
}

interface TableListProps {
  items: TableListItem[];
  headers?: TableListHeader[];
}

export default function TableList({ items, headers }: TableListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      {headers && headers.length > 0 && (
        <div className="flex items-center px-4 py-2">
          {headers.map((header, i) => (
            <span
              key={header.label}
              className="text-xs font-semibold uppercase tracking-wider text-muted"
              style={header.width ? { width: header.width, flexShrink: 0 } : { flex: i === 0 ? 1 : undefined, width: i !== 0 ? "140px" : undefined, flexShrink: i !== 0 ? 0 : undefined }}
            >
              {header.label}
            </span>
          ))}
        </div>
      )}
      <div>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface cursor-pointer"
          >
            {item.columns.map((col, i) => (
              <span
                key={i}
                className={
                  i === 0
                    ? "min-w-0 flex-1 truncate text-sm font-medium text-foreground"
                    : "shrink-0 truncate text-sm text-muted"
                }
                style={
                  col.width
                    ? { width: col.width, flexShrink: 0 }
                    : i !== 0
                      ? { width: "140px" }
                      : undefined
                }
              >
                {col.value}
              </span>
            ))}
          </Link>
        ))}
      </div>
    </div>
  );
}
