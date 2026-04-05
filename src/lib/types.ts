// ============================================================
// Contact types — unified "Name <email> (Title)" format
// ============================================================

export interface Contact {
  name: string | null;
  email: string | null;
  title: string | null;
}

export interface RoleContact extends Contact {
  role: string;
}

// ============================================================
// Database row types
// ============================================================

export type Pillar = "Co-Sell" | "Co-Market" | "Co-Build";

export interface Engagement {
  id: string;
  name: string;
  status: "active" | "planned" | "blocked" | "completed" | "archived";
  current_state: string | null;
  condensed: string | null;
  topic: string | null;
  partner_id: string | null;
  pillar: Pillar | null;
  program_id: string | null;
  airtable_record_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Event {
  id: string;
  name: string;
  type: "conference" | "summit" | "workshop" | "trade_show" | "training" | "webinar" | "roundtable";
  start_date: string | null;
  end_date: string | null;
  host: string | null;
  location: string | null;
  description: string | null;
  geo: string | null;
  source: "seed" | "email_extracted" | "user_created";
  verified: boolean;
  sponsor_option: boolean;
  partner_day_date: string | null;
  event_url: string | null;
  internal_links: string | null;
  archived: boolean;
  airtable_record_id: string | null;
  created_at: string;
}

export type ProgramCategory = "Specialization" | "Funding" | "Agreement" | "Operational" | "Enablement";

export type ProgramSubtype = "Competency" | "Service Ready" | "MSP" | "Sub-Category" | "MDF" | "Credit Program" | "Hybrid" | "SCA" | "Co-Sell" | "Channel" | "Migration" | "Workshop" | "Certification";

export interface Program {
  id: string;
  name: string;
  category: ProgramCategory | null;
  subtype: ProgramSubtype | null;
  mdf_value: number | null;
  sca_stackable: boolean;
  partner_path: string | null;
  parent_program_airtable_id: string | null;
  description: string | null;
  requirements: string | null;
  what_it_unlocks: string | null;
  notes: string | null;
  lifecycle_type: "indefinite" | "recurring" | "expiring";
  lifecycle_duration: string | null;
  airtable_record_id: string | null;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  segment: string | null;
  focus_area: string[];
  spms_id: number | null;
  what_they_do: string | null;
  aws_stickiness: string | null;
  key_aws_services: string[];
  architecture?: string | null;
  listing_types?: string[] | null;
  pricing_model?: string[] | null;
  isva_status?: string | null;
  deployed_on_aws?: string | null;
  prm_status?: string | null;
  crm_platform?: string | null;
  crm_notes?: string | null;
  mp_tcv_goal?: number | null;
  larr_goal?: number | null;
  mp_tcv_ytd?: number | null;
  larr_ytd?: number | null;
  mp_tcv_2024?: number | null;
  larr_2024?: number | null;
  mp_tcv_2025?: number | null;
  larr_2025?: number | null;
  mp_tcv_target_2025?: number | null;
  mp_tcv_projected_annual?: number | null;
  larr_projected_annual?: number | null;
  joint_value_proposition?: string | null;
  airtable_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  name: string | null;
  email: string;
}

export type MeetingStatus = "scheduled" | "completed" | "cancelled" | "did_not_occur";

export type MeetingType =
  | "partner_cadence" | "sca_review" | "qbr" | "executive"
  | "event" | "internal" | "support" | "demo" | "enablement" | "ad_hoc";

export type RecurrencePattern = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface Meeting {
  id: string;
  title: string;
  engagement_id: string | null;
  partner_id: string | null;
  message_id: string | null;
  status: MeetingStatus;
  meeting_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  organizer_email: string | null;
  organizer_name: string | null;
  ics_uid: string | null;
  sequence: number | null;
  source: "manual" | "ics_parsed" | "body_parsed" | "auto";
  meeting_type: MeetingType | null;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_end: string | null;
  series_id: string | null;
  anchor_day?: number | null;
  notes: string | null;
  airtable_record_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Output of ICS parser — the shape of a meeting before DB insertion */
export interface ParsedMeeting {
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  organizer_email: string | null;
  attendees: MeetingAttendee[];
  ics_uid: string;
  notes: string | null;
  /** VCALENDAR METHOD (e.g., "REQUEST", "CANCEL", "REPLY", "PUBLISH") */
  method: string | null;
  /** VEVENT STATUS (e.g., "CONFIRMED", "TENTATIVE", "CANCELLED") */
  status: string | null;
  /** VEVENT SEQUENCE — update counter, starts at 0, increments on updates */
  sequence: number | null;
  /** CN from ORGANIZER line */
  organizer_name: string | null;
  /** Derived: METHOD=CANCEL, STATUS=CANCELLED, or title starts with "Canceled:"/"Cancelled:" */
  is_cancellation: boolean;
}

export interface Message {
  id: string;
  engagement_id: string | null;
  partner_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sent_at: string | null;
  subject: string | null;
  body_text: string | null;
  body_raw: string | null;
  content_type:
    | "engagement_email"
    | "meeting_invite"
    | "mixed"
    | "noise"
    | null;
  classification_confidence: number | null;
  linked_entities: LinkedEntity[];
  forwarded_at: string;
  pending_review: boolean;
  classification_result: ClassificationResult | null;
  forwarder_email: string | null;
  forwarder_name: string | null;
  forwarder_note: string | null;
  to_header: string | null;
  cc_header: string | null;
}

export interface Participant {
  id: string;
  email: string | null;
  name: string | null;
  organization: string | null;
  title: string | null;
  org_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface EngagementParticipant {
  id: string;
  engagement_id: string;
  participant_id: string;
  role: string | null;
  created_at: string;
}

// ============================================================
// UI types
// ============================================================

export type TimelineItem =
  | { type: "message"; date: string; data: Message }
  | { type: "meeting"; date: string; data: Meeting };

// ============================================================
// Application types
// ============================================================

export interface LinkedEntity {
  type: "engagement" | "event" | "program";
  id: string;
  relationship: string;
}

export interface ClassificationResult {
  content_type: Message["content_type"];
  engagement_match: {
    id: string | null;
    name: string;
    confidence: number;
    is_new: boolean;
    partner_name: string | null;
    partner_id?: string | null;
  };
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  current_state: string | null;
}

// ============================================================
// Two-phase classification types
// ============================================================

/** Phase 1 (Match) output — lightweight routing result */
export interface Phase1Result {
  content_type: "engagement_email" | "meeting_invite" | "mixed" | "noise";
  engagement_match: {
    id: string | null;
    name: string;
    confidence: number;
    is_new: boolean;
    partner_name: string | null;
    partner_id: string | null;
  };
}

/** Phase 2 (Analyze) output — deep analysis with engagement context */
export interface Phase2Result {
  current_state: string | null;
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  pillar: Pillar | null;
}

/**
 * Combined result from both phases — the shape the persistence layer receives.
 * Backwards-compatible with ClassificationResult (same fields + pillar).
 */
export interface CombinedClassificationResult {
  content_type: Message["content_type"];
  engagement_match: {
    id: string | null;
    name: string;
    confidence: number;
    is_new: boolean;
    partner_name: string | null;
    partner_id?: string | null;
  };
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  current_state: string | null;
  condensed: string | null;
  topic: string | null;
  engagement_name: string | null;
  pillar: Pillar | null;
}

/** The shape of a parsed message before it's inserted into the DB */
export interface ParsedMessage {
  sender_name: string | null;
  sender_email: string | null;
  sent_at: string | null;
  subject: string | null;
  body_text: string;
  body_raw: string;
  forwarder_email?: string | null;
  forwarder_name?: string | null;
  forwarder_note?: string | null;
  to_header?: string | null;
  cc_header?: string | null;
}

// ============================================================
// Meeting Notes types
// ============================================================

export interface MeetingNote {
  id: string;
  partner_id: string;
  meeting_id: string | null;
  engagement_id: string | null;
  note_type: "meeting";
  title: string | null;
  meeting_date: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  raw_notes: string;
  ai_summary: string | null;
  condensed: string | null;
  ai_tasks: unknown | null;
  context_snapshot: unknown | null;
  status: "draft" | "complete";
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  meeting_note_id: string | null;
  partner_id: string;
  engagement_id: string | null;
  description: string;
  owner: "me" | "internal" | "partner" | "third_party";
  owner_name: string | null;
  owner_participant_id: string | null;
  status: "open" | "done" | "cancelled";
  due_date: string | null;
  origin: "ai_extracted" | "manual";
  created_at: string;
  updated_at: string;
}

export interface MeetingNoteWithTasks extends MeetingNote {
  tasks: Task[];
  partner_name?: string;
}

export interface CreateMeetingNoteInput {
  partner_id: string;
  meeting_id?: string | null;
  engagement_id?: string | null;
  note_type?: "meeting";
  title?: string | null;
  meeting_date?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  raw_notes: string;
}

export interface UpdateMeetingNoteInput {
  title?: string | null;
  raw_notes?: string;
  ai_summary?: string | null;
  condensed?: string | null;
  ai_tasks?: unknown | null;
  context_snapshot?: unknown | null;
  status?: "draft" | "complete";
  engagement_id?: string | null;
}

export interface CreateTaskInput {
  meeting_note_id: string;
  partner_id: string;
  engagement_id?: string | null;
  description: string;
  owner: "me" | "internal" | "partner" | "third_party";
  owner_name?: string | null;
  owner_participant_id?: string | null;
  due_date?: string | null;
  origin?: "ai_extracted" | "manual";
}

export interface UpdateTaskInput {
  description?: string;
  owner?: "me" | "internal" | "partner" | "third_party";
  owner_name?: string | null;
  owner_participant_id?: string | null;
  status?: "open" | "done" | "cancelled";
  due_date?: string | null;
  engagement_id?: string | null;
}

// ============================================================
// Partner Context Entry (scratchpad / AI synthesis / seed dump)
// ============================================================

export interface PartnerContextEntry {
  id: string;
  partner_id: string;
  content: string;
  source: "scratchpad" | "ai_synthesis" | "seed_dump";
  created_at: string;
  updated_at: string;
}

// ============================================================
// Partner Context types (for meeting notes)
// ============================================================

export interface PartnerContext {
  partner: {
    name: string;
    segment: string | null;
    focus_area: string[];
    what_they_do: string | null;
    aws_stickiness: string | null;
    key_aws_services: string[];
    architecture: string | null;
    listing_types: string[];
    pricing_model: string[];
    isva_status: string | null;
    deployed_on_aws: string | null;
    prm_status: string | null;
    crm_platform: string | null;
  };
  contacts: {
    alliance_lead: string | null;
    account_manager: string | null;
    psa: string | null;
    other_contacts: string[];
  };
  engagements: Array<{
    id: string;
    name: string;
    pillar: Pillar | null;
    status: string;
    topic: string | null;
    program_name: string | null;
    event_name: string | null;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    meeting_date: string | null;
    status: string;
  }>;
  previousNotes: Array<{
    title: string | null;
    meeting_date: string | null;
    ai_summary: string;
    note_type: string;
  }>;
  openTasks: Array<{
    description: string;
    owner: string;
    owner_name: string | null;
    status: string;
    due_date: string | null;
    meeting_note_id: string | null;
  }>;
  scratchpadEntries: Array<{
    content: string;
    source: string;
    created_at: string;
  }>;
  /** Raw registry contacts for UI display (not used by AI prompt pipeline) */
  registryContacts: Array<{
    name: string | null;
    email: string | null;
    title: string | null;
    role: string | null;
    org_type: string | null;
  }>;
}

export interface DisplayContext {
  profile: {
    name: string;
    segment: string | null;
    focus_areas: string[];
    what_they_do: string | null;
    aws_stickiness: string | null;
    key_aws_services: string[];
    architecture: string | null;
    listing_types: string[];
    pricing_model: string[];
    isva_status: string | null;
    deployed_on_aws: string | null;
    prm_status: string | null;
    crm_platform: string | null;
  };
  contacts: Array<{
    name: string | null;
    email: string | null;
    title: string | null;
    role: string | null;
    org_type: string | null;
  }>;
  activeEngagements: Array<{
    id: string;
    name: string;
    pillar: Pillar | null;
    status: string;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    date: string | null;
    status: string;
  }>;
  openTaskCount: number;
  openTasks: Array<{
    description: string;
    owner: string;
    owner_name: string | null;
    meeting_note_id: string | null;
  }>;
  previousNotes: Array<{
    title: string | null;
    meeting_date: string | null;
    ai_summary: string;
    note_type: string;
  }>;
  scratchpadEntries: Array<{
    content: string;
    source: string;
    created_at: string;
  }>;
}

// ============================================================
// Notes AI summarization types
// ============================================================

// ============================================================
// Ring 3 types — strategic/financial posture
// ============================================================

export type PartnerGoalCategory = "co_sell" | "co_build" | "co_market" | "compliance" | "program" | "vertical" | "operational";
export type PartnerGoalStatus = "not_started" | "in_progress" | "completed" | "deferred";

export interface PartnerGoal {
  id: string;
  partner_id: string;
  goal: string;
  category: PartnerGoalCategory;
  year: number | null;
  target_date: string | null;
  status: PartnerGoalStatus;
  linked_program_id: string | null;
  engagement_id: string | null;
  notes: string | null;
  airtable_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerProgramEnrollment {
  id: string;
  partner_id: string;
  program_id: string | null;
  program_name: string | null;
  status: string | null;
  date_achieved: string | null;
  notes: string | null;
  airtable_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerEventParticipation {
  id: string;
  partner_id: string;
  event_id: string;
  status: "interested" | "invited" | "registered" | "attended" | "declined" | null;
  sponsoring: boolean;
  notes: string | null;
  airtable_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerFundingMpopp {
  id: string;
  partner_id: string;
  status: string | null;
  half: string | null;
  track: string | null;
  allocated: number | null;
  spent: number | null;
  notes: string | null;
  airtable_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerFundingMdf {
  id: string;
  partner_id: string;
  record_name: string | null;
  allocated: number | null;
  utilized: number | null;
  date_allocated: string | null;
  source: string | null;
  recurrence: string | null;
  notes: string | null;
  airtable_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Notes AI summarization types
// ============================================================

export interface NoteSummaryResult {
  summary: string;
  condensed: string | null;
  tasks: Array<{
    description: string;
    owner: "me" | "internal" | "partner" | "third_party";
    owner_name: string | null;
    due_date: string | null;
  }>;
}

