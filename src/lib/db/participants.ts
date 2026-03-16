import { getSupabaseClient } from "./client";
import { Participant, ClassificationResult, RoleContact, MeetingAttendee } from "../types";
import { isUserEmail, USER_CONFIG } from "../user-config";

export async function getParticipantById(id: string): Promise<Participant | null> {
  const { data, error } = await getSupabaseClient()
    .from("participants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch participant: ${error.message}`);
  return data as Participant | null;
}

export async function updateParticipant(
  id: string,
  updates: {
    name?: string | null;
    email?: string | null;
    title?: string | null;
    organization?: string | null;
  }
): Promise<Participant> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.organization !== undefined) row.organization = updates.organization;

  const { data, error } = await getSupabaseClient()
    .from("participants")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update participant: ${error.message}`);
  return data as Participant;
}

export async function deleteEngagementParticipant(linkId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("engagement_participants")
    .delete()
    .eq("id", linkId);

  if (error) throw new Error(`Failed to delete engagement participant: ${error.message}`);
}


/**
 * Find or create a participant, then link to an engagement.
 * If email is provided, deduplicates by email.
 */
export async function createParticipantWithLink(
  participant: {
    name: string;
    email?: string | null;
    title?: string | null;
    organization?: string | null;
  },
  engagementId: string,
  role: string | null
): Promise<Participant & { role: string | null; linkId: string }> {
  const db = getSupabaseClient();
  let participantId: string;
  let participantRecord: Participant;

  // Try to find existing by email
  if (participant.email) {
    const { data: existing } = await db
      .from("participants")
      .select("*")
      .eq("email", participant.email)
      .limit(1);

    if (existing && existing.length > 0) {
      participantRecord = existing[0] as Participant;
      participantId = participantRecord.id;
    } else {
      const { data: created, error } = await db
        .from("participants")
        .insert({
          name: participant.name,
          email: participant.email,
          title: participant.title ?? null,
          organization: participant.organization ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create participant: ${error.message}`);
      participantRecord = created as Participant;
      participantId = participantRecord.id;
    }
  } else {
    // No email — always create (no reliable dedup key)
    const { data: created, error } = await db
      .from("participants")
      .insert({
        name: participant.name,
        email: null,
        title: participant.title ?? null,
        organization: participant.organization ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create participant: ${error.message}`);
    participantRecord = created as Participant;
    participantId = participantRecord.id;
  }

  // Create the link
  const { data: link, error: linkErr } = await db
    .from("engagement_participants")
    .insert({
      participant_id: participantId,
      engagement_id: engagementId,
      role,
    })
    .select("id")
    .single();

  if (linkErr) throw new Error(`Failed to link participant: ${linkErr.message}`);

  return {
    ...participantRecord,
    role,
    linkId: (link as { id: string }).id,
  };
}

/**
 * Ensure an engagement_participants row exists (idempotent).
 */
async function ensureEngagementParticipant(
  participantId: string,
  engagementId: string,
  role: string | null
): Promise<void> {
  const db = getSupabaseClient();
  const { data: existing } = await db
    .from("engagement_participants")
    .select("id")
    .eq("participant_id", participantId)
    .eq("engagement_id", engagementId)
    .limit(1);

  if (!existing || existing.length === 0) {
    await db.from("engagement_participants").insert({
      participant_id: participantId,
      engagement_id: engagementId,
      role,
    });
  }
}

/**
 * Upsert participants from classification results.
 * Creates new participants or updates existing ones with richer info.
 * Optionally links each participant to an engagement.
 */
/**
 * Infer org_type from email domain.
 * Amazon domains → "internal", known partner domains → "partner", else → "third_party".
 */
function inferOrgType(
  email: string,
  partnerDomains: Map<string, { partnerId: string; partnerName: string }>
): "internal" | "partner" | "third_party" {
  if (isAmazonEmail(email)) return "internal";
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && partnerDomains.has(domain)) return "partner";
  return "third_party";
}

export async function upsertParticipants(
  participants: ClassificationResult["participants"],
  engagementId: string | null
): Promise<void> {
  if (participants.length === 0) return;

  const db = getSupabaseClient();
  const pdmEmail = process.env.RELAY_EMAIL_ADDRESS?.toLowerCase();

  // Fetch partner domains once for org_type inference
  const partnerDomains = await getPartnerContactDomains();

  for (const participant of participants) {
    if (!participant.email && !participant.name) continue;

    // Detect if this participant is the system user (PDM)
    const isUser = participant.email ? isUserEmail(participant.email) : false;

    // PDM always gets role "forwarder"
    if (isUser) {
      participant.role = "forwarder";
    } else if (pdmEmail && participant.email?.toLowerCase() === pdmEmail) {
      participant.role = "forwarder";
    }

    let participantId: string | null = null;

    try {
      if (participant.email) {
        // For user emails (PRVS, corpmail, aliases), always look up by canonical email
        const lookupEmail = isUser ? USER_CONFIG.email : participant.email;

        // Email-based lookup
        const { data: existing } = await db
          .from("participants")
          .select("*")
          .eq("email", lookupEmail)
          .limit(1);

        if (existing && existing.length > 0) {
          participantId = existing[0].id;
          const updates: Record<string, string> = {};

          if (isUser) {
            // Always use canonical identity for the system user
            if (existing[0].name !== USER_CONFIG.name) {
              updates.name = USER_CONFIG.name;
            }
            if (existing[0].email !== USER_CONFIG.email) {
              updates.email = USER_CONFIG.email;
            }
          } else {
            // For other participants, only fill missing fields
            if (!existing[0].name && participant.name) {
              updates.name = participant.name;
            }
          }
          if (!existing[0].organization && participant.organization) {
            updates.organization = participant.organization;
          }
          // Backfill org_type if not already set (AT sync is authoritative, classifier infers as fallback)
          if (!existing[0].org_type && participant.email) {
            updates.org_type = inferOrgType(participant.email, partnerDomains);
          }
          // title column reserved for non-classifier sources (AT catalog sync, email signatures, manual entry)
          // participant.role goes to engagement_participants.role only (via ensureEngagementParticipant)
          if (Object.keys(updates).length > 0) {
            await db
              .from("participants")
              .update(updates)
              .eq("id", participantId);
          }
        } else {
          // Insert new participant — use canonical email for user
          const insertEmail = isUser ? USER_CONFIG.email : participant.email;
          const insertName = isUser ? USER_CONFIG.name : participant.name;

          const { data: inserted, error: insertErr } = await db
            .from("participants")
            .insert({
              email: insertEmail,
              name: insertName,
              organization: participant.organization,
              org_type: isUser ? "internal" : inferOrgType(insertEmail, partnerDomains),
            })
            .select("id")
            .maybeSingle();

          if (insertErr) {
            console.error(`Failed to insert participant "${insertEmail}":`, insertErr.message);
            continue;
          }
          if (inserted) {
            participantId = inserted.id;
          }
        }
      } else {
        // Name-only participant — dedup by normalized name
        const normalizedName = participant.name!.toLowerCase().trim();
        const { data: existing } = await db
          .from("participants")
          .select("*")
          .ilike("name", normalizedName)
          .limit(1);

        if (existing && existing.length > 0) {
          participantId = existing[0].id;
        } else {
          const { data: inserted, error: insertErr } = await db
            .from("participants")
            .insert({
              email: null,
              name: participant.name,
              organization: participant.organization,
            })
            .select("id")
            .maybeSingle();

          if (insertErr) {
            console.error(`Failed to insert participant "${participant.name}":`, insertErr.message);
            continue;
          }
          if (inserted) {
            participantId = inserted.id;
          }
        }
      }

      // Link to engagement if we have one
      if (participantId && engagementId) {
        await ensureEngagementParticipant(
          participantId,
          engagementId,
          participant.role
        );
      }
    } catch (err) {
      console.error(
        `Failed to upsert participant "${participant.email || participant.name}":`,
        err
      );
    }
  }
}

/**
 * Backfill message sender_names for an engagement using participant data.
 * Called after upsertParticipants so we have the freshest names.
 * "Better" = more words, or non-null replacing null.
 * Single bulk approach: fetch participants + messages, compute updates, batch.
 */
export async function backfillMessageSenderNames(
  engagementId: string
): Promise<number> {
  const db = getSupabaseClient();

  // Fetch participants linked to this engagement (fresh from upsert)
  const { data: links } = await db
    .from("engagement_participants")
    .select("participant:participants(email, name)")
    .eq("engagement_id", engagementId);

  if (!links || links.length === 0) return 0;

  // Build email → best participant name map
  const emailToName = new Map<string, string>();
  for (const row of links as unknown as { participant: { email: string | null; name: string | null } }[]) {
    const p = row.participant;
    if (!p.email || !p.name) continue;
    const key = p.email.toLowerCase();
    const existing = emailToName.get(key);
    // Keep the name with more words (richer)
    if (!existing || p.name.split(/\s+/).length > existing.split(/\s+/).length) {
      emailToName.set(key, p.name);
    }
  }

  if (emailToName.size === 0) return 0;

  // Fetch messages for this engagement
  const { data: messages } = await db
    .from("messages")
    .select("id, sender_email, sender_name")
    .eq("engagement_id", engagementId);

  if (!messages || messages.length === 0) return 0;

  // Compute which messages need updating
  let updated = 0;
  for (const msg of messages) {
    if (!msg.sender_email) continue;
    const participantName = emailToName.get(msg.sender_email.toLowerCase());
    if (!participantName) continue;

    // "Better" check: participant name wins if current is null or has fewer words
    const currentWords = msg.sender_name ? msg.sender_name.split(/\s+/).length : 0;
    const newWords = participantName.split(/\s+/).length;
    if (msg.sender_name && currentWords >= newWords) continue;

    // Update this message
    await db
      .from("messages")
      .update({ sender_name: participantName })
      .eq("id", msg.id);
    updated++;
  }

  return updated;
}

// ============================================================
// Contact Registry Helpers
// ============================================================

const PLACEHOLDER_EMAILS = new Set(["—", "-", "–", "", "null", "n/a", "N/A"]);

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  if (PLACEHOLDER_EMAILS.has(email)) return false;
  return email.includes("@");
}

/** Strip trailing dots and whitespace — common Airtable typo (e.g. "user@domain.com.") */
export function normalizeEmail(email: string): string {
  return email.trim().replace(/\.+$/, "");
}

function isAmazonEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return domain === "amazon.com" || domain.startsWith("amazon.");
}

/**
 * Upsert a contact into the participants registry.
 * ON CONFLICT (email) updates name, title, organization, org_type, source.
 * Returns the participant id, or null if the email is invalid.
 */
export async function upsertContactToRegistry(
  email: string,
  name: string | null,
  title: string | null,
  organization: string | null,
  orgType: "internal" | "partner" | "third_party",
  source: string
): Promise<string | null> {
  if (!isValidEmail(email)) return null;

  const normalizedEmail = normalizeEmail(email).toLowerCase();
  const db = getSupabaseClient();

  // Check if already exists
  const { data: existing } = await db
    .from("participants")
    .select("id, org_type, source, name, title, organization")
    .eq("email", normalizedEmail)
    .limit(1);

  if (existing && existing.length > 0) {
    const row = existing[0];
    const updates: Record<string, string | null> = {};

    // "Richer wins" — only update name if new value has more words (prevents ICS short names from overwriting AT full names)
    if (name && (!row.name || name.split(/\s+/).length > row.name.split(/\s+/).length)) updates.name = name;
    // For title and org, longer string wins (more specific is better)
    if (title && (!row.title || title.length > row.title.length)) updates.title = title;
    if (organization && (!row.organization || organization.length > row.organization.length)) updates.organization = organization;
    if (!row.org_type) updates.org_type = orgType;
    if (!row.source) updates.source = source;

    if (Object.keys(updates).length > 0) {
      await db.from("participants").update(updates).eq("id", row.id);
    }
    return row.id;
  }

  // Insert new
  const { data: inserted, error } = await db
    .from("participants")
    .insert({
      email: normalizedEmail,
      name,
      title,
      organization,
      org_type: orgType,
      source,
    })
    .select("id")
    .single();

  if (error) {
    // Handle race condition on UNIQUE constraint
    if (error.code === "23505") {
      const { data: retry } = await db
        .from("participants")
        .select("id")
        .eq("email", normalizedEmail)
        .single();
      if (retry) return retry.id;
    }
    console.error(`Failed to upsert participant ${normalizedEmail}: ${error.message}`);
    return null;
  }

  return inserted.id;
}

/**
 * Link a participant to a partner. Idempotent — skips on UNIQUE violation.
 */
export async function linkPartnerParticipant(
  partnerId: string,
  participantId: string,
  role: string | null
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("partner_participants")
    .insert({ partner_id: partnerId, participant_id: participantId, role });

  if (error && error.code !== "23505") {
    console.error(`Failed to link partner_participant: ${error.message}`);
  }
}

/**
 * Link a participant to a relationship. Idempotent — skips on UNIQUE violation.
 */
export async function linkRelationshipParticipant(
  relationshipId: string,
  participantId: string,
  role: string | null
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("relationship_participants")
    .insert({ relationship_id: relationshipId, participant_id: participantId, role });

  if (error && error.code !== "23505") {
    console.error(`Failed to link relationship_participant: ${error.message}`);
  }
}

/**
 * Sync a partner's JSONB contacts into the contact registry.
 * Processes aws_team (internal) and partner_contacts (partner).
 */
export async function syncPartnerContactsToRegistry(
  partnerId: string,
  partnerName: string,
  awsTeam: RoleContact[],
  partnerContacts: RoleContact[]
): Promise<void> {
  // AWS team → internal
  for (const contact of awsTeam) {
    const participantId = await upsertContactToRegistry(
      contact.email ?? "",
      contact.name,
      contact.title,
      "Amazon Web Services",
      "internal",
      "airtable_sync"
    );
    if (participantId) {
      await linkPartnerParticipant(partnerId, participantId, contact.role);
    }
  }

  // Partner contacts → partner (unless Amazon email)
  for (const contact of partnerContacts) {
    if (!isValidEmail(contact.email)) continue;
    const orgType = isAmazonEmail(contact.email!) ? "internal" as const : "partner" as const;
    const participantId = await upsertContactToRegistry(
      contact.email!,
      contact.name,
      contact.title,
      partnerName,
      orgType,
      "airtable_sync"
    );
    if (participantId) {
      await linkPartnerParticipant(partnerId, participantId, contact.role);
    }
  }
}

/**
 * Sync a relationship's JSONB contacts into the contact registry.
 */
export async function syncRelationshipContactsToRegistry(
  relationshipId: string,
  contacts: RoleContact[]
): Promise<void> {
  for (const contact of contacts) {
    if (!isValidEmail(contact.email)) continue;
    const orgType = isAmazonEmail(contact.email!) ? "internal" as const : "third_party" as const;
    const participantId = await upsertContactToRegistry(
      contact.email!,
      contact.name,
      contact.title,
      null,
      orgType,
      "airtable_sync"
    );
    if (participantId) {
      await linkRelationshipParticipant(relationshipId, participantId, contact.role);
    }
  }
}

// ============================================================
// Meeting Participant Registry
// ============================================================

/**
 * Link a participant to a meeting. Idempotent — skips on UNIQUE violation.
 */
async function linkMeetingParticipant(
  meetingId: string,
  participantId: string,
  role: string | null
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("meeting_participants")
    .insert({ meeting_id: meetingId, participant_id: participantId, role });

  if (error && error.code !== "23505") {
    console.error(`Failed to link meeting_participant: ${error.message}`);
  }
}

/**
 * Delete all meeting_participants rows for a meeting.
 * Used before re-syncing on ICS updates or manual attendee edits.
 */
export async function replaceMeetingParticipants(meetingId: string): Promise<void> {
  try {
    const { error } = await getSupabaseClient()
      .from("meeting_participants")
      .delete()
      .eq("meeting_id", meetingId);

    if (error) {
      console.error(`Failed to clear meeting_participants for ${meetingId}: ${error.message}`);
    }
  } catch (err) {
    console.error("replaceMeetingParticipants error:", err instanceof Error ? err.message : err);
  }
}

/**
 * Sync meeting attendees into the contact registry and link to meeting_participants.
 * Handles organizer detection: if organizerEmail matches an attendee, that attendee
 * gets role "organizer" instead of "attendee". If organizer is not in the attendee
 * list, they are upserted separately.
 *
 * Follows Decision #177: registry errors caught and logged, never fail the parent operation.
 */
export async function syncMeetingAttendeesToRegistry(
  meetingId: string,
  attendees: MeetingAttendee[],
  organizerEmail: string | null,
  organizerName: string | null
): Promise<void> {
  try {
    const normalizedOrganizerEmail = organizerEmail?.toLowerCase().trim() || null;
    const processedEmails = new Set<string>();

    for (const attendee of attendees) {
      if (!isValidEmail(attendee.email)) continue;

      const email = attendee.email.toLowerCase().trim();
      const orgType = isAmazonEmail(email) ? "internal" as const : "third_party" as const;
      const role = email === normalizedOrganizerEmail ? "organizer" : "attendee";

      const participantId = await upsertContactToRegistry(
        email,
        attendee.name,
        null,
        null,
        orgType,
        "ics_parsed"
      );

      if (participantId) {
        await linkMeetingParticipant(meetingId, participantId, role);
      }

      processedEmails.add(email);
    }

    // Handle organizer not in attendee list
    if (normalizedOrganizerEmail && !processedEmails.has(normalizedOrganizerEmail) && isValidEmail(normalizedOrganizerEmail)) {
      const orgType = isAmazonEmail(normalizedOrganizerEmail) ? "internal" as const : "third_party" as const;
      const participantId = await upsertContactToRegistry(
        normalizedOrganizerEmail,
        organizerName,
        null,
        null,
        orgType,
        "ics_parsed"
      );
      if (participantId) {
        await linkMeetingParticipant(meetingId, participantId, "organizer");
      }
    }
  } catch (err) {
    console.error("syncMeetingAttendeesToRegistry error:", err instanceof Error ? err.message : err);
  }
}

// ============================================================
// Contact Registry Read Functions
// ============================================================

interface RegistryContact {
  id: string;
  email: string;
  name: string | null;
  organization: string | null;
  title: string | null;
  org_type: string | null;
  role: string | null;
}

/**
 * Get all contacts linked to a partner via partner_participants join table.
 * Returns participants with their role from the join table.
 */
export async function getContactsByPartner(partnerId: string): Promise<RegistryContact[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("partner_participants")
      .select("role, participant:participants(id, email, name, organization, title, org_type)")
      .eq("partner_id", partnerId);

    if (error) {
      console.error(`Failed to fetch contacts for partner ${partnerId}: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => {
      const p = (row as unknown as { role: string | null; participant: { id: string; email: string; name: string | null; organization: string | null; title: string | null; org_type: string | null } }).participant;
      return {
        id: p.id,
        email: p.email,
        name: p.name,
        organization: p.organization,
        title: p.title,
        org_type: p.org_type,
        role: (row as unknown as { role: string | null }).role,
      };
    });
  } catch (err) {
    console.error("getContactsByPartner error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Get all contacts linked to a relationship via relationship_participants join table.
 */
export async function getContactsByRelationship(relationshipId: string): Promise<RegistryContact[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("relationship_participants")
      .select("role, participant:participants(id, email, name, organization, title, org_type)")
      .eq("relationship_id", relationshipId);

    if (error) {
      console.error(`Failed to fetch contacts for relationship ${relationshipId}: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => {
      const p = (row as unknown as { role: string | null; participant: { id: string; email: string; name: string | null; organization: string | null; title: string | null; org_type: string | null } }).participant;
      return {
        id: p.id,
        email: p.email,
        name: p.name,
        organization: p.organization,
        title: p.title,
        org_type: p.org_type,
        role: (row as unknown as { role: string | null }).role,
      };
    });
  } catch (err) {
    console.error("getContactsByRelationship error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Get all contacts linked to a meeting via meeting_participants join table.
 */
export async function getContactsByMeeting(meetingId: string): Promise<RegistryContact[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("meeting_participants")
      .select("role, participant:participants(id, email, name, organization, title, org_type)")
      .eq("meeting_id", meetingId);

    if (error) {
      console.error(`Failed to fetch contacts for meeting ${meetingId}: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => {
      const p = (row as unknown as { role: string | null; participant: { id: string; email: string; name: string | null; organization: string | null; title: string | null; org_type: string | null } }).participant;
      return {
        id: p.id,
        email: p.email,
        name: p.name,
        organization: p.organization,
        title: p.title,
        org_type: p.org_type,
        role: (row as unknown as { role: string | null }).role,
      };
    });
  } catch (err) {
    console.error("getContactsByMeeting error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Bulk-fetch contacts for multiple partners in a single query.
 * Returns a Map of partnerId → RegistryContact[].
 */
export async function getContactsByPartnerBulk(partnerIds: string[]): Promise<Map<string, RegistryContact[]>> {
  const result = new Map<string, RegistryContact[]>();
  if (partnerIds.length === 0) return result;

  try {
    const { data, error } = await getSupabaseClient()
      .from("partner_participants")
      .select("partner_id, role, participant:participants(id, email, name, organization, title, org_type)")
      .in("partner_id", partnerIds);

    if (error) {
      console.error(`Failed to bulk-fetch partner contacts: ${error.message}`);
      return result;
    }

    for (const row of data ?? []) {
      const r = row as unknown as { partner_id: string; role: string | null; participant: { id: string; email: string; name: string | null; organization: string | null; title: string | null; org_type: string | null } };
      const contact: RegistryContact = {
        id: r.participant.id,
        email: r.participant.email,
        name: r.participant.name,
        organization: r.participant.organization,
        title: r.participant.title,
        org_type: r.participant.org_type,
        role: r.role,
      };
      const existing = result.get(r.partner_id) ?? [];
      existing.push(contact);
      result.set(r.partner_id, existing);
    }
  } catch (err) {
    console.error("getContactsByPartnerBulk error:", err instanceof Error ? err.message : err);
  }

  return result;
}

/**
 * Bulk-fetch contacts for multiple relationships in a single query.
 * Returns a Map of relationshipId → RegistryContact[].
 */
export async function getContactsByRelationshipBulk(relationshipIds: string[]): Promise<Map<string, RegistryContact[]>> {
  const result = new Map<string, RegistryContact[]>();
  if (relationshipIds.length === 0) return result;

  try {
    const { data, error } = await getSupabaseClient()
      .from("relationship_participants")
      .select("relationship_id, role, participant:participants(id, email, name, organization, title, org_type)")
      .in("relationship_id", relationshipIds);

    if (error) {
      console.error(`Failed to bulk-fetch relationship contacts: ${error.message}`);
      return result;
    }

    for (const row of data ?? []) {
      const r = row as unknown as { relationship_id: string; role: string | null; participant: { id: string; email: string; name: string | null; organization: string | null; title: string | null; org_type: string | null } };
      const contact: RegistryContact = {
        id: r.participant.id,
        email: r.participant.email,
        name: r.participant.name,
        organization: r.participant.organization,
        title: r.participant.title,
        org_type: r.participant.org_type,
        role: r.role,
      };
      const existing = result.get(r.relationship_id) ?? [];
      existing.push(contact);
      result.set(r.relationship_id, existing);
    }
  } catch (err) {
    console.error("getContactsByRelationshipBulk error:", err instanceof Error ? err.message : err);
  }

  return result;
}

/**
 * Build a domain → partner map from the contact registry.
 * Uses partner_participants with org_type='partner' contacts to extract email domains.
 * Used by Phase 1 partner catalog and matchPartnerFromAttendees.
 */
export async function getPartnerContactDomains(): Promise<Map<string, { partnerId: string; partnerName: string }>> {
  const result = new Map<string, { partnerId: string; partnerName: string }>();

  try {
    const db = getSupabaseClient();

    // Fetch partner-org_type contacts with their partner link
    const { data: links, error: linksErr } = await db
      .from("partner_participants")
      .select("partner_id, participant:participants(email, org_type)");

    if (linksErr || !links) {
      console.error(`Failed to fetch partner contact domains: ${linksErr?.message}`);
      return result;
    }

    // Collect unique partner IDs that have partner-org contacts
    const partnerIds = new Set<string>();
    const partnerContactEmails: { partnerId: string; email: string }[] = [];

    for (const row of links as unknown as { partner_id: string; participant: { email: string | null; org_type: string | null } }[]) {
      const p = row.participant;
      if (!p.email || p.org_type !== "partner") continue;
      partnerIds.add(row.partner_id);
      partnerContactEmails.push({ partnerId: row.partner_id, email: p.email });
    }

    if (partnerIds.size === 0) return result;

    // Fetch partner names
    const { data: partners, error: partnersErr } = await db
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);

    if (partnersErr || !partners) {
      console.error(`Failed to fetch partner names: ${partnersErr?.message}`);
      return result;
    }

    const partnerNameMap = new Map<string, string>();
    for (const p of partners as { id: string; name: string }[]) {
      partnerNameMap.set(p.id, p.name);
    }

    // Build domain map
    for (const { partnerId, email } of partnerContactEmails) {
      const domain = email.toLowerCase().split("@")[1];
      if (!domain) continue;
      // First partner wins per domain
      if (!result.has(domain)) {
        const partnerName = partnerNameMap.get(partnerId);
        if (partnerName) {
          result.set(domain, { partnerId, partnerName });
        }
      }
    }
  } catch (err) {
    console.error("getPartnerContactDomains error:", err instanceof Error ? err.message : err);
  }

  return result;
}

