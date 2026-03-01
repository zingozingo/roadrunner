export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CurrentStateCard from "@/components/engagement/CurrentStateCard";
import CollapsibleEmails from "@/components/shared/CollapsibleEmails";
import EntityLinkChip from "@/components/shared/EntityLink";
import EngagementActions from "@/components/actions/EngagementActions";
import CollapsibleParticipants from "@/components/shared/CollapsibleParticipants";
import {
  getEngagementById,
  getMessagesByEngagement,
  getMeetingsByEngagement,
  getParticipantsByEngagement,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
  getAwsRelationshipsByEngagement,
} from "@/lib/db";
import { formatFooterDate } from "@/lib/format-utils";
import type { TimelineItem } from "@/lib/types";

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const engagement = await getEngagementById(id);
  if (!engagement) notFound();

  const [messages, meetings, participants, entityLinks, awsRelationships] = await Promise.all([
    getMessagesByEngagement(id),
    getMeetingsByEngagement(id),
    getParticipantsByEngagement(id),
    getEntityLinksForEntity("engagement", id),
    getAwsRelationshipsByEngagement(id),
  ]);

  // Build unified timeline: messages + meetings sorted by date desc.
  // Suppress messages that have an associated meeting record — the meeting
  // card already displays title/date/link and the raw email body is redundant
  // (mostly Zoom/Teams boilerplate).
  const meetingSourceMessageIds = new Set(
    meetings.filter((m) => m.message_id).map((m) => m.message_id!)
  );

  const timelineItems: TimelineItem[] = [];
  for (const msg of messages) {
    // Skip messages that spawned a meeting — the meeting card replaces them
    if (meetingSourceMessageIds.has(msg.id)) continue;
    const date = msg.sent_at ?? msg.forwarded_at;
    timelineItems.push({ type: "message", date, data: msg });
  }
  for (const mtg of meetings) {
    // Use meeting_date; if somehow null, sort to top (treat as upcoming)
    const date = mtg.meeting_date
      ? mtg.meeting_date + "T00:00:00"
      : new Date().toISOString();
    timelineItems.push({ type: "meeting", date, data: mtg });
  }
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Resolve entity link target names
  const nameMap = await resolveEntityLinkNames(entityLinks);

  // Filter valid entity links (skip orphaned)
  const validEntityLinks = entityLinks.filter((link) => {
    const isSource = link.source_id === id;
    const otherId = isSource ? link.target_id : link.source_id;
    return nameMap.has(otherId);
  });

  const hasConnections = awsRelationships.length > 0 || validEntityLinks.length > 0;
  const connectionCount = awsRelationships.length + validEntityLinks.length;

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/engagements"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Engagements
      </Link>

      <DetailHeader
        title={engagement.name}
        badges={<StatusBadge status={engagement.status} />}
        fields={[
          {
            label: "Partner",
            value: engagement.partner_name ? (
              engagement.partner_id ? (
                <Link href={`/partners/${engagement.partner_id}`} className="text-accent hover:underline">
                  {engagement.partner_name}
                </Link>
              ) : (
                engagement.partner_name
              )
            ) : "—",
          },
          { label: "Pillar", value: engagement.pillar ?? "—" },
          { label: "Updated", value: formatFooterDate(engagement.updated_at) },
        ]}
        actions={<EngagementActions engagement={engagement} />}
      />

      {/* Full-width sections — ordered by decision-making priority */}
      <div className="space-y-6">

        {/* Current State — full-width, most important */}
        {engagement.current_state && (
          <CurrentStateCard text={engagement.current_state} />
        )}

        {/* Participants — collapsed by default */}
        <CollapsibleParticipants
          participants={participants}
          engagementId={id}
          partnerName={engagement.partner_name}
        />

        {/* Timeline — source emails + meetings interleaved by date */}
        <CollapsibleEmails items={timelineItems} participants={participants} />

        {/* Connections — AWS Relationships as simple text links + Entity Links as chips */}
        {hasConnections && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Connections ({connectionCount})
            </h2>
            <div className="space-y-1">
              {/* AWS Relationships as simple text links */}
              {awsRelationships.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/relationships/${rel.id}`}
                  className="flex items-baseline gap-2 rounded px-2 py-1.5 transition-colors hover:bg-surface-hover"
                >
                  <span className="text-sm font-medium text-foreground">
                    {rel.name}
                  </span>
                  {rel.contacts?.[0]?.name && (
                    <span className="text-xs text-muted">
                      {rel.contacts[0].name}
                    </span>
                  )}
                </Link>
              ))}

              {/* Entity Links as chips */}
              {validEntityLinks.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${awsRelationships.length > 0 ? "pt-2" : ""}`}>
                  {validEntityLinks.map((link) => {
                    const isSource = link.source_id === id;
                    const otherId = isSource ? link.target_id : link.source_id;
                    const otherType = isSource ? link.target_type : link.source_type;
                    const otherName = nameMap.get(otherId)!;

                    return (
                      <EntityLinkChip
                        key={link.id}
                        link={link}
                        entityName={otherName}
                        entityId={otherId}
                        entityType={otherType}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Compact footer */}
        <p className="mt-6 text-xs text-muted">
          Created {formatFooterDate(engagement.created_at)}
          {" · "}
          Last Updated {formatFooterDate(engagement.updated_at)}
          {engagement.closed_at && engagement.status === "archived" && (
            <> · Archived {formatFooterDate(engagement.closed_at)}</>
          )}
        </p>
      </div>
    </div>
  );
}
