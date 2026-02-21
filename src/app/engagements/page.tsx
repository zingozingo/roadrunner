export const dynamic = "force-dynamic";

import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import CompactRow from "@/components/shared/CompactRow";
import StatusBadge from "@/components/shared/StatusBadge";
import SyncButton from "@/components/shared/SyncButton";
import CreateEngagementForm from "@/components/engagement/CreateEngagementForm";
import { getEngagementsWithMessageCounts } from "@/lib/supabase";
import { Engagement } from "@/lib/types";

const statusOrder: Record<string, number> = {
  planned: 0,
  active: 1,
  paused: 2,
  completed: 3,
  archived: 4,
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Engagements"
          subtitle={`${engagements.length} engagement${engagements.length !== 1 ? "s" : ""} tracked`}
        />
        <div className="flex shrink-0 gap-2">
          <CreateEngagementForm />
          <SyncButton entity="engagements" label="Push to Airtable" compact />
        </div>
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
              <div className="space-y-2">
                {items.map((eng) => (
                  <CompactRow
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    primary={eng.name}
                    badges={<StatusBadge status={eng.status} />}
                    secondary={eng.partner_name ?? undefined}
                    meta={
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{eng.message_count} msg{eng.message_count !== 1 ? "s" : ""}</span>
                        <span>{new Date(eng.updated_at).toLocaleDateString()}</span>
                      </div>
                    }
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
