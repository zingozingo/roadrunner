export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import MeetingActions from "@/components/actions/MeetingActions";
import { MeetingStatusBadge } from "@/components/shared/TypeBadge";
import {
  getMeeting,
  getAwsRelationshipsByMeeting,
  getEngagementById,
  getEventById,
  getProgramById,
  getPartner,
} from "@/lib/supabase";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meeting = await getMeeting(id);
  if (!meeting) notFound();

  const [awsRelationships, engagement, event, program, partner] = await Promise.all([
    getAwsRelationshipsByMeeting(id),
    meeting.engagement_id ? getEngagementById(meeting.engagement_id) : null,
    meeting.event_id ? getEventById(meeting.event_id) : null,
    meeting.program_id ? getProgramById(meeting.program_id) : null,
    meeting.partner_id ? getPartner(meeting.partner_id) : null,
  ]);

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

      <DetailHeader
        title={meeting.title}
        badges={
          <>
            <MeetingStatusBadge status={meeting.status} />
            {meeting.meeting_type && (
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400 whitespace-nowrap">
                {meeting.meeting_type}
              </span>
            )}
            {meeting.source === "ics_parsed" && (
              <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                ICS
              </span>
            )}
          </>
        }
        subtitle={meeting.notes ?? undefined}
        fields={[
          { label: "Date", value: formatDate(meeting.meeting_date) },
          {
            label: "Time",
            value: meeting.start_time
              ? `${meeting.start_time}${meeting.end_time ? ` — ${meeting.end_time}` : ""}`
              : "—",
          },
          { label: "Location", value: meeting.location ?? "—" },
          {
            label: "Partner",
            value: partner ? (
              <Link href={`/partners/${partner.id}`} className="text-accent hover:underline">
                {partner.name}
              </Link>
            ) : meeting.partner_name ?? "—",
          },
        ]}
        actions={<MeetingActions meeting={meeting} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Notes */}
          {meeting.notes && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Notes
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {meeting.notes}
              </p>
            </div>
          )}

          {/* Attendees */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Attendees
            </h2>
            {meeting.attendees.length === 0 ? (
              <p className="text-sm text-muted">No attendees listed</p>
            ) : (
              <div className="space-y-2">
                {meeting.attendees.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                      {(a.name ?? a.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {a.name && (
                        <p className="text-sm font-medium text-foreground">{a.name}</p>
                      )}
                      <p className="text-xs text-muted break-all">{a.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked AWS Relationships */}
          {awsRelationships.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                AWS Relationships
              </h2>
              <div className="space-y-2">
                {awsRelationships.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/relationships/${rel.id}`}
                    className="block rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent/40"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {rel.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: metadata */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Details
            </h2>
            <dl className="space-y-3 text-sm">
              {meeting.meeting_type && (
                <div>
                  <dt className="text-muted">Type</dt>
                  <dd className="text-foreground">{meeting.meeting_type}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Date</dt>
                <dd className="text-foreground">{formatDate(meeting.meeting_date)}</dd>
              </div>
              {meeting.start_time && (
                <div>
                  <dt className="text-muted">Time</dt>
                  <dd className="text-foreground">
                    {meeting.start_time}
                    {meeting.end_time && ` — ${meeting.end_time}`}
                  </dd>
                </div>
              )}
              {meeting.location && (
                <div>
                  <dt className="text-muted">Location</dt>
                  <dd className="text-foreground">{meeting.location}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Status</dt>
                <dd><MeetingStatusBadge status={meeting.status} /></dd>
              </div>
              {engagement && (
                <div>
                  <dt className="text-muted">Engagement</dt>
                  <dd>
                    <Link
                      href={`/engagements/${engagement.id}`}
                      className="text-accent hover:underline"
                    >
                      {engagement.name}
                    </Link>
                  </dd>
                </div>
              )}
              {event && (
                <div>
                  <dt className="text-muted">Event</dt>
                  <dd>
                    <Link
                      href={`/events/${event.id}`}
                      className="text-accent hover:underline"
                    >
                      {event.name}
                    </Link>
                  </dd>
                </div>
              )}
              {program && (
                <div>
                  <dt className="text-muted">Program</dt>
                  <dd>
                    <Link
                      href={`/programs/${program.id}`}
                      className="text-accent hover:underline"
                    >
                      {program.name}
                    </Link>
                  </dd>
                </div>
              )}
              {(partner || meeting.partner_name) && (
                <div>
                  <dt className="text-muted">Partner</dt>
                  <dd>
                    {partner ? (
                      <Link
                        href={`/partners/${partner.id}`}
                        className="text-accent hover:underline"
                      >
                        {partner.name}
                      </Link>
                    ) : (
                      <span className="text-foreground">{meeting.partner_name}</span>
                    )}
                  </dd>
                </div>
              )}
              {meeting.organizer_email && (
                <div>
                  <dt className="text-muted">Organizer</dt>
                  <dd className="text-foreground break-all">{meeting.organizer_email}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Source</dt>
                <dd className="text-foreground capitalize">{meeting.source.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(meeting.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last Updated</dt>
                <dd className="text-foreground">
                  {new Date(meeting.updated_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
