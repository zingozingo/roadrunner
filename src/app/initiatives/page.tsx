import PageHeader from "@/components/PageHeader";
import InitiativeCard from "@/components/InitiativeCard";
import EmptyState from "@/components/EmptyState";
import { getInitiativesWithMessageCounts } from "@/lib/supabase";
import { Initiative } from "@/lib/types";

const statusOrder: Record<string, number> = {
  active: 0,
  paused: 1,
  closed: 2,
};

export default async function InitiativesPage() {
  const initiatives = await getInitiativesWithMessageCounts();

  // Group by status
  const grouped = initiatives.reduce(
    (acc, init) => {
      const status = init.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(init);
      return acc;
    },
    {} as Record<Initiative["status"], (Initiative & { message_count: number })[]>
  );

  const statusGroups = Object.entries(grouped).sort(
    ([a], [b]) => (statusOrder[a] ?? 99) - (statusOrder[b] ?? 99)
  );

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Initiatives"
        subtitle={`${initiatives.length} initiative${initiatives.length !== 1 ? "s" : ""} tracked`}
      />

      {initiatives.length === 0 ? (
        <EmptyState
          title="No initiatives yet"
          description="Initiatives will appear here as emails are classified"
        />
      ) : (
        <div className="space-y-8">
          {statusGroups.map(([status, items]) => (
            <section key={status}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                {status} ({items.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((init) => (
                  <InitiativeCard
                    key={init.id}
                    initiative={init}
                    messageCount={init.message_count}
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
