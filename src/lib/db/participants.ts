import { getSupabaseClient } from "./client";
import { Participant, ClassificationResult } from "../types";
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

export async function deleteParticipantLink(linkId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("participant_links")
    .delete()
    .eq("id", linkId);

  if (error) throw new Error(`Failed to delete participant link: ${error.message}`);
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
    .from("participant_links")
    .insert({
      participant_id: participantId,
      entity_type: "engagement",
      entity_id: engagementId,
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
 * Ensure a participant_links row exists (idempotent).
 */
async function ensureParticipantLink(
  participantId: string,
  entityType: string,
  entityId: string,
  role: string | null
): Promise<void> {
  const db = getSupabaseClient();
  const { data: existing } = await db
    .from("participant_links")
    .select("id")
    .eq("participant_id", participantId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  if (!existing || existing.length === 0) {
    await db.from("participant_links").insert({
      participant_id: participantId,
      entity_type: entityType,
      entity_id: entityId,
      role,
    });
  }
}

/**
 * Upsert participants from classification results.
 * Creates new participants or updates existing ones with richer info.
 * Optionally links each participant to an engagement.
 */
export async function upsertParticipants(
  participants: ClassificationResult["participants"],
  engagementId: string | null
): Promise<void> {
  if (participants.length === 0) return;

  const db = getSupabaseClient();
  const pdmEmail = process.env.RELAY_EMAIL_ADDRESS?.toLowerCase();

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
          // title column reserved for non-classifier sources (AT catalog sync, email signatures, manual entry)
          // participant.role goes to participant_links.role only (via ensureParticipantLink)
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
        await ensureParticipantLink(
          participantId,
          "engagement",
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
    .from("participant_links")
    .select("participant:participants(email, name)")
    .eq("entity_type", "engagement")
    .eq("entity_id", engagementId);

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
