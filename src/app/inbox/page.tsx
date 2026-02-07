import PageHeader from "@/components/PageHeader";
import InboxClient from "@/components/InboxClient";
import {
  getUnresolvedReviewsWithMessages,
  getOrphanedMessages,
} from "@/lib/supabase";

export default async function InboxPage() {
  const [reviews, orphaned] = await Promise.all([
    getUnresolvedReviewsWithMessages(),
    getOrphanedMessages(),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inbox"
        subtitle="Review AI classifications and assign messages to initiatives"
      />
      <InboxClient initialReviews={reviews} initialOrphaned={orphaned} />
    </div>
  );
}
