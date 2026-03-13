// Client
export { getSupabaseClient, supabase } from "./client";

// Messages
export {
  messageFingerprint,
  storeMessages,
  findMessageById,
  getUnclassifiedMessages,
} from "./messages";

// Engagements
export {
  getActiveEngagements,
  getAllEngagements,
  getEngagementById,
  getEngagementsWithMessageCounts,
  getEngagementHistory,
  createEngagement,
  updateEngagement,
  deleteEngagement,
  updateMessageEngagement,
  deleteMessagesByEngagement,
  getMessagesByEngagement,
  getParticipantsByEngagement,
} from "./engagements";

// Meetings
export {
  getMeetingsWithEngagements,
  getUpcomingMeetings,
  getMeeting,
  getMeetingsByEngagement,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  createMeetingFromICS,
  linkMeetingToEngagement,
  linkEngagementAwsRelationship,
} from "./meetings";

// Partners
export { getPartners, getPartner, getPartnerByName } from "./partners";

// Catalog (Events + Programs)
export {
  getActiveEvents,
  getActivePrograms,
  getAllEventsWithCounts,
  getAllProgramsWithCounts,
  getEventById,
  getLinkedEngagementsForEntity,
  updateEvent,
  deleteEvent,
  getProgramById,
  updateProgram,
  deleteProgram,
} from "./catalog";

// AWS Relationships
export {
  getAwsRelationships,
  getAwsRelationshipsWithCounts,
  getAwsRelationship,
  getEngagementsByAwsRelationship,
  updateAwsRelationship,
  getAwsRelationshipsByEngagement,
  getAwsRelationshipsByPartner,
} from "./relationships";

// Entity Links
export {
  getEntityLinksForEntity,
  createEntityLink,
  resolveEntityLinkNames,
} from "./entity-links";

// Participants
export {
  getParticipantById,
  updateParticipant,
  deleteParticipantLink,
  createParticipantWithLink,
  upsertParticipants,
  backfillMessageSenderNames,
} from "./participants";

// Inbox (Approval Queue)
export {
  createApproval,
  getUnresolvedApprovals,
  getUnresolvedApprovalCount,
  resolveApproval,
} from "./inbox";

// Meeting Notes
export {
  createMeetingNote,
  getMeetingNote,
  getMeetingNoteByMeetingId,
  getMeetingNotesByPartner,
  updateMeetingNote,
  deleteMeetingNote,
  listMeetingNotes,
  createNoteTask,
  updateNoteTask,
  deleteNoteTask,
  deleteAiTasksForNote,
  getTasksByPartner,
  getOpenTasks,
  getRecentNoteSummaries,
} from "./meeting-notes";

// Partner Context (Scratchpad)
export {
  getPartnerContext,
  addPartnerContext,
  deletePartnerContext,
} from "./partner-context";
