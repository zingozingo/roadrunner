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
  linkEngagementRelationship,
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

// Relationships
export {
  getRelationships,
  getRelationshipsWithCounts,
  getRelationship,
  getEngagementsByRelationship,
  updateRelationship,
  getRelationshipsByEngagement,
  getRelationshipsByPartner,
} from "./relationships";

// Engagement Links (programs + events)
export {
  getEngagementPrograms,
  getProgramEngagements,
  linkEngagementToProgram,
  unlinkEngagementFromProgram,
  getEngagementEvents,
  getEventEngagements,
  linkEngagementToEvent,
  unlinkEngagementFromEvent,
} from "./engagement-links";

// Participants
export {
  getParticipantById,
  updateParticipant,
  deleteEngagementParticipant,
  createParticipantWithLink,
  upsertParticipants,
  backfillMessageSenderNames,
  upsertContactToRegistry,
  linkPartnerParticipant,
  linkRelationshipParticipant,
  syncPartnerContactsToRegistry,
  syncRelationshipContactsToRegistry,
  syncMeetingAttendeesToRegistry,
  replaceMeetingParticipants,
  getContactsByPartner,
  getContactsByPartnerBulk,
  getContactsByRelationship,
  getContactsByRelationshipBulk,
  getContactsByMeeting,
  getPartnerContactDomains,
} from "./participants";

// Inbox (message-based)
export {
  INBOX_GROUP_WINDOW_MS,
  getInboxItems,
  getInboxCount,
  getInboxGroupCount,
  setPartnerForInboxGroup,
  discardInboxItem,
  getMessagesForInboxItem,
} from "./inbox";
export type { InboxItem } from "./inbox";

// Meeting Notes
export {
  createMeetingNote,
  getMeetingNote,
  getMeetingNoteByMeetingId,
  getMeetingNotesByPartner,
  updateMeetingNote,
  deleteMeetingNote,
  listMeetingNotes,
  createTask,
  updateTask,
  deleteTask,
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
