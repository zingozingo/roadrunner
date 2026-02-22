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
import type { MeetingAttendee } from "@/lib/types";

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

interface AttendeeGroup {
  label: string;
  attendees: MeetingAttendee[];
}

/** Group attendees by organization using email domain */
function groupAttendees(
  attendees: MeetingAttendee[],
  partnerName: string | null
): AttendeeGroup[] {
  const aws: MeetingAttendee[] = [];
  const partner: MeetingAttendee[] = [];
  const other: MeetingAttendee[] = [];

  const partnerLower = partnerName?.toLowerCase() ?? "";

  for (const a of attendees) {
    if (isRelayAddress(a.email)) continue;

    const domain = a.email.toLowerCase().split("@")[1] ?? "";

    if (domain === "amazon.com" || domain.endsWith(".amazon.com")) {
      aws.push(a);
    } else if (
      partnerLower &&
      (domain.includes(partnerLower.replace(/\s+/g, "")) ||
        (a.name && a.name.toLowerCase().includes(partnerLower)))
    ) {
      partner.push(a);
    } else {
      other.push(a);
    }
  }

  const groups: AttendeeGroup[] = [];
  if (aws.length > 0) groups.push({ label: "AWS", attendees: aws });
  if (partner.length > 0)
    groups.push({ label: partnerName ?? "Partner", attendees: partner });
  if (other.length > 0) groups.push({ label: "Other", attendees: other });
  return groups;
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

  const attendeeGroups = groupAttendees(
    meeting.attendees,
    partner?.name ?? meeting.partner_name
  );
  const totalAttendees = attendeeGroups.reduce((sum, g) => sum + g.attendees.length, 0);

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
            {meeting.source === "ics_parsed" && (
              <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                ICS
              </span>
            )}
          </>
        }
        fields={[
          { label: "Date", value: formatDate(meeting.meeting_date) },
          {
            label: "Time",
            value: meeting.start_time
              ? `${meeting.start_time}${meeting.end_time ? ` — ${meeting.end_time}` : ""}`
              : "—",
          },
          {
            label: "Partner",
            value: partner ? (
              <Link href={`/partners/${partner.id}`} className="text-accent hover:underline">
                {partner.name}
              </Link>
            ) : meeting.partner_name ?? "—",
          },
          {
            label: "Engagement",
            value: engagement ? (
              <Link href={`/engagements/${engagement.id}`} className="text-accent hover:underline">
                {engagement.name}
              </Link>
            ) : "—",
          },
        ]}
        actions={<MeetingActions meeting={meeting} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Location — compact, URL-aware */}
        {meeting.location && (
          <div className="rounded-xl border border-border bg-surface px-5 py-3 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted shrink-0">
              Location
            </span>
            {isUrl(meeting.location) ? (
              <a
                href={meeting.location}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1 text-sm font-medium text-accent hover:bg-accent/25 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 8h4M8 6v4" />
                  <rect x="2" y="2" width="12" height="12" rx="3" />
                </svg>
                {meeting.location.includes("zoom") ? "Join Zoom Meeting" : "Join Meeting"}
              </a>
            ) : (
              <span className="text-sm text-foreground">{meeting.location}</span>
            )}
          </div>
        )}

        {/* Notes */}
        {meeting.notes && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
              Notes
            </h2>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {meeting.notes}
            </p>
          </div>
        )}

        {/* Attendees — grouped by organization */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Attendees{totalAttendees > 0 && ` (${totalAttendees})`}
          </h2>
          {totalAttendees === 0 ? (
            <p className="text-sm text-muted">No attendees listed</p>
          ) : (
            <div className="space-y-4">
              {attendeeGroups.map((group) => (
                <div key={group.label}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    {group.label}{" "}
                    <span className="text-muted/60">({group.attendees.length})</span>
                  </h3>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {group.attendees.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <span className="text-foreground font-medium truncate">
                          {a.name ?? a.email.split("@")[0]}
                        </span>
                        {a.name && (
                          <span className="text-xs text-muted truncate">
                            {a.email}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AWS Relationships */}
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

        {/* Linked Context — compact two-column layout replacing old sidebar */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Details
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {meeting.meeting_type && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Type</dt>
                <dd className="mt-0.5 text-foreground">{meeting.meeting_type}</dd>
              </div>
            )}
            {engagement && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Engagement</dt>
                <dd className="mt-0.5">
                  <Link href={`/engagements/${engagement.id}`} className="text-accent hover:underline">
                    {engagement.name}
                  </Link>
                </dd>
              </div>
            )}
            {event && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Event</dt>
                <dd className="mt-0.5">
                  <Link href={`/events/${event.id}`} className="text-accent hover:underline">
                    {event.name}
                  </Link>
                </dd>
              </div>
            )}
            {program && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Program</dt>
                <dd className="mt-0.5">
                  <Link href={`/programs/${program.id}`} className="text-accent hover:underline">
                    {program.name}
                  </Link>
                </dd>
              </div>
            )}
            {(partner || meeting.partner_name) && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Partner</dt>
                <dd className="mt-0.5">
                  {partner ? (
                    <Link href={`/partners/${partner.id}`} className="text-accent hover:underline">
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
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Organizer</dt>
                <dd className="mt-0.5 text-foreground break-all">{meeting.organizer_email}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Created</dt>
              <dd className="mt-0.5 text-foreground">{new Date(meeting.created_at).toLocaleDateString()}</dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
