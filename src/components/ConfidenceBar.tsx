export default function ConfidenceBar({
  confidence,
}: {
  confidence: number;
}) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 85
      ? "bg-confidence-high"
      : pct >= 50
        ? "bg-confidence-medium"
        : "bg-confidence-low";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-border">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted">{pct}%</span>
    </div>
  );
}
