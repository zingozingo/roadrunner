import Link from "next/link";
import { EntityLink as EntityLinkType } from "@/lib/types";

const typeColors: Record<string, string> = {
  initiative: "bg-accent/20 text-accent",
  event: "bg-[var(--event-conference)]/20 text-[var(--event-conference)]",
  program: "bg-status-active/20 text-status-active",
};

/** Map entity_type to user-facing label */
function entityTypeLabel(type: string): string {
  if (type === "program") return "Track";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Make relationship labels human-readable: "qualifies_for" → "Qualifies for" */
function formatRelationship(rel: string): string {
  const words = rel.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Route for a given entity type + id */
function entityHref(type: string, id: string): string {
  if (type === "event") return `/events/${id}`;
  if (type === "program") return `/tracks/${id}`;
  return `/initiatives/${id}`;
}

export default function EntityLinkChip({
  link,
  entityName,
  entityId,
}: {
  link: EntityLinkType;
  entityName?: string;
  entityId?: string;
}) {
  const targetType = link.target_type;
  const colors = typeColors[targetType] ?? "bg-border text-muted";
  const label = entityTypeLabel(targetType);
  const rel = formatRelationship(link.relationship);

  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity ${colors} ${entityId ? "hover:opacity-80 cursor-pointer" : ""}`}
    >
      <span>{label}</span>
      {entityName && <span className="font-semibold">{entityName}</span>}
      <span className="opacity-50">{rel}</span>
    </span>
  );

  if (entityId) {
    return (
      <Link href={entityHref(targetType, entityId)}>
        {content}
      </Link>
    );
  }

  return content;
}
