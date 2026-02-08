import PageHeader from "@/components/PageHeader";
import InboxClient from "@/components/InboxClient";
import {
  getUnresolvedApprovals,
  getOrphanedMessages,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [approvals, orphaned] = await Promise.all([
    getUnresolvedApprovals(),
    getOrphanedMessages(),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inbox"
        subtitle="Review AI classifications and assign messages to initiatives"
      />
      <InboxClient
        initialApprovals={approvals}
        initialOrphaned={orphaned}
      />
    </div>
  );
}
