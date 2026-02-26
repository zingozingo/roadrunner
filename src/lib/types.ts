// ============================================================
// Database row types
// ============================================================

export type Pillar = "Co-Sell" | "Co-Market" | "Co-Build";

export interface Engagement {
  id: string;
  name: string;
  status: "active" | "blocked" | "completed" | "archived";
  current_state: string | null;
  topic: string | null;
  goal: string | null;
  engagement_type: string | null;
  partner_name: string | null;
  partner_id: string | null;
  pillar: Pillar | null;
  tags: string[];
  program_id: string | null;
  airtable_record_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Event {
  id: string;
  name: string;
  type: "conference" | "summit" | "workshop" | "kickoff" | "trade_show" | "deadline" | "review_cycle" | "training";
  start_date: string | null;
  end_date: string | null;
  host: string | null;
  location: string | null;
  description: string | null;
  geo: string | null;
  source: "seed" | "email_extracted" | "user_created";
  verified: boolean;
  sponsor_option: boolean;
  partner_day: boolean;
  partner_day_date: string | null;
  airtable_record_id: string | null;
  created_at: string;
}

export type ProgramType = "Competency" | "Service Ready" | "SCA" | "Program" | "Credit Program" | "Funding" | "Channel" | "Enablement";

export interface Program {
  id: string;
  name: string;
  type: ProgramType | null;
  description: string | null;
  requirements: string | null;
  what_it_unlocks: string | null;
  notes: string | null;
  lifecycle_type: "indefinite" | "recurring" | "expiring";
  lifecycle_duration: string | null;
  airtable_record_id: string | null;
  created_at: string;
}

export type RelationshipType = "Exec/Leader" | "Product Team" | "Program Team" | "Seller";

export interface AwsRelationship {
  id: string;
  name: string;
  aws_org: string | null;
  aws_service: string | null;
  relationship_type: RelationshipType | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  aws_contact_emails: string[];
  notes: string | null;
  airtable_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  name: string;
  segment: string | null;
  focus_area: string[];
  alliance_lead: string | null;
  alliance_lead_email: string | null;
  psa: string | null;
  psa_email: string | null;
  account_manager: string | null;
  account_manager_email: string | null;
  pmm: string | null;
  pmm_email: string | null;
  spms_id: number | null;
  what_they_do: string | null;
  partner_contact_emails: string[] | null;
  aws_stickiness: string | null;
  key_aws_services: string[];
  airtable_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  name: string | null;
  email: string;
}

export type MeetingStatus = "scheduled" | "completed" | "did_not_occur";

export interface Meeting {
  id: string;
  title: string;
  engagement_id: string | null;
  event_id: string | null;
  program_id: string | null;
  partner_name: string | null;
  partner_id: string | null;
  message_id: string | null;
  meeting_type: string | null;
  status: MeetingStatus;
  meeting_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  organizer_email: string | null;
  attendees: MeetingAttendee[];
  ics_uid: string | null;
  source: "manual" | "ics_parsed";
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
}

export interface EntityLink {
  id: string;
  source_type: "engagement" | "event" | "program";
  source_id: string;
  target_type: "engagement" | "event" | "program";
  target_id: string;
  relationship: string;
  context: string | null;
  created_by: "ai" | "user";
  created_at: string;
}

export interface Message {
  id: string;
  engagement_id: string | null;
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
  notes: string | null;
  created_at: string;
}

export interface ParticipantLink {
  id: string;
  participant_id: string;
  entity_type: "engagement" | "event";
  entity_id: string;
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
  /** Events matched by ID from context. Claude never creates events. */
  matched_events: {
    id: string;
    name: string;
    relationship: string;
  }[];
  /** Programs matched by ID from context. Claude never creates programs. */
  matched_programs: {
    id: string;
    name: string;
    relationship: string;
  }[];
  /** AWS relationships matched by ID from context. Claude never creates relationships. */
  matched_relationships: {
    id: string;
    name: string;
    relationship: string;
  }[];
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  current_state: string | null;
  suggested_tags: string[];
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

/** Phase 2 (Analyze) output — deep analysis with full engagement context */
export interface Phase2Result {
  current_state: string | null;
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  matched_events: { id: string; name: string; relationship: string }[];
  matched_programs: { id: string; name: string; relationship: string }[];
  matched_relationships: { id: string; name: string; relationship: string }[];
  suggested_tags: string[];
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
  matched_events: { id: string; name: string; relationship: string }[];
  matched_programs: { id: string; name: string; relationship: string }[];
  matched_relationships: { id: string; name: string; relationship: string }[];
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  current_state: string | null;
  topic: string | null;
  goal: string | null;
  engagement_name: string | null;
  suggested_tags: string[];
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

export interface ApprovalQueueItem {
  id: string;
  type: "engagement_assignment";
  message_id: string | null;
  engagement_id: string | null;
  classification_result: ClassificationResult | null;
  resolved: boolean;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
}



