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
  getActiveEngagementsByPartner,
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
  getRecentMeetingsByPartner,
  getMeetingDatesByPartner,
  getOverdueRecurringCandidates,
  getFutureMeetingsInSeries,
  getSeriesRootAnchorDay,
  insertSpawnedMeeting,
  getMeeting,
  getSeriesSiblings,
  getMeetingsByEngagement,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  createMeetingFromICS,
  linkMeetingToEngagement,
  cascadeEngagementToTasks,
} from "./meetings";

// Partners
export { getPartners, getPartner, getPartnerByName, resolvePartnerByName } from "./partners";

// Catalog (Events + Programs)
export {
  getActiveEvents,
  getActivePrograms,
  getAllEventsWithCounts,
  getAllProgramsWithCounts,
  getEventById,
  updateEvent,
  deleteEvent,
  getProgramById,
  updateProgram,
  deleteProgram,
} from "./catalog";

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
  syncPartnerContactsToRegistry,
  syncMeetingAttendeesToRegistry,
  copyMeetingParticipants,
  replaceMeetingParticipants,
  getContactsByPartner,
  getContactsByPartnerBulk,
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
  getCompletedTasks,
  getRecentNoteSummaries,
  getRecentCondensedDigests,
  getCondensedDigestsByEngagement,
  getStandaloneCondensedDigests,
} from "./meeting-notes";

// Partner Context (Scratchpad)
export {
  getPartnerContext,
  addPartnerContext,
  deletePartnerContext,
  getPartnerScratchpad,
} from "./partner-context";

// Ring 3 (Goals, Enrollments, Event Participations, Funding)
export {
  upsertPartnerGoal,
  upsertPartnerProgramEnrollment,
  upsertPartnerEventParticipation,
  upsertMpoppFunding,
  upsertMdfFunding,
  getPartnerGoals,
  getPartnerProgramEnrollments,
  getPartnerEventParticipations,
  getPartnerMpoppFunding,
  getPartnerMdfFunding,
} from "./ring3";
