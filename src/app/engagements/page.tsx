export const dynamic = "force-dynamic";

import PageHeader from "@/components/PageHeader";
import EngagementCard from "@/components/EngagementCard";
import EmptyState from "@/components/EmptyState";
import { getEngagementsWithMessageCounts } from "@/lib/supabase";
import { Engagement } from "@/lib/types";

const statusOrder: Record<string, number> = {
  active: 0,
  paused: 1,
  closed: 2,
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
      <PageHeader
        title="Engagements"
        subtitle={`${engagements.length} engagement${engagements.length !== 1 ? "s" : ""} tracked`}
      />

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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((eng) => (
                  <EngagementCard
                    key={eng.id}
                    engagement={eng}
                    messageCount={eng.message_count}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
