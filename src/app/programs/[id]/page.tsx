export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { ProgramTypeBadge } from "@/components/shared/TypeBadge";
import MeetingTimeline from "@/components/shared/MeetingTimeline";
import ExpandableList from "@/components/shared/ExpandableList";
import ProgramActions from "@/components/actions/ProgramActions";
import { formatFooterDate } from "@/lib/format-utils";
import {
  getProgramById,
  getMeetingsByProgram,
  getLinkedEngagementsForEntity,
} from "@/lib/db";

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
  const hasRequirements = !!program.requirements;
  const hasContext = hasDescription || hasRequirements;

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
            <ProgramTypeBadge type={program.type} />
          </>
        }
        fields={[
          { label: "Lifecycle", value: <span className="capitalize">{program.lifecycle_type}</span> },
          ...(program.lifecycle_duration ? [{ label: "Duration", value: program.lifecycle_duration }] : []),
        ]}
        actions={<ProgramActions program={program} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Two-column context card: Description + Requirements/URL */}
        {hasContext && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className={`grid gap-6 ${hasDescription && hasRequirements ? "lg:grid-cols-2" : ""}`}>
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
              {hasRequirements && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Requirements
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {program.requirements}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked Engagements — status right-aligned */}
        {linkedEngagements.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Engagements
            </h2>
            <ExpandableList label="engagements">
              {linkedEngagements.map((eng) => (
                <Link
                  key={eng.id}
                  href={`/engagements/${eng.id}`}
                  className="flex items-center px-2 py-2 border-b border-border/50 transition-colors duration-150 hover:bg-surface-hover gap-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {eng.name}
                  </span>
                  {eng.partner_name && (
                    <span className="shrink-0 text-xs text-muted">
                      {eng.partner_name}
                    </span>
                  )}
                  <span className="shrink-0">
                    <StatusBadge status={eng.status} />
                  </span>
                </Link>
              ))}
            </ExpandableList>
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
          Created {formatFooterDate(program.created_at)}
        </p>
      </div>
    </div>
  );
}
