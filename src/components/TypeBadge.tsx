import { ProgramType } from "@/lib/types";
import { Event } from "@/lib/types";

const programTypeColors: Record<ProgramType, string> = {
  Competency: "bg-[var(--program-competency)]/20 text-[var(--program-competency)]",
  "Service Ready": "bg-[var(--program-service-ready)]/20 text-[var(--program-service-ready)]",
  SCA: "bg-[var(--program-sca)]/20 text-[var(--program-sca)]",
  Program: "bg-[var(--program-program)]/20 text-[var(--program-program)]",
  "Credit Program": "bg-[var(--program-credit)]/20 text-[var(--program-credit)]",
};

const eventTypeColors: Record<Event["type"], string> = {
  conference: "bg-[var(--event-conference)]/20 text-[var(--event-conference)]",
  summit: "bg-[var(--event-summit)]/20 text-[var(--event-summit)]",
  workshop: "bg-[var(--event-workshop)]/20 text-[var(--event-workshop)]",
  kickoff: "bg-[var(--event-kickoff)]/20 text-[var(--event-kickoff)]",
  trade_show: "bg-[var(--event-trade-show)]/20 text-[var(--event-trade-show)]",
  deadline: "bg-[var(--event-deadline)]/20 text-[var(--event-deadline)]",
  review_cycle: "bg-[var(--event-review-cycle)]/20 text-[var(--event-review-cycle)]",
  training: "bg-[var(--event-training)]/20 text-[var(--event-training)]",
};

export function ProgramTypeBadge({ type }: { type: ProgramType | null }) {
  if (!type) return null;
  const colors = programTypeColors[type] ?? "bg-border text-muted";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${colors}`}>
      {type}
    </span>
  );
}

export function EventTypeBadge({ type }: { type: Event["type"] }) {
  const colors = eventTypeColors[type] ?? "bg-border text-muted";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${colors}`}>
      {type.replace("_", " ")}
    </span>
  );
}
