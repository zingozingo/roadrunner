import {
  updateMessagesEngagement,
  getMeetingsByMessageIds,
  updateMeetingsEngagement,
  getNotesByMeetingIds,
  updateNotesEngagement,
  getTasksByNoteIds,
  updateTasksEngagement,
  deleteTasksByIds,
  deleteNotesByIds,
  deleteMeetingsByIds,
  deleteMessagesByIds,
  getEngagementItemCounts,
  getEngagementById,
  getMessagesByEngagement,
  getPartner,
  updateEngagement,
} from "@/lib/db";
import {
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Message } from "@/lib/types";

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
 * (or to null/inbox). Cascades linked entities, then re-synthesizes both source
 * and target engagements.
 *
 * Cascade chain:
 * 1. Move selected messages (update engagement_id)
 * 2. Cascade meetings from messages (meetings linked via message_id)
 * 3. Move standalone meetings (explicitly selected, no message_id)
 * 4. Cascade notes from all moved meetings (via meeting_id)
 * 5. Cascade tasks from all moved notes (via meeting_note_id)
 * 6. Check if source engagement is now empty
 * 7. Re-synthesize source (Option C: clear + rebuild from remaining)
 * 8. Re-synthesize target (incremental: moved messages as "new")
 * 9. Push both to Airtable
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

  // Step 7: Re-synthesize source (Option C — clear + rebuild from remaining)
  await resynthesizeSource(sourceEngagementId, sourceEmpty);

  // Step 8: Re-synthesize target (incremental — moved messages as "new")
  if (targetEngagementId) {
    await resynthesizeTarget(targetEngagementId, messageIds);
  }

  return {
    movedMessages,
    movedMeetings,
    movedNotes,
    movedTasks,
    sourceEmpty,
  };
}

// --- Re-synthesis helpers ---

/**
 * Source re-synthesis: Option C — clear current_state and condensed,
 * then rebuild from the latest 10 remaining messages.
 * If source is empty (no remaining messages), skip synthesis entirely.
 */
async function resynthesizeSource(
  sourceEngagementId: string,
  sourceEmpty: boolean
): Promise<void> {
  if (sourceEmpty) {
    console.log(`[reassign] Source is empty, skipping re-synthesis`);
    return;
  }

  try {
    // Clear stale summary before rebuilding
    await updateEngagement(sourceEngagementId, {
      current_state: null,
      condensed: null,
    });

    // Fetch remaining messages (DESC order, take latest 10)
    const remaining = await getMessagesByEngagement(sourceEngagementId);
    const latest10 = remaining.slice(0, 10);

    if (latest10.length === 0) {
      console.log(`[reassign] No remaining messages for source re-synthesis`);
      return;
    }

    const source = await getEngagementById(sourceEngagementId);
    if (!source || !source.partner_id) {
      console.error(`[reassign] Source engagement not found for re-synthesis`);
      return;
    }

    const partner = await getPartner(source.partner_id);
    const phase1 = buildSyntheticPhase1Result(
      sourceEngagementId,
      source.partner_id,
      partner?.name ?? "Unknown",
      false,
      source.name
    );

    const result = await synthesizeIntoEngagement(
      latest10 as Message[],
      phase1
    );
    await persistClassificationResult(
      result,
      sourceEngagementId,
      latest10.map((m) => m.id),
      false
    );
    console.log(`[reassign] Source re-synthesized from ${latest10.length} remaining messages`);

    // Push source to Airtable
    const { pushEngagementToAirtable } = await import("@/lib/sync");
    await pushEngagementToAirtable(sourceEngagementId);
    console.log(`[reassign] Airtable push: source ${sourceEngagementId}`);
  } catch (err) {
    console.error(`[reassign] Source re-synthesis failed (reassignment still succeeded):`, err);
  }
}

/**
 * Target re-synthesis: incremental — moved messages treated as "new" arriving
 * at the target engagement. Uses the normal synthesis pipeline which evolves
 * the target's existing current_state.
 */
async function resynthesizeTarget(
  targetEngagementId: string,
  movedMessageIds: string[]
): Promise<void> {
  if (movedMessageIds.length === 0) {
    console.log(`[reassign] No messages to synthesize into target`);
    return;
  }

  try {
    const target = await getEngagementById(targetEngagementId);
    if (!target || !target.partner_id) {
      console.error(`[reassign] Target engagement not found for re-synthesis`);
      return;
    }

    // Fetch the moved messages (now belonging to target)
    // We need the full message objects, not just IDs
    const allTargetMessages = await getMessagesByEngagement(targetEngagementId);
    const movedMessages = allTargetMessages.filter((m) =>
      movedMessageIds.includes(m.id)
    );

    if (movedMessages.length === 0) {
      console.log(`[reassign] Moved messages not found in target for re-synthesis`);
      return;
    }

    const partner = await getPartner(target.partner_id);
    const phase1 = buildSyntheticPhase1Result(
      targetEngagementId,
      target.partner_id,
      partner?.name ?? "Unknown",
      false,
      target.name
    );

    const result = await synthesizeIntoEngagement(
      movedMessages as Message[],
      phase1
    );
    await persistClassificationResult(
      result,
      targetEngagementId,
      movedMessages.map((m) => m.id),
      false
    );
    console.log(`[reassign] Target re-synthesized with ${movedMessages.length} moved messages`);

    // Push target to Airtable
    const { pushEngagementToAirtable } = await import("@/lib/sync");
    await pushEngagementToAirtable(targetEngagementId);
    console.log(`[reassign] Airtable push: target ${targetEngagementId}`);
  } catch (err) {
    console.error(`[reassign] Target re-synthesis failed (reassignment still succeeded):`, err);
  }
}

// --- Discard service ---

export interface DiscardInput {
  messageIds: string[];
  meetingIds: string[];
  sourceEngagementId: string;
}

export interface DiscardResult {
  deletedMessages: number;
  deletedMeetings: number;
  sourceEmpty: boolean;
}

/**
 * Hard-delete selected messages and standalone meetings from an engagement.
 * Cascades: find linked meetings → find notes → find tasks → delete in
 * reverse FK order (tasks → notes → meetings → messages).
 * Re-synthesizes source engagement after deletion.
 */
export async function discardFromEngagement(
  input: DiscardInput
): Promise<DiscardResult> {
  const { messageIds, meetingIds, sourceEngagementId } = input;

  console.log(
    `[discard] Deleting ${messageIds.length} messages + ${meetingIds.length} standalone meetings from ${sourceEngagementId}`
  );

  // Find all meetings linked to selected messages (via message_id FK)
  const linkedMeetings = await getMeetingsByMessageIds(messageIds);
  const linkedMeetingIds = linkedMeetings.map((m) => m.id);

  // Collect all meeting IDs to cascade (linked + standalone)
  const allMeetingIds = [...linkedMeetingIds, ...meetingIds];

  // Find notes linked to all meetings being deleted
  const linkedNotes = await getNotesByMeetingIds(allMeetingIds);
  const linkedNoteIds = linkedNotes.map((n) => n.id);

  // Find tasks linked to those notes
  const linkedTasks = await getTasksByNoteIds(linkedNoteIds);
  const linkedTaskIds = linkedTasks.map((t) => t.id);

  // Delete in FK-safe order: tasks → notes → meetings → messages
  if (linkedTaskIds.length > 0) {
    const count = await deleteTasksByIds(linkedTaskIds);
    console.log(`[discard] Deleted ${count} tasks`);
  }

  if (linkedNoteIds.length > 0) {
    const count = await deleteNotesByIds(linkedNoteIds);
    console.log(`[discard] Deleted ${count} notes`);
  }

  let deletedMeetings = 0;
  if (allMeetingIds.length > 0) {
    deletedMeetings = await deleteMeetingsByIds(allMeetingIds);
    console.log(`[discard] Deleted ${deletedMeetings} meetings`);
  }

  let deletedMessages = 0;
  if (messageIds.length > 0) {
    deletedMessages = await deleteMessagesByIds(messageIds);
    console.log(`[discard] Deleted ${deletedMessages} messages`);
  }

  // Check if source engagement is now empty
  const counts = await getEngagementItemCounts(sourceEngagementId);
  const sourceEmpty = counts.messages === 0 && counts.meetings === 0;

  if (sourceEmpty) {
    console.log(`[discard] Source engagement ${sourceEngagementId} is now empty`);
  }

  // Re-synthesize source (Option C: clear + rebuild from remaining)
  await resynthesizeSource(sourceEngagementId, sourceEmpty);

  return {
    deletedMessages,
    deletedMeetings,
    sourceEmpty,
  };
}
