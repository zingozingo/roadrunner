import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseClient,
  resolveApproval,
  createEngagement,
  linkMeetingToEngagement,
} from "@/lib/db";
import { persistClassificationResult, runPhase2ForResolve } from "@/lib/classifier";
import type { ApprovalQueueItem, CombinedClassificationResult, Engagement, Message, Phase1Result } from "@/lib/types";

interface ResolveRequest {
  review_id: string;
  action: "confirm" | "assign_existing" | "discard";
  engagement_id?: string; // required for assign_existing
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveRequest;
    const { review_id, action, engagement_id } = body;

    if (!review_id || !action) {
      return NextResponse.json(
        { error: "review_id and action are required" },
        { status: 400 }
      );
    }

    // Fetch the approval by ID
    const db = getSupabaseClient();
    const { data: row, error: fetchError } = await db
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

    const classResult = approval.classification_result as CombinedClassificationResult;

    // ── Discard ──────────────────────────────────────────────
    if (action === "discard") {
      if (approval.message_id) {
        await db
          .from("messages")
          .update({ content_type: "noise", pending_review: false })
          .eq("id", approval.message_id);
      }
      await resolveApproval(review_id, "discarded");
      return NextResponse.json({ status: "discarded" });
    }

    // ── Shared: fetch messages for confirm & assign_existing ─
    const messageIds = approval.message_id ? [approval.message_id] : [];
    let messages: Message[] = [];
    if (messageIds.length > 0) {
      const { data } = await db
        .from("messages")
        .select("*")
        .in("id", messageIds);
      messages = (data ?? []) as Message[];
    }
    const forwarderNote = messages[0]?.forwarder_note ?? null;

    // ── Confirm ──────────────────────────────────────────────
    if (action === "confirm") {
      let engagement: Engagement;
      let isNew: boolean;

      if (classResult.engagement_match.is_new) {
        // Create new engagement with full parity to auto-assign
        const engagementName = classResult.engagement_name || classResult.engagement_match.name;
        engagement = await createEngagement({
          name: engagementName,
          partner_name: classResult.engagement_match.partner_name,
          current_state: classResult.current_state ?? null,
          topic: classResult.topic ?? null,
          goal: classResult.goal ?? null,
        });

        // Set pillar separately (same as auto-assign path)
        if (classResult.pillar) {
          await db
            .from("engagements")
            .update({ pillar: classResult.pillar })
            .eq("id", engagement.id);
        }

        isNew = true;
      } else {
        // Existing engagement match — use the ID from classification
        const existingId = classResult.engagement_match.id!;
        const { data: eng } = await db
          .from("engagements")
          .select("*")
          .eq("id", existingId)
          .single();
        if (!eng) {
          return NextResponse.json(
            { error: `Engagement ${existingId} not found` },
            { status: 404 }
          );
        }
        engagement = eng as Engagement;
        isNew = false;
      }

      // Run Phase 2 for fresh analysis
      let finalResult: CombinedClassificationResult = classResult;
      if (messages.length > 0) {
        try {
          const phase1ForResolve: Phase1Result = {
            content_type: classResult.content_type ?? "engagement_email",
            engagement_match: {
              ...classResult.engagement_match,
              id: engagement.id,
              name: engagement.name,
              is_new: isNew,
              partner_id: classResult.engagement_match.partner_id ?? null,
            },
          };
          finalResult = await runPhase2ForResolve(messages, phase1ForResolve, forwarderNote);
        } catch (err) {
          console.error("Phase 2 failed during resolve, using stored result:", err);
        }
      }

      // Persist classification result
      await persistClassificationResult(finalResult, engagement.id, messageIds, isNew);

      // Fire-and-forget Airtable sync
      import("@/lib/sync")
        .then(({ pushEngagementToAirtable }) => pushEngagementToAirtable(engagement.id))
        .then((r) => console.log(`Airtable push: ${r.action} engagement ${engagement.id}`))
        .catch((err) => console.error(`Airtable push failed for ${engagement.id}:`, err));

      // Link meetings
      if (classResult.content_type === "meeting_invite") {
        for (const msgId of messageIds) {
          await linkMeetingToEngagement(msgId, engagement.id);
        }
      }

      const resolution = isNew
        ? `created:${engagement.id}:${engagement.name}`
        : `confirmed:${engagement.id}:${engagement.name}`;
      await resolveApproval(review_id, resolution);

      return NextResponse.json({
        status: "confirmed",
        engagement,
      });
    }

    // ── Assign Existing ──────────────────────────────────────
    if (action === "assign_existing") {
      if (!engagement_id) {
        return NextResponse.json(
          { error: "engagement_id is required for assign_existing" },
          { status: 400 }
        );
      }

      // Validate the engagement exists
      const { data: eng } = await db
        .from("engagements")
        .select("*")
        .eq("id", engagement_id)
        .single();
      if (!eng) {
        return NextResponse.json(
          { error: `Engagement ${engagement_id} not found` },
          { status: 404 }
        );
      }
      const engagement = eng as Engagement;

      // Run Phase 2 with the user-selected engagement
      let finalResult: CombinedClassificationResult = classResult;
      if (messages.length > 0) {
        try {
          const phase1ForResolve: Phase1Result = {
            content_type: classResult.content_type ?? "engagement_email",
            engagement_match: {
              id: engagement.id,
              name: engagement.name,
              confidence: 1.0, // user-assigned = full confidence
              is_new: false,
              partner_name: engagement.partner_name,
              partner_id: engagement.partner_id,
            },
          };
          finalResult = await runPhase2ForResolve(messages, phase1ForResolve, forwarderNote);
        } catch (err) {
          console.error("Phase 2 failed during assign_existing, using stored result:", err);
        }
      }

      await persistClassificationResult(finalResult, engagement.id, messageIds, false);

      // Fire-and-forget Airtable sync
      import("@/lib/sync")
        .then(({ pushEngagementToAirtable }) => pushEngagementToAirtable(engagement.id))
        .then((r) => console.log(`Airtable push: ${r.action} engagement ${engagement.id}`))
        .catch((err) => console.error(`Airtable push failed for ${engagement.id}:`, err));

      // Link meetings
      if (classResult.content_type === "meeting_invite") {
        for (const msgId of messageIds) {
          await linkMeetingToEngagement(msgId, engagement.id);
        }
      }

      await resolveApproval(review_id, `assigned:${engagement.id}:${engagement.name}`);

      return NextResponse.json({
        status: "assigned",
        engagement,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Must be confirm, assign_existing, or discard" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    console.error("Resolve approval failed:", message, stack);
    return NextResponse.json(
      { error: `Failed to resolve approval: ${message}` },
      { status: 500 }
    );
  }
}
