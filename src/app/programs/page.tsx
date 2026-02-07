import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { getAllProgramsWithCounts } from "@/lib/supabase";

export default async function ProgramsPage() {
  const programs = await getAllProgramsWithCounts();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Programs"
        subtitle={`${programs.length} program${programs.length !== 1 ? "s" : ""} tracked`}
      />

      {programs.length === 0 ? (
        <EmptyState
          title="No programs yet"
          description="Programs will appear as they are extracted from emails"
        />
      ) : (
        <div className="space-y-3">
          {programs.map((program) => (
            <div
              key={program.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">
                      {program.name}
                    </h3>
                    <StatusBadge status={program.status} />
                  </div>
                  {program.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {program.description}
                    </p>
                  )}
                </div>
                {program.linked_count > 0 && (
                  <span className="shrink-0 text-xs text-muted">
                    {program.linked_count} link{program.linked_count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                {program.eligibility && (
                  <span>Eligibility: {program.eligibility}</span>
                )}
                {program.url && (
                  <a
                    href={program.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Learn more
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
