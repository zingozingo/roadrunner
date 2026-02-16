export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import MeetingActions from "@/components/MeetingActions";
import { MeetingStatusBadge } from "@/components/TypeBadge";
import {
  getMeeting,
  getAwsRelationshipsByMeeting,
  getEngagementById,
  getEventById,
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

  const [awsRelationships, engagement, event] = await Promise.all([
    getAwsRelationshipsByMeeting(id),
    meeting.engagement_id ? getEngagementById(meeting.engagement_id) : null,
    meeting.event_id ? getEventById(meeting.event_id) : null,
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

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {meeting.title}
            </h1>
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
          </div>
          <p className="mt-1 text-muted">
            {formatDate(meeting.meeting_date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MeetingActions meeting={meeting} />
        </div>
      </div>

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
                    {rel.partner_name && (
                      <p className="mt-0.5 text-xs text-muted">{rel.partner_name}</p>
                    )}
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
              {meeting.partner_name && (
                <div>
                  <dt className="text-muted">Partner</dt>
                  <dd className="text-foreground">{meeting.partner_name}</dd>
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
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
