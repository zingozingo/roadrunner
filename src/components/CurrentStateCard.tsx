export default function CurrentStateCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Current State
      </h2>
      <div className="space-y-1.5">
        {text.split("\n").filter(Boolean).map((para, i) => (
          <p key={i} className="text-sm text-foreground/90">{para}</p>
        ))}
      </div>
    </div>
  );
}
