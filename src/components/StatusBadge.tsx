const statusColors: Record<string, string> = {
  planned: "bg-status-planned/20 text-status-planned",
  active: "bg-status-active/20 text-status-active",
  paused: "bg-status-paused/20 text-status-paused",
  completed: "bg-status-completed/20 text-status-completed",
  archived: "bg-status-completed/20 text-status-completed",
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
