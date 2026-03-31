import { getInboxItems } from "@/lib/db";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import InboxClient from "@/components/inbox/InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const items = await getInboxItems();

  return (
    <PageContainer>
      <PageHeader title="Inbox" />
      <InboxClient items={items} />
    </PageContainer>
  );
}
