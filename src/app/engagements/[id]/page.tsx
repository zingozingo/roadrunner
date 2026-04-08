export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
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
  getPartner,
  getCondensedByMeetingIds,
} from "@/lib/db";
import { cleanMeetingTitle, formatFooterDate } from "@/lib/format-utils";
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

  const [messages, meetings, participants, partner] = await Promise.all([
    getMessagesByEngagement(id),
    getMeetingsByEngagement(id),
    getParticipantsByEngagement(id),
    engagement.partner_id ? getPartner(engagement.partner_id) : null,
  ]);

  const partnerName = partner?.name ?? null;

  // Fetch condensed digests for connected meetings
  const meetingIds = meetings.map((m) => m.id);
  const condensedByMeetingId = await getCondensedByMeetingIds(meetingIds);

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

  const dotColor = statusDotColor[engagement.status] ?? "bg-zinc-500";

  // Connected meetings sorted by date desc (exclude meetings already in timeline as messages)
  const connectedMeetings = meetings
    .filter((m) => m.meeting_date)
    .sort((a, b) => new Date(b.meeting_date + "T00:00:00").getTime() - new Date(a.meeting_date + "T00:00:00").getTime());

  return (
    <PageContainer>
      <Link
        href={engagement.partner_id ? `/partners/${engagement.partner_id}` : "/partners"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        {partnerName ? `Back to ${partnerName}` : "Back to Partners"}
      </Link>

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30 min-w-0">
        <h1 className="text-2xl font-semibold text-foreground truncate">{engagement.name}</h1>
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
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">

        {/* ─── LEFT COLUMN: What's happening ─── */}
        <div className="min-w-0 space-y-10">

          {/* Condensed Digest */}
          {engagement.condensed && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Digest</h2>
              <div className="border-l-2 border-accent/25 pl-4 space-y-1">
                {engagement.condensed.split("\n").filter(Boolean).map((line, i) => {
                  const tagMatch = line.match(/^([A-Za-z\s']+):\s*(.*)/);
                  if (tagMatch) {
                    return (
                      <div key={i} className="flex gap-2 text-[15px] leading-relaxed">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted/60 pt-0.5 min-w-[5rem]">
                          {tagMatch[1]}
                        </span>
                        <span className="text-foreground/85">{tagMatch[2]}</span>
                      </div>
                    );
                  }
                  return <p key={i} className="text-[15px] text-foreground/85 leading-relaxed">{line}</p>;
                })}
              </div>
            </section>
          )}

          {/* Activity Summary (current_state) */}
          {engagement.current_state && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Activity summary</h2>
              <div className="border-l-2 border-accent/25 pl-4 space-y-1.5">
                {engagement.current_state.split("\n").filter(Boolean).map((para, i) => (
                  <p key={i} className="text-[15px] text-foreground/85 leading-relaxed">{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* Connected Meetings */}
          {connectedMeetings.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Meetings
                <span className="ml-1.5 font-normal text-muted">{connectedMeetings.length}</span>
              </h2>
              <div>
                {connectedMeetings.map((m) => {
                  const shortDate = m.meeting_date
                    ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "TBD";
                  const condensedPreview = condensedByMeetingId.get(m.id);
                  const firstLine = condensedPreview
                    ? condensedPreview.split("\n").find((l) => l.trim()) ?? null
                    : null;

                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="block border-b border-border/20 px-3 py-3 transition-colors hover:bg-surface/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs text-muted">{shortDate}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {cleanMeetingTitle(m.title)}
                        </span>
                      </div>
                      {firstLine && (
                        <p className="mt-1 ml-[calc(3.5rem+0.75rem)] text-sm text-muted truncate">{firstLine}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Timeline — audit trail, collapsible */}
          {timelineItems.length > 0 && (
            <section>
              <details className="group" open={timelineItems.length <= 5 ? true : undefined}>
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
        <div className="min-w-0 lg:border-l lg:border-border/20 lg:pl-6">

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
    </PageContainer>
  );
}
