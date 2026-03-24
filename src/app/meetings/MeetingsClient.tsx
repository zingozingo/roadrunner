"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Meeting, Partner, Engagement } from "@/lib/types";
import { cleanMeetingTitle } from "@/lib/format-utils";

type MeetingWithNames = Meeting & { engagement_name: string | null; partner_name: string | null };

const MEETING_TYPE_OPTIONS = [
  { label: "Partner Cadence", value: "partner_cadence" },
  { label: "SCA Review", value: "sca_review" },
  { label: "QBR", value: "qbr" },
  { label: "Executive", value: "executive" },
  { label: "Event", value: "event" },
  { label: "Internal", value: "internal" },
  { label: "Support", value: "support" },
  { label: "Demo", value: "demo" },
  { label: "Enablement", value: "enablement" },
  { label: "Ad Hoc", value: "ad_hoc" },
];

const MEETING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MEETING_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);

const RECURRENCE_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Biweekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
];

interface MeetingsClientProps {
  meetings: MeetingWithNames[];
  partners: Partner[];
  engagements: Engagement[];
}

export default function MeetingsClient({ meetings, partners, engagements }: MeetingsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [meetingType, setMeetingType] = useState("");
  const [selectedEngagementId, setSelectedEngagementId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("weekly");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  // Tracks the last auto-generated title so we know when to overwrite
  const [autoTitle, setAutoTitle] = useState("");

  const sortedPartners = useMemo(
    () => [...partners].sort((a, b) => a.name.localeCompare(b.name)),
    [partners]
  );

  const filteredEngagements = useMemo(
    () =>
      selectedPartnerId
        ? engagements.filter((e) => e.partner_id === selectedPartnerId && e.status === "active")
        : [],
    [engagements, selectedPartnerId]
  );

  function openModal() {
    setSelectedPartnerId("");
    setTitle("");
    setMeetingDate(new Date().toISOString().split("T")[0]);
    setMeetingType("");
    setSelectedEngagementId("");
    setIsRecurring(false);
    setRecurrencePattern("weekly");
    setRecurrenceEnd("");
    setAutoTitle("");
    setFormError(null);
    setSubmitting(false);
    setShowModal(true);
  }

  /** Build "{Partner} — {Type}" title and apply if user hasn't manually edited */
  function maybeAutoTitle(partnerId: string, typeValue: string, currentTitle: string, currentAutoTitle: string) {
    const partner = partners.find((p) => p.id === partnerId);
    const typeLabel = MEETING_TYPE_LABELS[typeValue];
    if (!partner || !typeLabel) return;
    const generated = `${partner.name} — ${typeLabel}`;
    // Only auto-populate if empty or still matches the last auto-generated value
    if (!currentTitle || currentTitle === currentAutoTitle) {
      setTitle(generated);
      setAutoTitle(generated);
    }
  }

  function handlePartnerChange(partnerId: string) {
    setSelectedPartnerId(partnerId);
    setSelectedEngagementId("");
    maybeAutoTitle(partnerId, meetingType, title, autoTitle);
  }

  function handleMeetingTypeChange(typeValue: string) {
    setMeetingType(typeValue);
    maybeAutoTitle(selectedPartnerId, typeValue, title, autoTitle);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPartnerId || !title.trim() || !meetingDate) return;

    setSubmitting(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      title: title.trim(),
      partner_id: selectedPartnerId,
      meeting_date: meetingDate,
      status: "scheduled",
    };
    if (meetingType) body.meeting_type = meetingType;
    if (selectedEngagementId) body.engagement_id = selectedEngagementId;
    if (isRecurring) {
      body.recurrence_pattern = recurrencePattern;
      body.recurrence_end = recurrenceEnd || null;
    }

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to create meeting (${res.status})`);
      }

      const { meeting } = await res.json();
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create meeting");
      setSubmitting(false);
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

    upcoming.sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!));
    past.sort((a, b) => b.meeting_date!.localeCompare(a.meeting_date!));
    tbd.sort((a, b) => a.title.localeCompare(b.title));

    const result: { label: string; meetings: MeetingWithNames[] }[] = [];
    if (upcoming.length > 0) result.push({ label: "Upcoming", meetings: upcoming });
    if (past.length > 0) result.push({ label: "Past", meetings: past });
    if (tbd.length > 0) result.push({ label: "Date TBD", meetings: tbd });
    return result;
  }, [filteredMeetings]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Meetings"
          subtitle={`${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} tracked`}
        />
        <button
          onClick={openModal}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          + New Meeting
        </button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="No meetings yet. Create one manually or forward a calendar invite."
        />
      ) : (
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
              {sections.map((section) => {
                const isUpcoming = section.label === "Upcoming";
                const isTbd = section.label === "Date TBD";
                const defaultOpen = isUpcoming || isTbd || !!searchQuery || section.meetings.length < 10;

                return (
                  <details
                    key={section.label}
                    open={defaultOpen || undefined}
                    className="group"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70 [&::-webkit-details-marker]:hidden">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 transition-transform group-open:rotate-90">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      {section.label}
                      <span className="font-normal text-muted/50">{section.meetings.length}</span>
                    </summary>
                    <div>
                      {section.meetings.map((m) => {
                        const shortDate = m.meeting_date
                          ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "TBD";

                        return (
                          <Link
                            key={m.id}
                            href={`/meetings/${m.id}`}
                            className="flex items-baseline gap-4 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                          >
                            <span className="w-24 shrink-0 text-xs text-muted">
                              {shortDate}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                              {cleanMeetingTitle(m.title)}
                            </span>
                            {(m.is_recurring || m.recurrence_pattern) && (
                              <span className="shrink-0 flex items-center gap-1 text-[10px] text-muted/60" title={m.recurrence_pattern ? m.recurrence_pattern.charAt(0).toUpperCase() + m.recurrence_pattern.slice(1) : "Recurring"}>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                                  <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
                                  <path d="M14 2v4h-4M2 14v-4h4" />
                                </svg>
                              </span>
                            )}
                            {m.partner_name && (
                              <span className="shrink-0 text-xs text-muted">
                                {m.partner_name}
                              </span>
                            )}
                            {m.engagement_name && (
                              <span className="shrink-0 text-xs text-muted/50 truncate max-w-[12rem]">
                                {m.engagement_name}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Meeting Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="relative rounded-xl border border-border bg-surface p-6 max-w-md w-full mx-4">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>

            <h2 className="text-lg font-semibold text-foreground mb-4">New Meeting</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Partner */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Partner <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => handlePartnerChange(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select partner...</option>
                  {sortedPartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Partner Name — Weekly Sync"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </div>

              {/* Meeting Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Meeting Type
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => handleMeetingTypeChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select type...</option>
                  {MEETING_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Engagement */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Engagement
                </label>
                <select
                  value={selectedEngagementId}
                  onChange={(e) => setSelectedEngagementId(e.target.value)}
                  disabled={!selectedPartnerId}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
                >
                  <option value="">No specific engagement</option>
                  {filteredEngagements.map((eng) => (
                    <option key={eng.id} value={eng.id}>{eng.name}</option>
                  ))}
                </select>
              </div>

              {/* Recurring */}
              <div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsRecurring(checked);
                      if (!checked) {
                        setRecurrencePattern("weekly");
                        setRecurrenceEnd("");
                      }
                    }}
                    className="rounded border-border"
                  />
                  Recurring meeting
                </label>
                {isRecurring && (
                  <div className="mt-2 flex items-center gap-3 pl-6">
                    <select
                      value={recurrencePattern}
                      onChange={(e) => setRecurrencePattern(e.target.value)}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                    >
                      {RECURRENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={recurrenceEnd}
                      onChange={(e) => setRecurrenceEnd(e.target.value)}
                      placeholder="End date (optional)"
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                )}
              </div>

              {/* Error */}
              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !selectedPartnerId || !title.trim() || !meetingDate}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Meeting"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
