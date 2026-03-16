"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ParticipantList from "./ParticipantList";

type ParticipantWithLink = {
  id: string;
  email: string | null;
  name: string | null;
  organization: string | null;
  title: string | null;
  org_type: string | null;
  notes: string | null;
  created_at: string;
  role: string | null;
  linkId: string;
};

interface OrgCount {
  label: string;
  count: number;
}

/** Group participants by org_type from the contact registry */
function summarizeByOrg(
  participants: ParticipantWithLink[],
  partnerName: string | null
): OrgCount[] {
  let awsCount = 0;
  let partnerCount = 0;
  let otherCount = 0;

  for (const p of participants) {
    if (p.org_type === "internal") {
      awsCount++;
    } else if (p.org_type === "partner") {
      partnerCount++;
    } else {
      otherCount++;
    }
  }

  const groups: OrgCount[] = [];
  if (awsCount > 0) groups.push({ label: "AWS", count: awsCount });
  if (partnerCount > 0)
    groups.push({ label: partnerName ?? "Partner", count: partnerCount });
  if (otherCount > 0) groups.push({ label: "Other", count: otherCount });
  return groups;
}

export default function CollapsibleParticipants({
  participants,
  partnerName,
  compact = false,
}: {
  participants: ParticipantWithLink[];
  partnerName: string | null;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const updateHeight = useCallback(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    updateHeight();
  }, [expanded, participants, updateHeight]);

  const orgSummary = summarizeByOrg(participants, partnerName);
  const summaryText =
    orgSummary.length > 0
      ? orgSummary.map((g) => `${g.count} ${g.label}`).join(" · ")
      : "None yet";

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-surface p-4"}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className={compact ? "text-xs font-semibold uppercase tracking-wider text-muted" : "text-sm font-semibold uppercase tracking-wider text-muted"}>
          Participants ({participants.length})
        </h2>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`shrink-0 text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Collapsed summary */}
      {!expanded && (
        <p className="mt-1 text-xs text-muted">{summaryText}</p>
      )}

      {/* Expandable content */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: expanded ? `${height + 16}px` : "0px" }}
      >
        <div ref={contentRef} className="pt-3">
          <ParticipantList participants={participants} />
        </div>
      </div>
    </div>
  );
}
