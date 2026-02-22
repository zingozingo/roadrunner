import { Message } from "@/lib/types";
import { displayName, formatFooterDate } from "@/lib/format-utils";

export default function OrphanedMessageCard({
  message,
}: {
  message: Message;
}) {
  const bodyPreview = message.body_text?.slice(0, 150) || "";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {displayName(message.sender_name, message.sender_email)}
          </p>
          {message.subject && (
            <p className="mt-0.5 text-sm text-foreground/80">
              {message.subject}
            </p>
          )}
        </div>
        <time className="text-xs text-muted">
          {message.sent_at ? formatFooterDate(message.sent_at) : "No date"}
        </time>
      </div>
      {bodyPreview && (
        <p className="mt-2 text-sm text-muted">
          {bodyPreview}
          {(message.body_text?.length ?? 0) > 150 ? "..." : ""}
        </p>
      )}
      {message.content_type && (
        <span className="mt-2 inline-block rounded bg-border px-2 py-0.5 text-xs text-muted">
          {message.content_type}
        </span>
      )}
    </div>
  );
}
