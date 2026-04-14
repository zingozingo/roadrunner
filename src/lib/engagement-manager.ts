import {
  updateMessagesEngagement,
  getMeetingsByMessageIds,
  updateMeetingsEngagement,
  getNotesByMeetingIds,
  updateNotesEngagement,
  getTasksByNoteIds,
  updateTasksEngagement,
  getEngagementItemCounts,
} from "@/lib/db";

// --- Types ---

export interface ReassignInput {
  messageIds: string[];       // Messages selected by user
  meetingIds: string[];       // Standalone meetings selected (no message_id link)
  sourceEngagementId: string;
  targetEngagementId: string | null;  // null = return to inbox
}

export interface ReassignResult {
  movedMessages: number;
  movedMeetings: number;
  movedNotes: number;
  movedTasks: number;
  sourceEmpty: boolean;
}

// --- Main service function ---

/**
 * Move selected messages and standalone meetings from one engagement to another
 * (or to null/inbox). Cascades linked entities: messages -> meetings (via message_id)
 * -> notes -> tasks. Does NOT handle re-synthesis — that is layered on top by the caller
 * or by Task 8.2's integration.
 *
 * Cascade chain:
 * 1. Move selected messages (update engagement_id)
 * 2. Cascade meetings from messages (meetings linked via message_id)
 * 3. Move standalone meetings (explicitly selected, no message_id)
 * 4. Cascade notes from all moved meetings (via meeting_id)
 * 5. Cascade tasks from all moved notes (via meeting_note_id)
 * 6. Check if source engagement is now empty
 */
export async function reassignMessages(
  input: ReassignInput
): Promise<ReassignResult> {
  const { messageIds, meetingIds, sourceEngagementId, targetEngagementId } = input;

  console.log(
    `[reassign] Moving ${messageIds.length} messages + ${meetingIds.length} standalone meetings from ${sourceEngagementId} to ${targetEngagementId ?? "inbox"}`
  );

  // Step 1: Move selected messages
  const movedMessages = await updateMessagesEngagement(messageIds, targetEngagementId);
  console.log(`[reassign] Moved ${movedMessages} messages`);

  // Step 2: Cascade meetings linked to moved messages (via message_id FK)
  const linkedMeetings = await getMeetingsByMessageIds(messageIds);
  const linkedMeetingIds = linkedMeetings.map((m) => m.id);
  let movedMeetings = 0;

  if (linkedMeetingIds.length > 0) {
    movedMeetings += await updateMeetingsEngagement(linkedMeetingIds, targetEngagementId);
    console.log(`[reassign] Cascaded ${movedMeetings} meetings from messages`);
  }

  // Step 3: Move standalone meetings (explicitly selected by user)
  if (meetingIds.length > 0) {
    const standaloneCount = await updateMeetingsEngagement(meetingIds, targetEngagementId);
    movedMeetings += standaloneCount;
    console.log(`[reassign] Moved ${standaloneCount} standalone meetings`);
  }

  // Collect all moved meeting IDs for note/task cascade
  const allMovedMeetingIds = [...linkedMeetingIds, ...meetingIds];

  // Step 4: Cascade notes from all moved meetings
  const linkedNotes = await getNotesByMeetingIds(allMovedMeetingIds);
  const linkedNoteIds = linkedNotes.map((n) => n.id);
  let movedNotes = 0;

  if (linkedNoteIds.length > 0) {
    movedNotes = await updateNotesEngagement(linkedNoteIds, targetEngagementId);
    console.log(`[reassign] Cascaded ${movedNotes} notes`);
  }

  // Step 5: Cascade tasks from all moved notes
  const linkedTasks = await getTasksByNoteIds(linkedNoteIds);
  const linkedTaskIds = linkedTasks.map((t) => t.id);
  let movedTasks = 0;

  if (linkedTaskIds.length > 0) {
    movedTasks = await updateTasksEngagement(linkedTaskIds, targetEngagementId);
    console.log(`[reassign] Cascaded ${movedTasks} tasks`);
  }

  // Step 6: Check if source engagement is now empty
  const counts = await getEngagementItemCounts(sourceEngagementId);
  const sourceEmpty = counts.messages === 0 && counts.meetings === 0;

  if (sourceEmpty) {
    console.log(`[reassign] Source engagement ${sourceEngagementId} is now empty`);
  }

  return {
    movedMessages,
    movedMeetings,
    movedNotes,
    movedTasks,
    sourceEmpty,
  };
}
