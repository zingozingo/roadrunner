"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApprovalQueueItem, Message, Initiative } from "@/lib/types";
import ReviewCard from "./ReviewCard";
import EventApprovalCard from "./EventApprovalCard";
import OrphanedMessageCard from "./OrphanedMessageCard";
import EmptyState from "./EmptyState";

type ApprovalWithContext = ApprovalQueueItem & {
  message: Message | null;
  initiative: Initiative | null;
};

export default function InboxClient({
  initialApprovals,
  initialOrphaned,
}: {
  initialApprovals: ApprovalWithContext[];
  initialOrphaned: Message[];
}) {
  const router = useRouter();
  const [approvals, setApprovals] = useState(initialApprovals);

  function handleResolved(id: string) {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    router.refresh();
  }

  const reviews = approvals.filter((a) => a.type === "initiative_assignment");
  const eventApprovals = approvals.filter((a) => a.type === "event_creation");

  return (
    <div className="space-y-8">
      {/* Pending reviews section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Pending Reviews
          {reviews.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              ({reviews.length})
            </span>
          )}
        </h2>
        {reviews.length === 0 ? (
          <EmptyState
            title="No pending reviews"
            description="All messages have been classified"
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onResolved={handleResolved}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pending event approvals section */}
      {eventApprovals.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Pending Event Approvals
            <span className="ml-2 text-sm font-normal text-muted">
              ({eventApprovals.length})
            </span>
          </h2>
          <div className="space-y-4">
            {eventApprovals.map((approval) => (
              <EventApprovalCard
                key={approval.id}
                approval={approval}
                onResolved={handleResolved}
              />
            ))}
          </div>
        </section>
      )}

      {/* Orphaned messages section */}
      {initialOrphaned.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Unclassified Messages
            <span className="ml-2 text-sm font-normal text-muted">
              ({initialOrphaned.length})
            </span>
          </h2>
          <div className="space-y-3">
            {initialOrphaned.map((msg) => (
              <OrphanedMessageCard key={msg.id} message={msg} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
