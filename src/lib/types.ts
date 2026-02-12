// ============================================================
// Database row types
// ============================================================

export interface OpenItem {
  description: string;
  assignee: string | null;
  due_date: string | null;
  resolved?: boolean;
}

export interface Engagement {
  id: string;
  name: string;
  status: "active" | "paused" | "closed";
  summary: string | null;
  current_state: string | null;
  open_items: OpenItem[];
  partner_name: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

/** @deprecated Use Engagement instead */
export type Initiative = Engagement;

export interface Event {
  id: string;
  name: string;
  type: "conference" | "summit" | "workshop" | "kickoff" | "trade_show" | "deadline" | "review_cycle" | "training";
  start_date: string | null;
  end_date: string | null;
  date_precision: "exact" | "week" | "month" | "quarter";
  location: string | null;
  description: string | null;
  source: "seed" | "email_extracted" | "user_created";
  verified: boolean;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  eligibility: string | null;
  url: string | null;
  status: "active" | "archived";
  created_at: string;
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

export interface Note {
  id: string;
  engagement_id: string;
  content: string;
  created_at: string;
}

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
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  current_state: string | null;
  open_items: {
    description: string;
    assignee: string | null;
    due_date: string | null;
  }[];
  suggested_tags: string[];
}

/** The shape of a parsed message before it's inserted into the DB */
export interface ParsedMessage {
  sender_name: string | null;
  sender_email: string | null;
  sent_at: string | null;
  subject: string | null;
  body_text: string;
  body_raw: string;
}

/** Mailgun inbound webhook multipart form fields */
export interface MailgunWebhookPayload {
  sender: string;
  recipient: string;
  subject: string;
  "body-plain": string;
  "body-html": string;
  "stripped-text": string;
  "stripped-html": string;
  timestamp: string;
  token: string;
  signature: string;
}

export interface ApprovalQueueItem {
  id: string;
  type: "engagement_assignment";
  message_id: string | null;
  engagement_id: string | null;
  classification_result: ClassificationResult | null;
  options_sent: SMSOption[] | null;
  sms_sent: boolean;
  sms_sent_at: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
}

export interface SMSOption {
  number: number;
  label: string;
  engagement_id: string | null;
  is_new: boolean;
}

export interface SMSNotification {
  to: string;
  body: string;
  engagement_id?: string;
  type: "new_engagement" | "status_change" | "digest" | "alert";
}

