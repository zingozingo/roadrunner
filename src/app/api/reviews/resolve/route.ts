import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseClient,
  resolveApproval,
  createEngagement,
  updateEngagement,
  updateMessageEngagement,
  findOrCreateProgram,
  createEntityLink,
  createApproval,
  findOrCreateEvent,
  upsertParticipants,
  appendOpenItems,
} from "@/lib/supabase";
import { ApprovalQueueItem, ClassificationResult, EventSuggestion, OpenItem } from "@/lib/types";

interface ResolveRequest {
  review_id: string;
  action: "skip" | "select" | "new" | "approve" | "deny";
  option_number?: number;
  engagement_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveRequest;
    const { review_id, action, option_number, engagement_name } = body;

    console.log("=== RESOLVE START ===");
    console.log("Request body:", JSON.stringify(body));

    if (!review_id || !action) {
      return NextResponse.json(
        { error: "review_id and action are required" },
        { status: 400 }
      );
    }

    // Fetch the approval by ID
    const { data: row, error: fetchError } = await getSupabaseClient()
      .from("approval_queue")
      .select("*")
      .eq("id", review_id)
      .maybeSingle();

    if (fetchError) {
      console.error("Approval fetch error:", fetchError.message, fetchError.code);
      return NextResponse.json(
        { error: `Database error fetching approval: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!row) {
      console.error("No approval found with id:", review_id);
      return NextResponse.json(
        { error: `No approval found with id ${review_id}` },
        { status: 404 }
      );
    }

    const approval = row as ApprovalQueueItem;

    if (approval.resolved) {
      console.warn("Approval already resolved:", review_id, approval.resolution);
      return NextResponse.json(
        { error: "This approval has already been resolved" },
        { status: 409 }
      );
    }

    // Route by approval type
    if (approval.type === "event_creation") {
      return handleEventApproval(approval, action);
    }

    // engagement_assignment handling below
    const classResult = approval.classification_result!;

    console.log("Found approval:", {
      id: approval.id,
      message_id: approval.message_id,
      resolved: approval.resolved,
      options_count: approval.options_sent?.length ?? 0,
      options: approval.options_sent,
    });

    // Handle "skip"
    if (action === "skip") {
      await resolveApproval(review_id, "skipped");
      console.log("Approval skipped:", review_id);
      return NextResponse.json({ status: "skipped" });
    }

    // Handle "select" — pick a numbered option
    if (action === "select" && option_number != null) {
      const option = approval.options_sent?.find(
        (o) => o.number === option_number
      );
      if (!option) {
        console.error("Invalid option:", {
          option_number,
          available: approval.options_sent?.map((o) => o.number),
        });
        return NextResponse.json(
          { error: `Invalid option number ${option_number}. Available: ${approval.options_sent?.map((o) => o.number).join(", ") ?? "none"}` },
          { status: 400 }
        );
      }

      console.log("Selected option:", JSON.stringify(option));

      if (option.is_new) {
        // Create new engagement from the AI suggestion
        const engagement = await createEngagement({
          name: option.label,
          partner_name: classResult.engagement_match.partner_name,
          summary: classResult.current_state,
          current_state: classResult.current_state ?? null,
          open_items: (classResult.open_items ?? []).map((i) => ({ ...i, resolved: false })),
        });
        console.log("Created engagement:", engagement.id, engagement.name);

        await updateMessageEngagement(approval.message_id!, engagement.id);
        console.log("Message assigned:", approval.message_id, "->", engagement.id);

        await persistClassificationEntities(classResult, engagement.id);

        await resolveApproval(
          review_id,
          `created:${engagement.id}:${engagement.name}`
        );

        console.log("=== RESOLVE DONE (created) ===");
        return NextResponse.json({
          status: "created",
          engagement: engagement,
        });
      }

      if (option.engagement_id) {
        // Assign to existing engagement
        await updateMessageEngagement(
          approval.message_id!,
          option.engagement_id
        );

        // Update current_state, summary, and merge open_items
        const currentState = classResult.current_state ?? null;
        const openItems: OpenItem[] = (classResult.open_items ?? []).map(
          (i) => ({ ...i, resolved: false })
        );

        const updates: Parameters<typeof updateEngagement>[1] = {};
        if (currentState) {
          updates.current_state = currentState;
          updates.summary = currentState;
        }
        if (openItems.length > 0) {
          const merged = await appendOpenItems(option.engagement_id, openItems);
          if (merged) {
            updates.open_items = merged;
          }
        }
        if (Object.keys(updates).length > 0) {
          await updateEngagement(option.engagement_id, updates);
        }

        await persistClassificationEntities(classResult, option.engagement_id);

        await resolveApproval(
          review_id,
          `assigned:${option.engagement_id}:${option.label}`
        );

        console.log("=== RESOLVE DONE (assigned) ===");
        return NextResponse.json({
          status: "assigned",
          engagement_id: option.engagement_id,
        });
      }

      // Edge case: option exists but is_new=false and engagement_id=null
      console.error("Option has no engagement_id and is not new:", option);
      return NextResponse.json(
        { error: "Option has no target engagement" },
        { status: 400 }
      );
    }

    // Handle "new" — create engagement with user-provided name
    if (action === "new") {
      const name = engagement_name?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "engagement_name is required for action 'new'" },
          { status: 400 }
        );
      }

      const engagement = await createEngagement({
        name,
        partner_name: classResult.engagement_match.partner_name,
        summary: classResult.current_state,
        current_state: classResult.current_state ?? null,
        open_items: (classResult.open_items ?? []).map((i) => ({ ...i, resolved: false })),
      });

      await updateMessageEngagement(approval.message_id!, engagement.id);

      await persistClassificationEntities(classResult, engagement.id);

      await resolveApproval(
        review_id,
        `created:${engagement.id}:${engagement.name}`
      );

      console.log("=== RESOLVE DONE (new) ===");
      return NextResponse.json({
        status: "created",
        engagement: engagement,
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
      { error: `Failed to resolve approval: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Handle event_creation approval (approve/deny).
 */
async function handleEventApproval(
  approval: ApprovalQueueItem,
  action: string
): Promise<NextResponse> {
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'deny' for event approvals" },
      { status: 400 }
    );
  }

  if (action === "deny") {
    await resolveApproval(approval.id, "denied");
    return NextResponse.json({ status: "denied" });
  }

  // Approve: create event and link to engagement
  const eventData = approval.entity_data as EventSuggestion;
  const event = await findOrCreateEvent({
    name: eventData.name,
    type: eventData.type,
    start_date: eventData.date,
    date_precision: eventData.date_precision,
  });

  // Link to engagement if one exists
  if (approval.engagement_id) {
    await createEntityLink({
      source_type: "engagement",
      source_id: approval.engagement_id,
      target_type: "event",
      target_id: event.id,
      relationship: "relevant_to",
      context: `Event approved from email classification`,
    });
  }

  await resolveApproval(approval.id, `approved:${event.id}:${event.name}`);

  return NextResponse.json({ status: "approved", event });
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
  engagementId: string
): Promise<void> {
  try {
    // Track created entity IDs for linking
    const entityIdMap = new Map<string, { type: string; id: string }>();
    entityIdMap.set(
      result.engagement_match.name.toLowerCase().trim(),
      { type: "engagement", id: engagementId }
    );

    // 1. Register existing events / create pending approvals for new ones
    for (const eventRef of result.events_referenced) {
      if (eventRef.is_new || !eventRef.id) {
        try {
          await createApproval({
            type: "event_creation",
            entity_data: {
              name: eventRef.name,
              type: eventRef.type,
              date: eventRef.date,
              date_precision: eventRef.date_precision,
              confidence: eventRef.confidence,
            },
            message_id: null,
            engagement_id: engagementId,
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

    // 4. Upsert participants and link to engagement
    await upsertParticipants(result.participants, engagementId);
  } catch (err) {
    // Catch-all: entity creation must never break the resolve flow
    console.error("persistClassificationEntities error:", err);
  }
}

