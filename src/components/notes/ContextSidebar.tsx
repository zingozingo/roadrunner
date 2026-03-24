import type { DisplayContext } from "@/lib/types";
import ContactRow from "@/components/shared/ContactRow";
import { isNamedRole } from "@/lib/contact-display";

const OWNER_BADGE_STYLES: Record<string, { className: string; label: string }> = {
  me: { className: "bg-accent/10 text-accent", label: "Me" },
  partner: { className: "bg-emerald-500/10 text-emerald-400", label: "Partner" },
  internal: { className: "bg-amber-500/10 text-amber-400", label: "Internal" },
  third_party: { className: "bg-purple-500/10 text-purple-400", label: "3rd Party" },
};

export default function ContextSidebar({ context, currentNoteId }: { context: DisplayContext; currentNoteId?: string }) {
  const { contacts, openTasks, openTaskCount } = context;

  const keyContacts = contacts.filter((c) => isNamedRole(c.role));
  const hasContacts = keyContacts.length > 0;
  const hasTasks = openTaskCount > 0;

  if (!hasContacts && !hasTasks) return null;

  return (
    <div>
      {/* Key Contacts */}
      {hasContacts && (
        <section>
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
        </section>
      )}

      {/* Open Tasks */}
      {hasTasks && (
        <section className={hasContacts ? "mt-4 pt-4 border-t border-border/20" : ""}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Open Tasks
            <span className="ml-1.5 font-normal text-muted">{openTaskCount}</span>
          </h3>
          <div className="space-y-1">
            {openTasks.map((t, i) => {
              const isThisMeeting = currentNoteId && t.meeting_note_id === currentNoteId;
              return (
                <div key={i} className={`flex items-start gap-1.5 text-xs ${isThisMeeting ? "border-l-2 border-accent/40 pl-1.5" : ""}`}>
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  <span className="flex-1 text-foreground/80">{t.description}</span>
                  {t.owner && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${OWNER_BADGE_STYLES[t.owner]?.className ?? "bg-muted/10 text-muted"}`}>
                      {OWNER_BADGE_STYLES[t.owner]?.label ?? t.owner}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
