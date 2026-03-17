import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseClient,
  createEngagement,
  linkMeetingToEngagement,
  getMessagesForInboxItem,
  discardInboxItem,
} from "@/lib/db";
import {
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Engagement, Message } from "@/lib/types";

interface ResolveRequest {
  message_id: string;
  action: "discard" | "create_new" | "assign_existing";
  engagement_id?: string;   // required for assign_existing
  title?: string;           // optional for create_new (defaults to suggested title)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveRequest;
    const { message_id, action, engagement_id, title } = body;

    if (!message_id || !action) {
      return NextResponse.json(
        { error: "message_id and action are required" },
        { status: 400 }
      );
    }

    const db = getSupabaseClient();

    // ── Discard ──────────────────────────────────────────────
    if (action === "discard") {
      await discardInboxItem(message_id);
      return NextResponse.json({ status: "discarded" });
    }

    // ── Shared: fetch messages for create_new & assign_existing ──
    const messages = await getMessagesForInboxItem(message_id);
    const messageIds = messages.map((m) => m.id);
    const forwarderNote = messages[0]?.forwarder_note ?? null;
    const partnerId = messages[0]?.partner_id ?? null;

    if (!partnerId) {
      return NextResponse.json(
        { error: "Message has no detected partner. Select a partner first." },
        { status: 400 }
      );
    }

    // Get partner name
    const { data: partner } = await db
      .from("partners")
      .select("name")
      .eq("id", partnerId)
      .single();
    const partnerName = partner?.name ?? "Unknown Partner";

    // ── Create New Engagement ────────────────────────────────
    if (action === "create_new") {
      const engagementTitle = title || `${partnerName} - ${cleanSubject(messages[0]?.subject)}`;

      const engagement = await createEngagement({
        name: engagementTitle,
        partner_name: partnerName,
        current_state: null,
        topic: null,
        goal: null,
      });

      // Run AI synthesis
      const phase1 = buildSyntheticPhase1Result(
        engagement.id,
        partnerId,
        partnerName,
        true,
        engagementTitle
      );

      let finalResult;
      try {
        finalResult = await synthesizeIntoEngagement(messages, phase1, forwarderNote);
      } catch (err) {
        console.error("Synthesis failed for new engagement, continuing with basic data:", err);
        finalResult = null;
      }

      if (finalResult) {
        await persistClassificationResult(finalResult, engagement.id, messageIds, true);
      } else {
        // Minimal: just link messages to engagement
        await db
          .from("messages")
          .update({ engagement_id: engagement.id, pending_review: false })
          .in("id", messageIds);
      }

      // Link any meetings
      for (const msgId of messageIds) {
        await linkMeetingToEngagement(msgId, engagement.id);
      }

      // Push to Airtable
      try {
        const { pushEngagementToAirtable } = await import("@/lib/sync");
        await pushEngagementToAirtable(engagement.id);
        console.log(`Airtable push: created engagement ${engagement.id}`);
      } catch (err) {
        console.error(`Airtable push failed for ${engagement.id}:`, err);
      }

      return NextResponse.json({ status: "created", engagement });
    }

    // ── Assign to Existing Engagement ────────────────────────
    if (action === "assign_existing") {
      if (!engagement_id) {
        return NextResponse.json(
          { error: "engagement_id is required for assign_existing" },
          { status: 400 }
        );
      }

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

      // Validate same partner
      if (engagement.partner_id && engagement.partner_id !== partnerId) {
        return NextResponse.json(
          { error: "Message partner does not match engagement partner" },
          { status: 400 }
        );
      }

      // Run AI synthesis
      const phase1 = buildSyntheticPhase1Result(
        engagement.id,
        partnerId,
        partnerName,
        false,
        engagement.name
      );

      let finalResult;
      try {
        finalResult = await synthesizeIntoEngagement(messages, phase1, forwarderNote);
      } catch (err) {
        console.error("Synthesis failed for assign_existing, continuing with basic link:", err);
        finalResult = null;
      }

      if (finalResult) {
        await persistClassificationResult(finalResult, engagement.id, messageIds, false);
      } else {
        await db
          .from("messages")
          .update({ engagement_id: engagement.id, pending_review: false })
          .in("id", messageIds);
      }

      // Link any meetings
      for (const msgId of messageIds) {
        await linkMeetingToEngagement(msgId, engagement.id);
      }

      // Push to Airtable
      try {
        const { pushEngagementToAirtable } = await import("@/lib/sync");
        await pushEngagementToAirtable(engagement.id);
        console.log(`Airtable push: updated engagement ${engagement.id}`);
      } catch (err) {
        console.error(`Airtable push failed for ${engagement.id}:`, err);
      }

      return NextResponse.json({ status: "assigned", engagement });
    }

    return NextResponse.json(
      { error: "Invalid action. Must be discard, create_new, or assign_existing" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Resolve failed:", message);
    return NextResponse.json(
      { error: `Failed to resolve: ${message}` },
      { status: 500 }
    );
  }
}

/** Strip common prefixes from email subject for title suggestion */
function cleanSubject(subject: string | null): string {
  if (!subject) return "New Engagement";
  return subject
    .replace(/^(RE|FW|FWD|Fwd|Re|Fw):\s*/gi, "")
    .replace(/^\[EXTERNAL\]\s*/i, "")
    .replace(/^\[.*?\]\s*/, "")
    .trim() || "New Engagement";
}
