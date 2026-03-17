import { getInboxItems } from "@/lib/db";
import PageHeader from "@/components/layout/PageHeader";
import InboxClient from "@/components/inbox/InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const items = await getInboxItems();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inbox"
        subtitle={`${items.length} unrouted message${items.length !== 1 ? "s" : ""}`}
      />
      <InboxClient items={items} />
    </div>
  );
}
