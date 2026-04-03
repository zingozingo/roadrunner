import Link from "next/link";
import { getDisplayRole, isNamedRole } from "@/lib/contact-display";

export interface ContactRowProps {
  name: string | null;
  email: string | null;
  title: string | null;
  role: string | null;
  orgType: string | null;
  isCurrentUser?: boolean;
}

export default function ContactRow({
  name,
  email,
  title,
  role,
  orgType,
  isCurrentUser = false,
}: ContactRowProps) {
  const displayLabel = getDisplayRole(role, title, orgType);
  const namedRole = isNamedRole(role);

  // Name line: name or email prefix fallback
  const displayName =
    name ?? (email ? email.split("@")[0] : "Unknown");
  const peopleHref = `/people?q=${encodeURIComponent(name ?? email ?? "")}`;

  if (isCurrentUser) {
    return (
      <div>
        <div className="text-sm text-foreground">
          <span className="font-medium">{displayName}</span>
        </div>
        <p className="text-xs text-muted italic">You</p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm text-foreground">
        <Link href={peopleHref} className="font-medium hover:text-accent transition-colors">{displayName}</Link>
        {displayLabel && (
          <span className="text-xs text-muted ml-1.5">{displayLabel}</span>
        )}
      </div>
      {namedRole && title && (
        <p className="text-xs text-muted/70">{title}</p>
      )}
      {email && email !== "—" && (
        <a
          href={`mailto:${email}`}
          className="text-[11px] text-accent/70 hover:text-accent"
        >
          {email}
        </a>
      )}
    </div>
  );
}
