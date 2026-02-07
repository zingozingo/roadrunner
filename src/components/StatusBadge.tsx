const statusColors: Record<string, string> = {
  active: "bg-status-active/20 text-status-active",
  paused: "bg-status-paused/20 text-status-paused",
  closed: "bg-status-closed/20 text-status-closed",
  archived: "bg-status-closed/20 text-status-closed",
};

export default function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? "bg-border text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
