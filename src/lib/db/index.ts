// Client
export { getSupabaseClient, supabase } from "./client";

// Messages
export {
  messageFingerprint,
  storeMessages,
  stampMessagesWithClassification,
  linkMessagesToEngagement,
  getUnroutedPartnerlessMessages,
  stampPartnerOnMessages,
  reparentMessagesToEngagement,
  updateMessagesEngagement,
  deleteMessagesByIds,
  findMessageById,
  getUnclassifiedMessages,
} from "./messages";

// Engagements
export {
  getActiveEngagements,
  getActiveEngagementsByPartner,
  getEngagementsByPartner,
  getEngagementNamesById,
  getAllEngagements,
  getEngagementById,
  getEngagementsWithMessageCounts,
  getEngagementHistory,
  createEngagement,
  updateEngagement,
  deleteEngagement,
  deleteEngagementRecord,
  updateMessageEngagement,
  deleteMessagesByEngagement,
  getMessagesByEngagement,
  getParticipantsByEngagement,
  getEngagementItemCounts,
} from "./engagements";

// Meetings
export {
  getMeetingsByPartner,
  getMeetingTitlesById,
  getAnchorDaysByMeetingIds,
  stampPartnerOnMeetingsByMessageIds,
  getMeetingsWithEngagements,
  getUpcomingMeetings,
  getRecentMeetingsByPartner,
  getMeetingDatesByPartner,
  getOverdueRecurringCandidates,
  getFutureMeetingsInSeries,
  getSeriesRootAnchorDay,
  insertSpawnedMeeting,
  getFutureSeriesMeetingsExcluding,
  stampPartnerOnMeeting,
  reparentMeetingsToEngagement,
  getMeetingsByMessageIds,
  updateMeetingsEngagement,
  deleteMeetingsByIds,
  endMeetingSeries,
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
export { getPartners, getPartner, getPartnerByName, resolvePartnerByName, updatePartnerRecord, deletePartnerRecord } from "./partners";

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
  mergeEngagementParticipants,
  searchParticipants,
  getParticipantPartnerConnections,
  findParticipantByEmail,
  createParticipantRecord,
  createParticipantWithLink,
  upsertParticipants,
  backfillMessageSenderNames,
  upsertContactToRegistry,
  linkPartnerParticipant,
  syncPartnerContactsToRegistry,
  syncMeetingAttendeesToRegistry,
  copyMeetingParticipants,
  replaceMeetingParticipants,
  getAllParticipantsForNameResolution,
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
  getCondensedByMeetingIds,
  getPreviousNotesByEngagement,
  getPreviousNotesBySeries,
  getMeetingIdsWithNotes,
  reparentNotesToEngagement,
  reparentTasksToEngagement,
  getNotesByMeetingIds,
  updateNotesEngagement,
  getTasksByNoteIds,
  updateTasksEngagement,
  deleteTasksByIds,
  deleteNotesByIds,
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
  replacePartnerSynthesis,
  getPartnerScratchpad,
} from "./partner-context";

// Ring 3 (Goals, Enrollments, Event Participations, Funding)
export {
  upsertPartnerGoal,
  upsertPartnerProgramEnrollment,
  upsertPartnerEventParticipation,
  upsertMpoppFunding,
  upsertMdfFunding,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  createEventParticipation,
  updateEventParticipation,
  deleteEventParticipation,
  getPartnerGoals,
  getPartnerProgramEnrollments,
  getPartnerEventParticipations,
  getPartnerMpoppFunding,
  getPartnerMdfFunding,
} from "./ring3";
