import { Message } from "@/lib/types";

export default function Timeline({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">No messages yet.</p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      {messages.map((msg) => (
        <div key={msg.id} className="relative flex gap-4 py-3">
          {/* Dot */}
          <div className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent ring-4 ring-background" />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {msg.sender_name || msg.sender_email || "Unknown"}
              </p>
              <time className="shrink-0 text-xs text-muted">
                {msg.sent_at
                  ? new Date(msg.sent_at).toLocaleDateString()
                  : ""}
              </time>
            </div>
            {msg.subject && (
              <p className="mt-0.5 text-sm text-foreground/80">
                {msg.subject}
              </p>
            )}
            {msg.body_text && (
              <p className="mt-1 line-clamp-2 text-sm text-muted">
                {msg.body_text.slice(0, 200)}
                {msg.body_text.length > 200 ? "..." : ""}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
