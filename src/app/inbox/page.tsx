import PageHeader from "@/components/layout/PageHeader";
import InboxClient from "@/components/inbox/InboxClient";
import { getUnresolvedApprovals } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const approvals = await getUnresolvedApprovals();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inbox"
        subtitle="Review AI classifications and assign messages to engagements"
      />
      <InboxClient initialApprovals={approvals} />
    </div>
  );
}
