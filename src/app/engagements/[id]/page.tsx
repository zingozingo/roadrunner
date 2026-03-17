export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import CollapsibleEmails from "@/components/shared/CollapsibleEmails";
import EngagementActions from "@/components/actions/EngagementActions";
import MergeButton from "@/components/actions/MergeButton";
import CollapsibleParticipants from "@/components/shared/CollapsibleParticipants";
import PillarBadge from "@/components/shared/PillarBadge";
import {
  getEngagementById,
  getMessagesByEngagement,
  getMeetingsByEngagement,
  getParticipantsByEngagement,
  getRelationshipsByEngagement,
  getPartner,
} from "@/lib/db";
import { getEngagementPrograms, getEngagementEvents } from "@/lib/db/engagement-links";
import { formatFooterDate } from "@/lib/format-utils";
import type { TimelineItem } from "@/lib/types";

// Status dot color map
const statusDotColor: Record<string, string> = {
  active: "bg-emerald-500",
  planned: "bg-blue-400",
  blocked: "bg-amber-500",
  completed: "bg-violet-500",
  archived: "bg-zinc-500",
};

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const engagement = await getEngagementById(id);
  if (!engagement) notFound();

  const [messages, meetings, participants, linkedPrograms, linkedEvents, relationships, partner] = await Promise.all([
    getMessagesByEngagement(id),
    getMeetingsByEngagement(id),
    getParticipantsByEngagement(id),
    getEngagementPrograms(id),
    getEngagementEvents(id),
    getRelationshipsByEngagement(id),
    engagement.partner_id ? getPartner(engagement.partner_id) : null,
  ]);

  const partnerName = partner?.name ?? null;

  // Build unified timeline: messages + meetings sorted by date desc.
  const meetingSourceMessageIds = new Set(
    meetings.filter((m) => m.message_id).map((m) => m.message_id!)
  );

  const timelineItems: TimelineItem[] = [];
  for (const msg of messages) {
    if (meetingSourceMessageIds.has(msg.id)) continue;
    const date = msg.sent_at ?? msg.forwarded_at;
    timelineItems.push({ type: "message", date, data: msg });
  }
  for (const mtg of meetings) {
    const date = mtg.meeting_date
      ? mtg.meeting_date + "T00:00:00"
      : new Date().toISOString();
    timelineItems.push({ type: "meeting", date, data: mtg });
  }
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasConnections = relationships.length > 0 || linkedPrograms.length > 0 || linkedEvents.length > 0;
  const connectionCount = relationships.length + linkedPrograms.length + linkedEvents.length;

  const dotColor = statusDotColor[engagement.status] ?? "bg-zinc-500";

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

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
        <h1 className="text-xl font-semibold text-foreground">{engagement.name}</h1>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} title={engagement.status} />
        <div className="ml-auto flex items-center gap-2">
          {engagement.partner_id && (
            <MergeButton
              engagementId={engagement.id}
              engagementName={engagement.name}
              partnerId={engagement.partner_id}
            />
          )}
          <EngagementActions engagement={engagement} partnerName={partnerName} />
        </div>
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">

        {/* ─── LEFT COLUMN: What's happening ─── */}
        <div className="space-y-10">

          {/* Goal callout */}
          {engagement.goal && (
            <div className="border-l-2 border-accent/40 pl-4 py-2 text-sm text-foreground/80 italic leading-relaxed">
              {engagement.goal}
            </div>
          )}

          {/* Activity Summary (current_state) */}
          {engagement.current_state && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Activity summary</h2>
              <div className="space-y-1.5">
                {engagement.current_state.split("\n").filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm text-foreground/80 leading-relaxed">{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* Timeline — audit trail, collapsible */}
          {timelineItems.length > 0 && (
            <section>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
                  <svg
                    width="14" height="14" viewBox="0 0 16 16"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    className="shrink-0 transition-transform group-open:rotate-90"
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  Timeline
                  <span className="font-normal text-muted/50">{timelineItems.length}</span>
                </summary>
                <div className="mt-3">
                  <CollapsibleEmails items={timelineItems} participants={participants} compact />
                </div>
              </details>
            </section>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Structural context ─── */}
        <div className="lg:border-l lg:border-border/20 lg:pl-8">

          {/* Partner */}
          {partnerName && engagement.partner_id && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Partner</h2>
              <Link
                href={`/partners/${engagement.partner_id}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                {partnerName}
              </Link>
            </section>
          )}

          {/* Details */}
          <section className={partnerName ? "mt-6 pt-6 border-t border-border/20" : ""}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Details</h2>
            <div className="space-y-3">
              {engagement.pillar && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Pillar</span>
                  <PillarBadge pillar={engagement.pillar} />
                </div>
              )}
              {engagement.topic && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Topic</span>
                  <span className="text-sm text-foreground">{engagement.topic}</span>
                </div>
              )}
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Status</span>
                <span className="flex items-center gap-2 text-sm text-foreground capitalize">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  {engagement.status}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Updated</span>
                <span className="text-sm text-foreground">{formatFooterDate(engagement.updated_at)}</span>
              </div>
            </div>
          </section>

          {/* Connections — relationships + programs + events */}
          {hasConnections && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Connections
                <span className="ml-1.5 font-normal text-muted/50">{connectionCount}</span>
              </h2>
              <div className="space-y-0.5">
                {relationships.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/relationships/${rel.id}`}
                    className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{rel.name}</span>
                    {rel.service && (
                      <span className="shrink-0 text-xs text-muted">{rel.service}</span>
                    )}
                    {rel.org && (
                      <span className="shrink-0 text-xs text-muted/60">{rel.org}</span>
                    )}
                  </Link>
                ))}
                {linkedPrograms.map((lp) => (
                  <Link
                    key={lp.id}
                    href={`/programs/${lp.program_id}`}
                    className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                  >
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted/50 w-16">
                      Program
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {lp.program_name ?? "Unknown"}
                    </span>
                  </Link>
                ))}
                {linkedEvents.map((le) => (
                  <Link
                    key={le.id}
                    href={`/events/${le.event_id}`}
                    className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                  >
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted/50 w-16">
                      Event
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {le.event_name ?? "Unknown"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Participants — single instance, CollapsibleParticipants handles its own summary */}
          {participants.length > 0 && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <CollapsibleParticipants
                participants={participants}
                partnerName={partnerName}
                compact
              />
            </section>
          )}
        </div>
      </div>

      {/* Compact footer */}
      <p className="mt-10 text-xs text-muted">
        Created {formatFooterDate(engagement.created_at)}
        {" · "}
        Last Updated {formatFooterDate(engagement.updated_at)}
        {engagement.closed_at && engagement.status === "archived" && (
          <> · Archived {formatFooterDate(engagement.closed_at)}</>
        )}
      </p>
    </div>
  );
}
