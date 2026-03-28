import Link from "next/link";
import { getSupabaseClient } from "@/lib/db";
import { getInboxCount } from "@/lib/db/inbox";
import { cleanMeetingTitle } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const db = getSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: meetings }, inboxCount] = await Promise.all([
    db
      .from("meetings")
      .select("id, title, meeting_type, meeting_date, partner_id, partners(name)")
      .eq("meeting_date", today)
      .order("meeting_date", { ascending: true }),
    getInboxCount(),
  ]);

  const todaysMeetings = meetings ?? [];

  return (
    <main className="mx-auto max-w-7xl p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-8">Today</h1>

      {/* Today's Meetings */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Today&apos;s Meetings{" "}
          {todaysMeetings.length > 0 && (
            <span className="text-muted/60">({todaysMeetings.length})</span>
          )}
        </h2>
        {todaysMeetings.length > 0 ? (
          <div className="rounded-lg border border-border/30 bg-surface overflow-hidden">
            {todaysMeetings.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-3 border-b border-border/20 last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {m.partners?.name ?? "Unknown"}
                  </span>
                  <span className="text-sm text-muted truncate">
                    {cleanMeetingTitle(m.title)}
                  </span>
                  {m.meeting_type && (
                    <span className="text-xs rounded-full bg-accent/10 px-2 py-0.5 text-accent capitalize whitespace-nowrap">
                      {m.meeting_type.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <Link
                  href={`/meetings/${m.id}`}
                  className="text-xs text-accent hover:underline whitespace-nowrap ml-3"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No meetings scheduled for today.</p>
        )}
      </section>

      {/* Inbox signal */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Inbox
        </h2>
        {inboxCount > 0 ? (
          <Link
            href="/inbox"
            className="text-sm text-accent hover:underline"
          >
            {inboxCount} {inboxCount === 1 ? "item" : "items"} in inbox
          </Link>
        ) : (
          <p className="text-sm text-muted">Inbox is clear.</p>
        )}
      </section>
    </main>
  );
}
