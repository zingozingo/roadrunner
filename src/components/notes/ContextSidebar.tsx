import type { DisplayContext } from "@/lib/types";
import ContactRow from "@/components/shared/ContactRow";
import { isNamedRole } from "@/lib/contact-display";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ContextSidebar({ context }: { context: DisplayContext }) {
  const { profile, contacts, openTasks, openTaskCount, scratchpadEntries } = context;

  return (
    <div className="space-y-4">
      {/* Partner Profile */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Partner Profile</h3>
        <p className="text-sm font-medium text-foreground">{profile.name}</p>
        {profile.segment && <p className="text-xs text-muted">{profile.segment}</p>}
        {profile.what_they_do && <p className="mt-1 text-xs text-foreground/70">{profile.what_they_do}</p>}
        {profile.focus_areas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.focus_areas.map((f) => (
              <span key={f} className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted">{f}</span>
            ))}
          </div>
        )}
        {profile.key_aws_services.length > 0 && (
          <p className="mt-1 text-xs text-muted">AWS: {profile.key_aws_services.join(", ")}</p>
        )}
        {profile.architecture && (
          <p className="mt-1 text-xs text-muted">Architecture: <span className="text-foreground/80">{profile.architecture}</span></p>
        )}
        {profile.listing_types.length > 0 && (
          <p className="mt-1 text-xs text-muted">Listings: <span className="text-foreground/80">{profile.listing_types.join(", ")}</span></p>
        )}
        {profile.pricing_model.length > 0 && (
          <p className="mt-1 text-xs text-muted">Pricing: <span className="text-foreground/80">{profile.pricing_model.join(", ")}</span></p>
        )}
      </div>

      {/* Key Contacts */}
      {(() => {
        const keyContacts = contacts.filter((c) => isNamedRole(c.role));
        return keyContacts.length > 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Key Contacts</h3>
            <div className="space-y-2">
              {keyContacts.map((c, i) => (
                <ContactRow
                  key={c.email ?? i}
                  name={c.name}
                  email={c.email}
                  title={c.title}
                  role={c.role}
                  orgType={c.org_type}
                />
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Partner Context (scratchpad entries) */}
      {scratchpadEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Partner Context</h3>
          <div className="space-y-1.5">
            {scratchpadEntries.slice(0, 5).map((e, i) => (
              <div key={i}>
                <p className="text-xs text-foreground/70">
                  {e.content.length > 100 ? e.content.slice(0, 100) + "..." : e.content}
                </p>
                <span className="text-[10px] text-muted">{relativeTime(e.created_at)}</span>
              </div>
            ))}
            {scratchpadEntries.length > 5 && (
              <p className="text-[10px] text-muted">(+{scratchpadEntries.length - 5} more)</p>
            )}
          </div>
        </div>
      )}

      {/* Open Tasks */}
      {openTaskCount > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Open Tasks ({openTaskCount})
          </h3>
          <div className="space-y-1">
            {openTasks.map((t, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                <span className="text-foreground/80">{t.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
