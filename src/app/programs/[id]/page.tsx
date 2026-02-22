export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CompactRow from "@/components/shared/CompactRow";
import { ProgramTypeBadge } from "@/components/shared/TypeBadge";
import MeetingTimeline from "@/components/shared/MeetingTimeline";
import ExpandableList from "@/components/shared/ExpandableList";
import ProgramActions from "@/components/actions/ProgramActions";
import {
  getProgramById,
  getMeetingsByProgram,
  getLinkedEngagementsForEntity,
} from "@/lib/supabase";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const program = await getProgramById(id);
  if (!program) notFound();

  const [linkedMeetings, linkedEngagements] = await Promise.all([
    getMeetingsByProgram(id),
    getLinkedEngagementsForEntity("program", id),
  ]);

  // Build engagement name map for MeetingTimeline
  const engagementNames = new Map<string, string>();
  for (const eng of linkedEngagements) {
    engagementNames.set(eng.id, eng.name);
  }

  const hasDescription = !!program.description;
  const hasEligibility = !!program.eligibility;
  const hasContext = hasDescription || hasEligibility;

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/programs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Programs
      </Link>

      <DetailHeader
        title={program.name}
        badges={
          <>
            <StatusBadge status={program.status} />
            <ProgramTypeBadge type={program.type} />
          </>
        }
        fields={[
          { label: "Lifecycle", value: <span className="capitalize">{program.lifecycle_type}</span> },
          ...(program.lifecycle_duration ? [{ label: "Duration", value: program.lifecycle_duration }] : []),
          { label: "Status", value: <span className="capitalize">{program.status}</span> },
        ]}
        actions={<ProgramActions program={program} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Two-column context card: Description + Requirements/URL */}
        {hasContext && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className={`grid gap-6 ${hasDescription && hasEligibility ? "lg:grid-cols-2" : ""}`}>
              {hasDescription && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Description
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {program.description}
                  </p>
                </div>
              )}
              {hasEligibility && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Requirements
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {program.eligibility}
                  </p>
                  {program.url && (
                    <a
                      href={program.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                      Program Link
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 3h7v7M13 3L6 10" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
              {/* If no eligibility but has URL, show it under description */}
              {!hasEligibility && program.url && (
                <div>
                  <a
                    href={program.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                  >
                    Program Link
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 3h7v7M13 3L6 10" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked Engagements */}
        {linkedEngagements.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Engagements
            </h2>
            <div className="space-y-2">
              <ExpandableList label="engagements">
                {linkedEngagements.map((eng) => (
                  <CompactRow
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    primary={eng.name}
                    badges={
                      <>
                        <StatusBadge status={eng.status} />
                        {eng.pillar && (
                          <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                            {eng.pillar}
                          </span>
                        )}
                        {eng.priority && (
                          <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                            {eng.priority}
                          </span>
                        )}
                      </>
                    }
                    secondary={eng.current_state ?? undefined}
                  />
                ))}
              </ExpandableList>
            </div>
          </div>
        )}

        {/* Meetings Timeline */}
        {linkedMeetings.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Meetings
            </h2>
            <MeetingTimeline
              meetings={linkedMeetings}
              engagementNames={engagementNames}
            />
          </div>
        )}

        {/* Compact footer */}
        <p className="mt-6 text-xs text-muted">
          Created {new Date(program.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
