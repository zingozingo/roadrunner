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
} from "@/lib/db";
import { buildPartnerContext, formatContextForDisplay } from "@/lib/notes-context";
import { cleanMeetingTitle, formatFooterDate } from "@/lib/format-utils";
import MeetingNotesSection from "@/components/notes/MeetingNotesSection";
import ContactGroup from "@/components/shared/ContactGroup";
import { USER_CONFIG } from "@/lib/user-config";
import type { DisplayContext } from "@/lib/types";

// Status dot color map
const statusDotColor: Record<string, string> = {
  scheduled: "bg-blue-400",
  completed: "bg-emerald-500",
  cancelled: "bg-zinc-500",
  no_show: "bg-red-400",
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

  const [engagement, partner, existingNote, meetingContacts] = await Promise.all([
    meeting.engagement_id ? getEngagementById(meeting.engagement_id) : null,
    meeting.partner_id ? getPartner(meeting.partner_id) : null,
    getMeetingNoteByMeetingId(id),
    getContactsByMeeting(id),
  ]);

  // Build partner context for notes workspace (only if partner exists)
  let partnerContext: DisplayContext | null = null;
  if (partner) {
    try {
      const rawContext = await buildPartnerContext(partner.id);
      partnerContext = formatContextForDisplay(rawContext);
    } catch (err) {
      console.error(`Failed to build partner context for meeting ${id}:`, err);
    }
  }

  const filteredAttendees = meetingContacts.filter(
    (c) => !c.email || !isRelayAddress(c.email)
  );
  const totalAttendees = filteredAttendees.length;

  const dotColor = statusDotColor[meeting.status] ?? "bg-zinc-500";

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/meetings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Meetings
      </Link>

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
        <h1 className="text-xl font-semibold text-foreground">{cleanMeetingTitle(meeting.title)}</h1>
        <span className={`shrink-0 h-2 w-2 rounded-full ${dotColor}`} title={meeting.status} />
        {meeting.source === "ics_parsed" && (
          <span className="rounded-full bg-muted/15 px-2 py-0.5 text-xs font-medium text-muted">
            ICS
          </span>
        )}
        <div className="ml-auto">
          <MeetingActions meeting={meeting} partnerName={partner?.name ?? null} meetingContacts={meetingContacts} />
        </div>
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">

        {/* ─── LEFT COLUMN: Workspace ─── */}
        <div className="space-y-8">

          {/* Location */}
          {meeting.location && (
            <section>
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
                <>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Location</h2>
                  <p className="text-sm text-foreground">{meeting.location}</p>
                </>
              )}
            </section>
          )}

          {/* Calendar Notes (from ICS invite) */}
          {meeting.notes && (
            <section className={meeting.location ? "pt-6 border-t border-border/20" : ""}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Calendar notes</h2>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {meeting.notes}
              </p>
            </section>
          )}

          {/* Meeting Notes Workspace */}
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

          {/* Partner */}
          <section className="pb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Partner</h2>
            {partner ? (
              <Link href={`/partners/${partner.id}`} className="text-sm font-medium text-accent hover:underline">
                {partner.name}
              </Link>
            ) : (
              <span className="text-sm text-muted">—</span>
            )}
          </section>

          {/* Details */}
          <section className="pt-6 border-t border-border/20">
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
                {engagement ? (
                  <Link href={`/engagements/${engagement.id}`} className="text-sm font-medium text-accent hover:underline">
                    {engagement.name}
                  </Link>
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </div>
              {meeting.meeting_type && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Type</span>
                  <span className="text-sm text-foreground capitalize">{meeting.meeting_type}</span>
                </div>
              )}
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Source</span>
                <span className="text-sm text-foreground">
                  {meeting.source === "ics_parsed" ? "ICS Parsed" : meeting.source === "manual" ? "Manual" : meeting.source}
                </span>
              </div>
            </div>
          </section>

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
