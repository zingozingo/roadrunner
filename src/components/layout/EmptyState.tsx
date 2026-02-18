export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-lg font-medium text-muted">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted/70">{description}</p>
      )}
    </div>
  );
}
