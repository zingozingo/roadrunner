import { EntityLink as EntityLinkType } from "@/lib/types";

const typeColors: Record<string, string> = {
  initiative: "bg-accent/20 text-accent",
  event: "bg-[var(--event-conference)]/20 text-[var(--event-conference)]",
  program: "bg-status-active/20 text-status-active",
};

export default function EntityLinkChip({
  link,
  entityName,
}: {
  link: EntityLinkType;
  entityName?: string;
}) {
  const targetType = link.target_type;
  const colors = typeColors[targetType] ?? "bg-border text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}
    >
      <span className="capitalize">{targetType}</span>
      {entityName && <span className="opacity-70">— {entityName}</span>}
      <span className="opacity-50">({link.relationship})</span>
    </span>
  );
}
