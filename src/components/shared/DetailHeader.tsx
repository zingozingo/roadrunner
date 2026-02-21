/**
 * DetailHeader — Universal hero block for all detail pages.
 *
 * Slots:
 *   title     — Entity name (string, always shown, h1)
 *   badges    — Status/type badges (ReactNode, inline with title)
 *   subtitle  — Primary descriptive text (string, below title)
 *   fields    — Key-value metadata grid (DetailField[], 2-4 recommended)
 *   actions   — Top-right action buttons (ReactNode)
 *
 * Usage: Each detail page maps its entity's most important fields
 * into these slots. The visual frame is universal.
 */

import { ReactNode } from "react";

interface DetailField {
  label: string;
  value: ReactNode;
}

interface DetailHeaderProps {
  title: string;
  badges?: ReactNode;
  subtitle?: string;
  fields?: DetailField[];
  actions?: ReactNode;
}

export default function DetailHeader({
  title,
  badges,
  subtitle,
  fields,
  actions,
}: DetailHeaderProps) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5">
      {/* Top row: title + badges + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {badges}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="shrink-0 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Key fields grid */}
      {fields && fields.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-4 sm:grid-cols-4">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                {field.label}
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {field.value}
              </dd>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
