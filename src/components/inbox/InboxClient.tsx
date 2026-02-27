"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApprovalQueueItem, Message, Engagement } from "@/lib/types";
import ReviewCard from "./ReviewCard";
import EmptyState from "../layout/EmptyState";

type ApprovalWithContext = ApprovalQueueItem & {
  message: Message | null;
  engagement: Engagement | null;
};

export default function InboxClient({
  initialApprovals,
}: {
  initialApprovals: ApprovalWithContext[];
}) {
  const router = useRouter();
  const [approvals, setApprovals] = useState(initialApprovals);

  function handleResolved(id: string) {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Pending Reviews
          {approvals.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              ({approvals.length})
            </span>
          )}
        </h2>
        {approvals.length === 0 ? (
          <EmptyState
            title="No pending reviews"
            description="All messages have been classified"
          />
        ) : (
          <div className="space-y-4">
            {approvals.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onResolved={handleResolved}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
