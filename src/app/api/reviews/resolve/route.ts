import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseClient,
  resolvePendingReview,
  createInitiative,
  updateMessageInitiative,
  updateInitiativeSummary,
  findOrCreateEvent,
  findOrCreateProgram,
  createEntityLink,
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

    console.log("Resolve request:", { review_id, action, option_number, initiative_name });

    if (!review_id || !action) {
      return NextResponse.json(
        { error: "review_id and action are required" },
        { status: 400 }
      );
    }

    // Fetch the specific review
    const { data: review, error: fetchError } = await getSupabaseClient()
      .from("pending_reviews")
      .select("*")
      .eq("id", review_id)
      .eq("resolved", false)
      .single();

    if (fetchError) {
      console.error("Review fetch error:", fetchError.message, fetchError.code);
      return NextResponse.json(
        { error: `Review not found: ${fetchError.message}` },
        { status: 404 }
      );
    }

    if (!review) {
      return NextResponse.json(
        { error: "Review not found or already resolved" },
        { status: 404 }
      );
    }

    const pendingReview = review as PendingReview;
    console.log("Found review:", {
      id: pendingReview.id,
      message_id: pendingReview.message_id,
      options_count: pendingReview.options_sent?.length ?? 0,
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
          { error: `Invalid option number ${option_number}` },
          { status: 400 }
        );
      }

      console.log("Selected option:", option);

      if (option.is_new) {
        // Create new initiative from the AI suggestion
        const initiative = await createInitiative({
          name: option.label,
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

        console.log("Created initiative:", initiative.id, initiative.name);
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

        console.log("Assigned to initiative:", option.initiative_id);
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

      console.log("Created initiative (custom name):", initiative.id, name);
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
    console.error("POST /api/reviews/resolve error:", message, error);
    return NextResponse.json(
      { error: `Failed to resolve review: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * After resolving a review, persist the events, programs, and entity links
 * that Claude identified in the classification_result.
 */
async function persistClassificationEntities(
  result: ClassificationResult,
  initiativeId: string
): Promise<void> {
  // Track created entity IDs for linking
  const entityIdMap = new Map<string, { type: string; id: string }>();
  entityIdMap.set(
    result.initiative_match.name.toLowerCase().trim(),
    { type: "initiative", id: initiativeId }
  );

  // 1. Create/find events referenced in classification
  for (const eventRef of result.events_referenced) {
    try {
      const event = await findOrCreateEvent({
        name: eventRef.name,
        type: eventRef.type,
        start_date: eventRef.date,
        date_precision: eventRef.date_precision,
      });
      entityIdMap.set(eventRef.name.toLowerCase().trim(), {
        type: "event",
        id: event.id,
      });

      // Link event to initiative
      await createEntityLink({
        source_type: "initiative",
        source_id: initiativeId,
        target_type: "event",
        target_id: event.id,
        relationship: "relevant_to",
        context: null,
      });
    } catch (err) {
      console.error(`Failed to create/link event "${eventRef.name}":`, err);
    }
  }

  // 2. Create/find programs referenced in classification
  for (const progRef of result.programs_referenced) {
    try {
      const program = await findOrCreateProgram({ name: progRef.name });
      entityIdMap.set(progRef.name.toLowerCase().trim(), {
        type: "program",
        id: program.id,
      });

      // Link program to initiative
      await createEntityLink({
        source_type: "initiative",
        source_id: initiativeId,
        target_type: "program",
        target_id: program.id,
        relationship: "relevant_to",
        context: null,
      });
    } catch (err) {
      console.error(`Failed to create/link program "${progRef.name}":`, err);
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
      console.error(`Failed to create entity link:`, err);
    }
  }

  // 4. Upsert participants and link to initiative
  if (result.participants.length > 0) {
    const db = (await import("@/lib/supabase")).getSupabaseClient();
    for (const participant of result.participants) {
      if (!participant.email) continue;
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
          if (Object.keys(updates).length > 0) {
            await db
              .from("participants")
              .update(updates)
              .eq("id", participantId);
          }
        } else {
          const { data: inserted } = await db
            .from("participants")
            .insert({
              email: participant.email,
              name: participant.name,
              organization: participant.organization,
            })
            .select("id")
            .single();
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
}
