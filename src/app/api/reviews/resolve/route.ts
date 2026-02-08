import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseClient,
  resolvePendingReview,
  createInitiative,
  updateMessageInitiative,
  updateInitiativeSummary,
  findOrCreateProgram,
  createEntityLink,
  createPendingEventApproval,
} from "@/lib/supabase";
import { PendingReview, ClassificationResult } from "@/lib/types";

interface ResolveRequest {
  review_id: string;
  action: "skip" | "select" | "new";
  option_number?: number;
  initiative_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveRequest;
    const { review_id, action, option_number, initiative_name } = body;

    console.log("=== RESOLVE START ===");
    console.log("Request body:", JSON.stringify(body));

    if (!review_id || !action) {
      return NextResponse.json(
        { error: "review_id and action are required" },
        { status: 400 }
      );
    }

    // Fetch the review by ID only — no resolved filter.
    // Use .maybeSingle() so 0 rows returns null instead of throwing.
    const { data: review, error: fetchError } = await getSupabaseClient()
      .from("pending_reviews")
      .select("*")
      .eq("id", review_id)
      .maybeSingle();

    if (fetchError) {
      console.error("Review fetch error:", fetchError.message, fetchError.code);
      return NextResponse.json(
        { error: `Database error fetching review: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!review) {
      console.error("No review found with id:", review_id);
      return NextResponse.json(
        { error: `No review found with id ${review_id}` },
        { status: 404 }
      );
    }

    const pendingReview = review as PendingReview;

    // Check resolved status in application code — clear error message
    if (pendingReview.resolved) {
      console.warn("Review already resolved:", review_id, pendingReview.resolution);
      return NextResponse.json(
        { error: "This review has already been resolved" },
        { status: 409 }
      );
    }

    console.log("Found review:", {
      id: pendingReview.id,
      message_id: pendingReview.message_id,
      resolved: pendingReview.resolved,
      options_count: pendingReview.options_sent?.length ?? 0,
      options: pendingReview.options_sent,
    });

    // Handle "skip"
    if (action === "skip") {
      await resolvePendingReview(review_id, "skipped");
      console.log("Review skipped:", review_id);
      return NextResponse.json({ status: "skipped" });
    }

    // Handle "select" — pick a numbered option
    if (action === "select" && option_number != null) {
      const option = pendingReview.options_sent?.find(
        (o) => o.number === option_number
      );
      if (!option) {
        console.error("Invalid option:", {
          option_number,
          available: pendingReview.options_sent?.map((o) => o.number),
        });
        return NextResponse.json(
          { error: `Invalid option number ${option_number}. Available: ${pendingReview.options_sent?.map((o) => o.number).join(", ") ?? "none"}` },
          { status: 400 }
        );
      }

      console.log("Selected option:", JSON.stringify(option));

      if (option.is_new) {
        // Create new initiative from the AI suggestion
        const initiative = await createInitiative({
          name: option.label,
          partner_name:
            pendingReview.classification_result.initiative_match.partner_name,
          summary: pendingReview.classification_result.summary_update,
        });
        console.log("Created initiative:", initiative.id, initiative.name);

        await updateMessageInitiative(pendingReview.message_id, initiative.id);
        console.log("Message assigned:", pendingReview.message_id, "->", initiative.id);

        // Persist events, programs, and entity links from classification
        // Errors here should NOT block resolve completion
        await persistClassificationEntities(
          pendingReview.classification_result,
          initiative.id
        );

        await resolvePendingReview(
          review_id,
          `created:${initiative.id}:${initiative.name}`
        );

        console.log("=== RESOLVE DONE (created) ===");
        return NextResponse.json({
          status: "created",
          initiative: initiative,
        });
      }

      if (option.initiative_id) {
        // Assign to existing initiative
        await updateMessageInitiative(
          pendingReview.message_id,
          option.initiative_id
        );
        if (pendingReview.classification_result.summary_update) {
          await updateInitiativeSummary(
            option.initiative_id,
            pendingReview.classification_result.summary_update
          );
        }

        // Persist events, programs, and entity links from classification
        await persistClassificationEntities(
          pendingReview.classification_result,
          option.initiative_id
        );

        await resolvePendingReview(
          review_id,
          `assigned:${option.initiative_id}:${option.label}`
        );

        console.log("=== RESOLVE DONE (assigned) ===");
        return NextResponse.json({
          status: "assigned",
          initiative_id: option.initiative_id,
        });
      }

      // Edge case: option exists but is_new=false and initiative_id=null
      console.error("Option has no initiative_id and is not new:", option);
      return NextResponse.json(
        { error: "Option has no target initiative" },
        { status: 400 }
      );
    }

    // Handle "new" — create initiative with user-provided name
    if (action === "new") {
      const name = initiative_name?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "initiative_name is required for action 'new'" },
          { status: 400 }
        );
      }

      const initiative = await createInitiative({
        name,
        partner_name:
          pendingReview.classification_result.initiative_match.partner_name,
        summary: pendingReview.classification_result.summary_update,
      });

      await updateMessageInitiative(pendingReview.message_id, initiative.id);

      // Persist events, programs, and entity links from classification
      await persistClassificationEntities(
        pendingReview.classification_result,
        initiative.id
      );

      await resolvePendingReview(
        review_id,
        `created:${initiative.id}:${initiative.name}`
      );

      console.log("=== RESOLVE DONE (new) ===");
      return NextResponse.json({
        status: "created",
        initiative: initiative,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    console.error("=== RESOLVE FAILED ===", message, stack);
    return NextResponse.json(
      { error: `Failed to resolve review: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * After resolving a review, persist the events, programs, and entity links
 * that Claude identified in the classification_result.
 *
 * Errors here are logged but never thrown — entity creation is best-effort
 * and must not prevent the review from being resolved.
 */
async function persistClassificationEntities(
  result: ClassificationResult,
  initiativeId: string
): Promise<void> {
  try {
    // Track created entity IDs for linking
    const entityIdMap = new Map<string, { type: string; id: string }>();
    entityIdMap.set(
      result.initiative_match.name.toLowerCase().trim(),
      { type: "initiative", id: initiativeId }
    );

    // 1. Register existing events / create pending approvals for new ones
    for (const eventRef of result.events_referenced) {
      if (eventRef.is_new || !eventRef.id) {
        try {
          await createPendingEventApproval({
            event_data: {
              name: eventRef.name,
              type: eventRef.type,
              date: eventRef.date,
              date_precision: eventRef.date_precision,
              confidence: eventRef.confidence,
            },
            source_message_id: null,
            initiative_id: initiativeId,
          });
          console.log(`Pending event approval created: "${eventRef.name}"`);
        } catch (err) {
          console.error(`Failed to create pending event approval for "${eventRef.name}":`, err);
        }
        continue;
      }
      entityIdMap.set(eventRef.name.toLowerCase().trim(), {
        type: "event",
        id: eventRef.id,
      });
    }

    // 2. Find or create programs (stable entities, low-risk)
    for (const progRef of result.programs_referenced) {
      try {
        const program = await findOrCreateProgram({ name: progRef.name });
        entityIdMap.set(progRef.name.toLowerCase().trim(), {
          type: "program",
          id: program.id,
        });
      } catch (err) {
        console.error(`Failed to find/create program "${progRef.name}":`, err);
      }
    }

    // 3. Create explicit entity links from Claude's entity_links array
    for (const link of result.entity_links) {
      try {
        const source = entityIdMap.get(link.source_name.toLowerCase().trim());
        const target = entityIdMap.get(link.target_name.toLowerCase().trim());
        if (!source || !target) continue;
        if (source.id === target.id) continue;

        await createEntityLink({
          source_type: link.source_type,
          source_id: source.id,
          target_type: link.target_type,
          target_id: target.id,
          relationship: link.relationship,
          context: link.context,
        });
      } catch (err) {
        console.error("Failed to create entity link:", err);
      }
    }

    // 4. Upsert participants and link to initiative
    await upsertParticipants(result, initiativeId);
  } catch (err) {
    // Catch-all: entity creation must never break the resolve flow
    console.error("persistClassificationEntities error:", err);
  }
}

async function upsertParticipants(
  result: ClassificationResult,
  initiativeId: string
): Promise<void> {
  if (result.participants.length === 0) return;

  const db = getSupabaseClient();

  const pdmEmail = process.env.RELAY_EMAIL_ADDRESS?.toLowerCase();

  for (const participant of result.participants) {
    if (!participant.email) continue;

    // PDM forwarder gets role "forwarder" instead of whatever Claude extracted
    if (pdmEmail && participant.email.toLowerCase() === pdmEmail) {
      participant.role = "forwarder";
    }

    try {
      const { data: existing } = await db
        .from("participants")
        .select("*")
        .eq("email", participant.email)
        .limit(1);

      let participantId: string;

      if (existing && existing.length > 0) {
        participantId = existing[0].id;
        // Update if we have better info
        const updates: Record<string, string> = {};
        if (!existing[0].name && participant.name)
          updates.name = participant.name;
        if (!existing[0].organization && participant.organization)
          updates.organization = participant.organization;
        if (!existing[0].title && participant.role && participant.role !== "forwarder")
          updates.title = participant.role;
        if (Object.keys(updates).length > 0) {
          await db
            .from("participants")
            .update(updates)
            .eq("id", participantId);
        }
      } else {
        // Use .maybeSingle() — if insert somehow returns nothing, skip gracefully
        const { data: inserted } = await db
          .from("participants")
          .insert({
            email: participant.email,
            name: participant.name,
            organization: participant.organization,
            title: participant.role !== "forwarder" ? participant.role : null,
          })
          .select("id")
          .maybeSingle();
        if (!inserted) continue;
        participantId = inserted.id;
      }

      // Link to initiative (deduped)
      const { data: existingLink } = await db
        .from("participant_links")
        .select("id")
        .eq("participant_id", participantId)
        .eq("entity_type", "initiative")
        .eq("entity_id", initiativeId)
        .limit(1);

      if (!existingLink || existingLink.length === 0) {
        await db.from("participant_links").insert({
          participant_id: participantId,
          entity_type: "initiative",
          entity_id: initiativeId,
          role: participant.role,
        });
      }
    } catch (err) {
      console.error(
        `Failed to upsert participant "${participant.email}":`,
        err
      );
    }
  }
}
