import { getInboxItems } from "@/lib/db";
import PageHeader from "@/components/layout/PageHeader";
import InboxClient from "@/components/inbox/InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const items = await getInboxItems();

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <PageHeader title="Inbox" />
      <InboxClient items={items} />
    </div>
  );
}
