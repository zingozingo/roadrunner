export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTypeBadge } from "@/components/shared/TypeBadge";
import EventActions from "@/components/actions/EventActions";
import { formatFooterDate } from "@/lib/format-utils";
import { getEventById } from "@/lib/db";

function formatDateDisplay(start: string | null, end: string | null): string {
  if (!start) return "Date TBD";
  const opts: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-US", opts);
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-US", opts);
  return s === e ? s : `${s} — ${e}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Events
      </Link>

      {/* IDENTITY BAR */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
        <h1 className="text-xl font-semibold text-foreground">{event.name}</h1>
        <EventTypeBadge type={event.type} />
        {event.geo && (
          <span className="rounded-full bg-muted/15 px-2 py-0.5 text-xs font-medium text-muted">
            {event.geo}
          </span>
        )}
        <div className="ml-auto">
          <EventActions event={event} />
        </div>
      </div>

      {/* CONTENT */}
      <div className="space-y-8">

        {/* Description */}
        {event.description && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Description</h2>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </section>
        )}

        {/* Date / Location / Host */}
        <section className={event.description ? "pt-6 border-t border-border/20" : ""}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Details</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Dates</span>
              <span className="text-sm text-foreground">{formatDateDisplay(event.start_date, event.end_date)}</span>
            </div>
            {event.location && (
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Location</span>
                <span className="text-sm text-foreground">{event.location}</span>
              </div>
            )}
            {event.host && (
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Host</span>
                <span className="text-sm text-foreground">{event.host}</span>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <p className="pt-6 text-xs text-muted">
          Created {formatFooterDate(event.created_at)}
          {" · "}
          Source: <span className="capitalize">{event.source.replace("_", " ")}</span>
          {" · "}
          {event.verified ? "Verified" : "Unverified"}
        </p>
      </div>
    </div>
  );
}
