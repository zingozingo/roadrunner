export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import MeetingActions from "@/components/actions/MeetingActions";
import {
  getMeeting,
  getEngagementById,
  getPartner,
  getMeetingNoteByMeetingId,
  getContactsByMeeting,
  getSeriesSiblings,
} from "@/lib/db";
import { getSupabaseClient } from "@/lib/db/client";
import { buildPartnerContext, formatContextForDisplay } from "@/lib/notes-context";
import { cleanMeetingTitle, formatFooterDate } from "@/lib/format-utils";
import MeetingNotesSection from "@/components/notes/MeetingNotesSection";
import ContactGroup from "@/components/shared/ContactGroup";
import { USER_CONFIG } from "@/lib/user-config";
import EngagementLinker from "@/components/shared/EngagementLinker";
import RecurrenceEditor from "@/components/shared/RecurrenceEditor";
import type { DisplayContext } from "@/lib/types";
import { MEETING_TYPE_DISPLAY } from "@/lib/sync/field-maps";

const statusDotColor: Record<string, string> = {
  scheduled: "bg-accent",
  completed: "bg-status-active",
  cancelled: "bg-status-archived",
  no_show: "bg-status-blocked",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

/** Filter out relay/infrastructure addresses that aren't real attendees */
function isRelayAddress(email: string): boolean {
  return email.toLowerCase().includes("relay.stevenromero.dev");
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meeting = await getMeeting(id);
  if (!meeting) notFound();

  const [engagement, partner, existingNote, meetingContacts, seriesSiblings] = await Promise.all([
    meeting.engagement_id ? getEngagementById(meeting.engagement_id) : null,
    meeting.partner_id ? getPartner(meeting.partner_id) : null,
    getMeetingNoteByMeetingId(id),
    getContactsByMeeting(id),
    meeting.series_id ? getSeriesSiblings(meeting.series_id) : [],
  ]);

  // Build partner context for notes workspace (only if partner exists)
  let partnerContext: DisplayContext | null = null;
  if (partner) {
    try {
      const rawContext = await buildPartnerContext(partner.id);
      partnerContext = formatContextForDisplay(rawContext);

      // Override previousNotes with three-tier scoped query:
      // Tier 1: engagement_id → same engagement notes
      // Tier 2: series_id (recurring, no engagement) → same series notes
      // Tier 3: neither → no previous context (empty)
      const db = getSupabaseClient();
      let scopedNotes: { title: string; meeting_date: string; ai_summary: string; note_type: string }[] | null = null;

      if (meeting.engagement_id) {
        // Tier 1: join through meetings to get reliable engagement_id
        const { data } = await db
          .from("meeting_notes")
          .select("title, meeting_date, ai_summary, note_type, meetings!inner(engagement_id)")
          .eq("partner_id", partner.id)
          .eq("status", "complete")
          .not("ai_summary", "is", null)
          .neq("meeting_id", id)
          .eq("meetings.engagement_id", meeting.engagement_id)
          .order("meeting_date", { ascending: false, nullsFirst: false })
          .limit(5);
        scopedNotes = data;
      } else if (meeting.series_id) {
        // Tier 2: join through meetings to filter by series_id
        const { data } = await db
          .from("meeting_notes")
          .select("title, meeting_date, ai_summary, note_type, meetings!inner(series_id)")
          .eq("partner_id", partner.id)
          .eq("status", "complete")
          .not("ai_summary", "is", null)
          .neq("meeting_id", id)
          .eq("meetings.series_id", meeting.series_id)
          .order("meeting_date", { ascending: false, nullsFirst: false })
          .limit(5);
        scopedNotes = data;
      }
      // Tier 3: no engagement, no series → empty (no previous context)

      partnerContext.previousNotes = (scopedNotes ?? []).map((n) => ({
        title: n.title,
        meeting_date: n.meeting_date,
        ai_summary: n.ai_summary,
        note_type: n.note_type,
      }));
    } catch (err) {
      console.error(`Failed to build partner context for meeting ${id}:`, err);
    }
  }

  const filteredAttendees = meetingContacts.filter(
    (c) => !c.email || !isRelayAddress(c.email)
  );
  const totalAttendees = filteredAttendees.length;

  const dotColor = statusDotColor[meeting.status] ?? "bg-zinc-500";

  const shortDate = meeting.meeting_date
    ? new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <Link
        href="/meetings"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Meetings
      </Link>

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-foreground">{cleanMeetingTitle(meeting.title)}</h1>
        <span className={`shrink-0 h-2 w-2 rounded-full ${dotColor}`} title={meeting.status} />
        {partner && (
          <Link href={`/partners/${partner.id}`} className="text-sm font-medium text-accent hover:underline">
            {partner.name}
          </Link>
        )}
        {shortDate && (
          <span className="text-sm text-muted">{shortDate}</span>
        )}
        {meeting.source === "ics_parsed" && (
          <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs font-medium text-muted">
            ICS
          </span>
        )}
        <div className="ml-auto">
          <MeetingActions meeting={meeting} partnerName={partner?.name ?? null} />
        </div>
      </div>

      {/* ═══ SERIES NAVIGATION ═══ */}
      {seriesSiblings.length > 1 && (() => {
        const idx = seriesSiblings.findIndex((s) => s.id === id);
        const prev = idx > 0 ? seriesSiblings[idx - 1] : null;
        const next = idx < seriesSiblings.length - 1 ? seriesSiblings[idx + 1] : null;
        const root = seriesSiblings[0];
        const anchorLabel = meeting.anchor_day !== null && meeting.anchor_day !== undefined
          ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][meeting.anchor_day]
          : null;
        const patternLabel = meeting.recurrence_pattern
          ? meeting.recurrence_pattern.charAt(0).toUpperCase() + meeting.recurrence_pattern.slice(1)
          : null;
        const sinceDate = root?.meeting_date
          ? new Date(root.meeting_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : null;
        return (
          <div className="mb-6 rounded-lg border border-border/20 bg-surface/50 px-4 py-2">
            <div className="flex items-center gap-4">
              {prev ? (
                <Link href={`/meetings/${prev.id}`} className="text-xs text-muted hover:text-accent transition-colors">
                  &larr; Previous
                </Link>
              ) : (
                <span className="text-xs text-muted/30">&larr; Previous</span>
              )}
              <span className="flex-1 text-center text-xs text-muted">
                {patternLabel}{anchorLabel ? ` on ${anchorLabel}s` : ""} · Occurrence {idx + 1} of {seriesSiblings.length}{sinceDate ? ` (since ${sinceDate})` : ""}
              </span>
              {next ? (
                <Link href={`/meetings/${next.id}`} className="text-xs text-muted hover:text-accent transition-colors">
                  Next &rarr;
                </Link>
              ) : (
                <span className="text-xs text-muted/30">Next &rarr;</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12">

        {/* ─── LEFT COLUMN: Workspace ─── */}
        <div>
          {partner && partnerContext && (
            <MeetingNotesSection
              meetingId={id}
              partnerId={partner.id}
              partnerName={partner.name}
              engagementId={meeting.engagement_id}
              meetingDate={meeting.meeting_date}
              meetingTitle={cleanMeetingTitle(meeting.title)}
              existingNote={existingNote}
              context={partnerContext}
            />
          )}
        </div>

        {/* ─── RIGHT COLUMN: Context ─── */}
        <div className="lg:border-l lg:border-border/20 lg:pl-8 space-y-0">

          {/* Details */}
          <section className="pb-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Details</h2>
            <div className="space-y-3">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Date</span>
                <span className="text-sm text-foreground">{formatDate(meeting.meeting_date)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Time</span>
                <span className="text-sm text-foreground">
                  {meeting.start_time
                    ? `${meeting.start_time}${meeting.end_time ? ` — ${meeting.end_time}` : ""}`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Engagement</span>
                <EngagementLinker
                  meetingId={id}
                  partnerId={meeting.partner_id}
                  partnerName={partner?.name ?? null}
                  meetingTitle={meeting.title}
                  noteCondensed={existingNote?.condensed ?? null}
                  initialEngagementId={meeting.engagement_id}
                  initialEngagementName={engagement?.name ?? null}
                />
              </div>
              {meeting.meeting_type && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Type</span>
                  <span className="text-sm text-foreground">{MEETING_TYPE_DISPLAY[meeting.meeting_type] ?? meeting.meeting_type}</span>
                </div>
              )}
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Recurrence</span>
                <RecurrenceEditor
                  meetingId={id}
                  initialPattern={meeting.recurrence_pattern}
                  initialEnd={meeting.recurrence_end}
                  initialSeriesId={meeting.series_id}
                  initialAnchorDay={meeting.anchor_day}
                />
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Source</span>
                <span className="text-sm text-foreground">
                  {meeting.source === "ics_parsed" ? "ICS Parsed" : meeting.source === "manual" ? "Manual" : meeting.source}
                </span>
              </div>
            </div>
          </section>

          {/* Location (relocated from left column) */}
          {meeting.location && (
            <section className="pt-6 border-t border-border/20">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Location</h2>
              {isUrl(meeting.location) ? (
                <a
                  href={meeting.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 8h4M8 6v4" />
                    <rect x="2" y="2" width="12" height="12" rx="3" />
                  </svg>
                  {meeting.location.includes("zoom") ? "Join Zoom Meeting" : "Join Meeting"}
                </a>
              ) : (
                <p className="text-sm text-foreground">{meeting.location}</p>
              )}
            </section>
          )}

          {/* Calendar Notes (ICS boilerplate — collapsible) */}
          {meeting.notes && (
            <section className="pt-6 border-t border-border/20">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                  <svg
                    width="14" height="14" viewBox="0 0 16 16"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    className="shrink-0 text-muted/50 transition-transform group-open:rotate-90"
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Calendar notes</span>
                </summary>
                <p className="mt-2 ml-[22px] text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {meeting.notes}
                </p>
              </details>
            </section>
          )}

          {/* Attendees */}
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Attendees
              {totalAttendees > 0 && (
                <span className="ml-1.5 font-normal text-muted/50">{totalAttendees}</span>
              )}
            </h2>
            {totalAttendees === 0 ? (
              <p className="text-sm text-muted">No attendees listed</p>
            ) : (
              <ContactGroup contacts={filteredAttendees} currentUserEmail={USER_CONFIG.email} />
            )}
          </section>

          {/* Footer */}
          <p className="pt-6 text-xs text-muted">
            {meeting.organizer_email && <>Organizer: {meeting.organizer_email} · </>}
            Created {formatFooterDate(meeting.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
