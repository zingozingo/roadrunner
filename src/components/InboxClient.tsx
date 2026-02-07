"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PendingReview, Message } from "@/lib/types";
import ReviewCard from "./ReviewCard";
import OrphanedMessageCard from "./OrphanedMessageCard";
import EmptyState from "./EmptyState";

type ReviewWithMessage = PendingReview & { message: Message };

export default function InboxClient({
  initialReviews,
  initialOrphaned,
}: {
  initialReviews: ReviewWithMessage[];
  initialOrphaned: Message[];
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);

  function handleResolved(id: string) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

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
