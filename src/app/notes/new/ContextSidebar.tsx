import type { DisplayContext } from "@/lib/types";

const PILLAR_COLORS: Record<string, string> = {
  "Co-Sell": "bg-blue-500/15 text-blue-400",
  "Co-Market": "bg-purple-500/15 text-purple-400",
  "Co-Build": "bg-emerald-500/15 text-emerald-400",
};

export default function ContextSidebar({ context }: { context: DisplayContext }) {
  const { profile, contacts, activeEngagements, openTasks, openTaskCount, hasSeedNote } = context;

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
        {hasSeedNote && (
          <span className="mt-2 inline-block rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
            Has Seed Note
          </span>
        )}
      </div>

      {/* Key Contacts */}
      {(contacts.alliance_lead || contacts.account_manager || contacts.psa) && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Key Contacts</h3>
          <div className="space-y-1.5 text-xs">
            {contacts.alliance_lead && (
              <div>
                <span className="text-muted">Alliance Lead:</span>{" "}
                <span className="text-foreground/80">{contacts.alliance_lead}</span>
              </div>
            )}
            {contacts.account_manager && (
              <div>
                <span className="text-muted">AM:</span>{" "}
                <span className="text-foreground/80">{contacts.account_manager}</span>
              </div>
            )}
            {contacts.psa && (
              <div>
                <span className="text-muted">PSA:</span>{" "}
                <span className="text-foreground/80">{contacts.psa}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Engagements */}
      {activeEngagements.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Active Engagements ({activeEngagements.length})
          </h3>
          <div className="space-y-1.5">
            {activeEngagements.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="truncate text-xs text-foreground/80">{e.name}</span>
                {e.pillar && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PILLAR_COLORS[e.pillar] ?? "bg-zinc-500/15 text-zinc-400"}`}>
                    {e.pillar}
                  </span>
                )}
              </div>
            ))}
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
