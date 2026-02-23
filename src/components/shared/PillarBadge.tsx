import type { Pillar } from "@/lib/types";

const pillarColors: Record<Pillar, string> = {
  "Co-Sell": "bg-blue-500/15 text-blue-400",
  "Co-Build": "bg-purple-500/15 text-purple-400",
  "Co-Market": "bg-emerald-500/15 text-emerald-400",
};

export default function PillarBadge({ pillar }: { pillar: Pillar | null }) {
  if (!pillar) return null;

  const colors = pillarColors[pillar] ?? "bg-border text-muted";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {pillar}
    </span>
  );
}
