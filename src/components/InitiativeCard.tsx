import Link from "next/link";
import { Initiative } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function InitiativeCard({
  initiative,
  messageCount,
}: {
  initiative: Initiative;
  messageCount: number;
}) {
  return (
    <Link
      href={`/initiatives/${initiative.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">
            {initiative.name}
          </h3>
          {initiative.partner_name && (
            <p className="mt-0.5 text-sm text-muted">
              {initiative.partner_name}
            </p>
          )}
        </div>
        <StatusBadge status={initiative.status} />
      </div>
      {initiative.summary && (
        <p className="mt-2 line-clamp-2 text-sm text-muted">
          {initiative.summary}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>
          {messageCount} message{messageCount !== 1 ? "s" : ""}
        </span>
        <span>
          Updated {new Date(initiative.updated_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}
