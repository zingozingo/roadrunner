import PageHeader from "@/components/PageHeader";
import InboxClient from "@/components/InboxClient";
import {
  getUnresolvedReviewsWithMessages,
  getOrphanedMessages,
  getUnresolvedEventApprovals,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [reviews, orphaned, eventApprovals] = await Promise.all([
    getUnresolvedReviewsWithMessages(),
    getOrphanedMessages(),
    getUnresolvedEventApprovals(),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inbox"
        subtitle="Review AI classifications and assign messages to initiatives"
      />
      <InboxClient
        initialReviews={reviews}
        initialEventApprovals={eventApprovals}
        initialOrphaned={orphaned}
      />
    </div>
  );
}
