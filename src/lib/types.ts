// ============================================================
// Database row types
// ============================================================

export interface Initiative {
  id: string;
  name: string;
  status: "active" | "paused" | "closed";
  summary: string | null;
  partner_name: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Event {
  id: string;
  name: string;
  type: "conference" | "summit" | "deadline" | "review_cycle" | "meeting_series";
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
  source_type: "initiative" | "event" | "program";
  source_id: string;
  target_type: "initiative" | "event" | "program";
  target_id: string;
  relationship: string;
  context: string | null;
  created_by: "ai" | "user";
  created_at: string;
}

export interface Message {
  id: string;
  initiative_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sent_at: string | null;
  subject: string | null;
  body_text: string | null;
  body_raw: string | null;
  content_type:
    | "initiative_email"
    | "event_info"
    | "program_info"
    | "meeting_invite"
    | "mixed"
    | "noise"
    | null;
  classification_confidence: number | null;
  linked_entities: LinkedEntity[];
  forwarded_at: string;
}

export interface Participant {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  notes: string | null;
  created_at: string;
}

export interface ParticipantLink {
  id: string;
  participant_id: string;
  entity_type: "initiative" | "event";
  entity_id: string;
  role: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  initiative_id: string;
  content: string;
  created_at: string;
}

// ============================================================
// Application types
// ============================================================

export interface LinkedEntity {
  type: "initiative" | "event" | "program";
  id: string;
  relationship: string;
}

export interface ClassificationResult {
  content_type: Message["content_type"];
  confidence: number;
  summary: string;
  extracted_entities: {
    initiatives: { name: string; partner_name?: string; is_new: boolean }[];
    events: {
      name: string;
      type: Event["type"];
      start_date?: string;
      end_date?: string;
      location?: string;
    }[];
    programs: { name: string; description?: string; url?: string }[];
    participants: { name: string; email?: string; organization?: string }[];
  };
  suggested_links: {
    source_type: EntityLink["source_type"];
    source_name: string;
    target_type: EntityLink["target_type"];
    target_name: string;
    relationship: string;
  }[];
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

export interface SMSNotification {
  to: string;
  body: string;
  initiative_id?: string;
  type: "new_initiative" | "status_change" | "digest" | "alert";
}
