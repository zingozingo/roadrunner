import ContactRow from "./ContactRow";
import { sortContactsByRole } from "@/lib/contact-display";

export interface ContactGroupContact {
  name: string | null;
  email: string | null;
  title: string | null;
  role: string | null;
  org_type: string | null;
}

interface ContactGroupProps {
  contacts: ContactGroupContact[];
  currentUserEmail?: string;
  showOrgHeaders?: boolean;
}

const GROUP_CONFIG: { key: string; label: string }[] = [
  { key: "partner", label: "Partner Team" },
  { key: "internal", label: "AWS Team" },
  { key: "third_party", label: "Third Party" },
];

export default function ContactGroup({
  contacts,
  currentUserEmail,
  showOrgHeaders = true,
}: ContactGroupProps) {
  const normalizedUserEmail = currentUserEmail?.toLowerCase();

  if (!showOrgHeaders) {
    const sorted = sortContactsByRole(contacts);
    return (
      <div className="space-y-3">
        {sorted.map((c, i) => (
          <ContactRow
            key={i}
            name={c.name}
            email={c.email}
            title={c.title}
            role={c.role}
            orgType={c.org_type}
            isCurrentUser={
              !!normalizedUserEmail &&
              !!c.email &&
              c.email.toLowerCase() === normalizedUserEmail
            }
          />
        ))}
      </div>
    );
  }

  // Group by org_type
  const groups = GROUP_CONFIG.map(({ key, label }) => {
    const members = sortContactsByRole(
      contacts.filter((c) => c.org_type === key)
    );
    return { key, label, members };
  }).filter((g) => g.members.length > 0);

  // Contacts with no org_type
  const untyped = sortContactsByRole(
    contacts.filter((c) => !c.org_type || !GROUP_CONFIG.some((g) => g.key === c.org_type))
  );
  if (untyped.length > 0) {
    groups.push({ key: "other", label: "Other", members: untyped });
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1.5">
            {group.label}
          </h3>
          <div className="space-y-3">
            {group.members.map((c, i) => (
              <ContactRow
                key={i}
                name={c.name}
                email={c.email}
                title={c.title}
                role={c.role}
                orgType={c.org_type}
                isCurrentUser={
                  !!normalizedUserEmail &&
                  !!c.email &&
                  c.email.toLowerCase() === normalizedUserEmail
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
