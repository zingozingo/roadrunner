/**
 * Sync module barrel — re-exports public API for Airtable ↔ Supabase sync.
 */

// Pull: Airtable → Supabase
export {
  type SyncResult,
  type SyncAllResult,
  syncPrograms,
  syncEvents,
  syncRelationships,
  syncPartners,
  syncAllCatalogs,
  syncEntity,
} from "./pull";

// Push: Supabase → Airtable
export {
  type PushResult,
  pushEngagementToAirtable,
  deleteEngagementFromAirtable,
  syncEngagementsToAirtable,
  pushMeetingToAirtable,
  deleteMeetingFromAirtable,
  syncMeetingsToAirtable,
} from "./push";

// Utils
export { mapMeetingStatus } from "./utils";

// Field maps (re-export for consumers that need table/field IDs)
export {
  PROGRAMS_TABLE, EVENTS_TABLE, RELATIONSHIPS_TABLE, PARTNERS_TABLE,
  ENGAGEMENTS_TABLE, MEETINGS_TABLE,
  PF, EF, RF, PTRF, ENF, MF,
  NOTES_MARKER, NOTES_FOOTER,
} from "./field-maps";
