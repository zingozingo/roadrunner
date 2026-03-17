import { getInboxItems } from "@/lib/db";
import InboxClient from "@/components/inbox/InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const items = await getInboxItems();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Inbox</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Review and route unassigned messages to engagements
          </p>
        </div>
      </div>
      <InboxClient items={items} />
    </div>
  );
}
