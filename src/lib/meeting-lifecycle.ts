import { cascadeEngagementToTasks } from "@/lib/db";

/**
 * Handle side effects when a meeting's engagement link changes.
 * Pushes the engagement to Airtable and cascades engagement_id to tasks
 * from this meeting's notes.
 */
export async function handleMeetingEngagementChange(
  meetingId: string,
  newEngagementId: string | null,
  oldEngagementId: string | null | undefined
): Promise<void> {
  // Push engagement to Airtable when linked (not unlinked)
  if (newEngagementId) {
    try {
      const { pushEngagementToAirtable } = await import("@/lib/sync");
      await pushEngagementToAirtable(newEngagementId);
      console.log(`Engagement activity summary refreshed for ${newEngagementId} after meeting link`);
    } catch (err) {
      console.error(`Engagement sync failed for ${newEngagementId}:`, err);
    }
  }

  // Cascade engagement_id to tasks from this meeting's notes
  try {
    await cascadeEngagementToTasks(meetingId, newEngagementId, oldEngagementId);
  } catch (err) {
    console.error(`Task cascade failed for meeting ${meetingId}:`, err);
  }
}
