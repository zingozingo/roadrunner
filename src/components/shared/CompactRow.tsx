// DEPRECATED: No longer used. All list surfaces now use inline table rows,
// TableList, CalendarCard, or PillGrid. Kept for reference only.
// See SKILL.md for the current visual treatment system.

import Link from "next/link";
import { ReactNode } from "react";

interface CompactRowProps {
  href: string;
  primary: string;
  badges?: ReactNode;
  secondary?: string;
  meta?: ReactNode;
  secondaryLineClamp?: 1 | 2;
}

export default function CompactRow({
  href,
  primary,
  badges,
  secondary,
  meta,
  secondaryLineClamp = 1,
}: CompactRowProps) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{primary}</h3>
            {badges}
          </div>
          {secondary && (
            <p
              className={`mt-0.5 text-sm text-muted ${secondaryLineClamp === 2 ? "line-clamp-2" : "line-clamp-1"}`}
            >
              {secondary}
            </p>
          )}
        </div>
        {meta && (
          <div className="shrink-0 text-xs text-muted text-right">
            {meta}
          </div>
        )}
      </div>
    </Link>
  );
}
