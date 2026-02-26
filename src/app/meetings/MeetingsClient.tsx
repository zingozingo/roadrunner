"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { MeetingStatusBadge } from "@/components/shared/TypeBadge";
import { Meeting, Engagement, Event, MeetingStatus } from "@/lib/types";
import { cleanMeetingTitle } from "@/lib/format-utils";

type MeetingWithNames = Meeting & { engagement_name: string | null; event_name: string | null };

const MEETING_TYPE_OPTIONS = [
  { label: "Executive", value: "Executive Meeting" },
  { label: "GTM", value: "GTM Meeting" },
  { label: "Product Team", value: "Product Team Relationship" },
  { label: "Specialized", value: "Specialized Meeting" },
];

const MEETING_TYPES = [
  "Executive Meeting",
  "GTM Meeting",
  "Product Team Relationship",
  "Specialized Meeting",
];

const MEETING_STATUSES: MeetingStatus[] = [
  "scheduled",
  "completed",
  "did_not_occur",
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end) return start;
  return `${start} — ${end}`;
}

interface MeetingsClientProps {
  meetings: MeetingWithNames[];
  engagements: Engagement[];
  events: Event[];
}

export default function MeetingsClient({ meetings, engagements, events }: MeetingsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("");
  const [newStatus, setNewStatus] = useState<string>("scheduled");
  const [newEngagementId, setNewEngagementId] = useState("");
  const [newEventId, setNewEventId] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  // Auto-populate partner_name when engagement changes
  function handleEngagementChange(engId: string) {
    setNewEngagementId(engId);
    if (engId) {
      const eng = engagements.find((e) => e.id === engId);
      if (eng?.partner_name && !newPartnerName) {
        setNewPartnerName(eng.partner_name);
      }
    }
  }

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesLocation = m.location?.toLowerCase().includes(q);
        const matchesNotes = m.notes?.toLowerCase().includes(q);
        const matchesEngagement = m.engagement_name?.toLowerCase().includes(q);
        const matchesPartner = m.partner_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesEngagement && !matchesPartner) return false;
      }
      if (activeFilter && m.meeting_type !== activeFilter) return false;
      return true;
    });
  }, [meetings, searchQuery, activeFilter]);

  // Group into upcoming vs past
  const sections = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming: MeetingWithNames[] = [];
    const past: MeetingWithNames[] = [];
    const tbd: MeetingWithNames[] = [];

    for (const m of filteredMeetings) {
      if (!m.meeting_date) {
        tbd.push(m);
      } else {
        const mDate = new Date(m.meeting_date + "T00:00:00");
        if (mDate >= now) upcoming.push(m);
        else past.push(m);
      }
    }

    // Upcoming: nearest first
    upcoming.sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!));
    // Past: most recent first
    past.sort((a, b) => b.meeting_date!.localeCompare(a.meeting_date!));
    tbd.sort((a, b) => a.title.localeCompare(b.title));

    const result: { label: string; meetings: MeetingWithNames[] }[] = [];
    if (upcoming.length > 0) result.push({ label: "Upcoming", meetings: upcoming });
    if (past.length > 0) result.push({ label: "Past", meetings: past });
    if (tbd.length > 0) result.push({ label: "Date TBD", meetings: tbd });
    return result;
  }, [filteredMeetings]);

  async function handleCreate() {
    if (!newTitle.trim()) {
      setCreateError("Title is required");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          meeting_date: newDate || null,
          meeting_type: newType || null,
          status: newStatus || "scheduled",
          engagement_id: newEngagementId || null,
          event_id: newEventId || null,
          partner_name: newPartnerName.trim() || null,
          location: newLocation.trim() || null,
          start_time: newStartTime.trim() || null,
          end_time: newEndTime.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      const { meeting } = await res.json();
      setShowCreate(false);
      resetCreateForm();
      router.push(`/meetings/${meeting.id}`);
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  function resetCreateForm() {
    setNewTitle("");
    setNewDate("");
    setNewType("");
    setNewStatus("scheduled");
    setNewEngagementId("");
    setNewEventId("");
    setNewPartnerName("");
    setNewLocation("");
    setNewStartTime("");
    setNewEndTime("");
    setCreateError(null);
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
  const labelClass =
    "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Meetings"
          subtitle={`${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} tracked`}
        />
        <button
          onClick={() => { setShowCreate(true); resetCreateForm(); }}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          + New Meeting
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            New Meeting
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Meeting title..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className={inputClass}
              >
                <option value="">No type</option>
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className={inputClass}
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Partner</label>
              <input
                type="text"
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                placeholder="Partner name..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="text"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                placeholder="e.g. 10:00 AM"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="text"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                placeholder="e.g. 11:00 AM"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Location or Chime link..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Engagement</label>
              <select
                value={newEngagementId}
                onChange={(e) => handleEngagementChange(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {engagements
                  .filter((e) => e.status === "active")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.partner_name ? ` (${e.partner_name})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Event</label>
              <select
                value={newEventId}
                onChange={(e) => setNewEventId(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {createError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-sm text-red-400">{createError}</p>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Meeting"}
            </button>
            <button
              onClick={() => { setShowCreate(false); resetCreateForm(); }}
              disabled={creating}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 && !showCreate ? (
        <EmptyState
          title="No meetings yet"
          description="Click 'New Meeting' to create your first meeting"
        />
      ) : meetings.length > 0 && (
        <>
          <FilterBar
            searchPlaceholder="Search meetings..."
            filterOptions={MEETING_TYPE_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredMeetings.length}
            totalCount={meetings.length}
            entityName="meetings"
          />

          {filteredMeetings.length === 0 ? (
            <EmptyState
              title="No matching meetings"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.label}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                    {section.label} ({section.meetings.length})
                  </h2>
                  <div>
                    {section.meetings.map((m) => {
                      const shortDate = m.meeting_date
                        ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "TBD";
                      const timeStr = m.start_time
                        ? m.end_time ? `${m.start_time} – ${m.end_time}` : m.start_time
                        : "";

                      return (
                        <a
                          key={m.id}
                          href={`/meetings/${m.id}`}
                          className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                        >
                          <span className="shrink-0 w-16 text-sm font-medium text-foreground">
                            {shortDate}
                          </span>
                          <span className="shrink-0 w-24 text-xs text-muted hidden sm:block">
                            {timeStr}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {cleanMeetingTitle(m.title)}
                          </span>
                          {m.partner_name && (
                            <span className="shrink-0 text-xs text-muted hidden md:block">
                              {m.partner_name}
                            </span>
                          )}
                          <span className="shrink-0 ml-auto">
                            <MeetingStatusBadge status={m.status} />
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
