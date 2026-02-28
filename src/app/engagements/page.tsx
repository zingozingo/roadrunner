export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import PillarBadge from "@/components/shared/PillarBadge";
import { formatFooterDate } from "@/lib/format-utils";
import { getEngagementsWithMessageCounts } from "@/lib/db";
import { Engagement } from "@/lib/types";

const statusOrder: Record<string, number> = {
  active: 0,
  blocked: 1,
  completed: 2,
  archived: 3,
};

export default async function EngagementsPage() {
  const engagements = await getEngagementsWithMessageCounts();

  // Group by status
  const grouped = engagements.reduce(
    (acc, eng) => {
      const status = eng.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(eng);
      return acc;
    },
    {} as Record<Engagement["status"], (Engagement & { message_count: number })[]>
  );

  const statusGroups = Object.entries(grouped).sort(
    ([a], [b]) => (statusOrder[a] ?? 99) - (statusOrder[b] ?? 99)
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Engagements"
          subtitle={`${engagements.length} engagement${engagements.length !== 1 ? "s" : ""} tracked`}
        />
      </div>

      {engagements.length === 0 ? (
        <EmptyState
          title="No engagements yet"
          description="Engagements will appear here as emails are classified"
        />
      ) : (
        <div className="space-y-8">
          {statusGroups.map(([status, items]) => (
            <section key={status}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                {status} ({items.length})
              </h2>
              <div>
                {items.map((eng) => (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {eng.name}
                    </span>
                    {eng.partner_name && (
                      <span className="shrink-0 text-xs text-muted hidden sm:block">
                        {eng.partner_name}
                      </span>
                    )}
                    {eng.pillar && (
                      <span className="shrink-0 hidden sm:inline-flex">
                        <PillarBadge pillar={eng.pillar} />
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted hidden sm:block">
                      {eng.message_count} msg{eng.message_count !== 1 ? "s" : ""} · {formatFooterDate(eng.updated_at)}
                    </span>
                    <span className="shrink-0">
                      <StatusBadge status={eng.status} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
