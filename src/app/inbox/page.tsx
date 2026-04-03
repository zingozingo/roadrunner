import { getInboxItems } from "@/lib/db";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import InboxClient from "@/components/inbox/InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const items = await getInboxItems();

  return (
    <PageContainer>
      <PageHeader
        title="Inbox"
        subtitle={items.length === 0 ? "No items in inbox" : `${items.length} item${items.length !== 1 ? "s" : ""} in inbox`}
      />
      <InboxClient items={items} />
    </PageContainer>
  );
}
