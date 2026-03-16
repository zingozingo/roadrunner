import { Participant } from "@/lib/types";
import ContactRow from "./ContactRow";
import { isUserEmail } from "@/lib/user-config";

type ParticipantWithLink = Participant & { role: string | null; linkId: string };

export default function ParticipantList({
  participants,
}: {
  participants: ParticipantWithLink[];
}) {
  if (participants.length === 0) {
    return <p className="text-sm text-muted">None yet</p>;
  }

  return (
    <ul className="space-y-2">
      {participants.map((p) => {
        const isCurrentUser = p.email ? isUserEmail(p.email) : false;
        return (
          <li key={p.linkId} className="text-sm">
            <ContactRow
              name={p.name}
              email={p.email}
              title={p.title}
              role={p.role}
              orgType={p.org_type ?? null}
              isCurrentUser={isCurrentUser}
            />
          </li>
        );
      })}
    </ul>
  );
}
