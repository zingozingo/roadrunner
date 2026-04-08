import { NextRequest, NextResponse } from "next/server";
import {
  createEngagement,
  getPartner,
  getEngagementById,
  linkMeetingToEngagement,
  linkMessagesToEngagement,
  getMessagesForInboxItem,
  discardInboxItem,
} from "@/lib/db";
import {
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Engagement } from "@/lib/types";
import { cleanSubject } from "@/lib/format-utils";

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
    const partner = await getPartner(partnerId);
    const partnerName = partner?.name ?? "Unknown Partner";

    // ── Create New Engagement ────────────────────────────────
    if (action === "create_new") {
      const engagementTitle = title || `${partnerName} - ${cleanSubject(messages[0]?.subject)}`;

      const engagement = await createEngagement({
        name: engagementTitle,
        partner_name: partnerName,
        current_state: null,
        topic: null,
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
        await linkMessagesToEngagement(messageIds, engagement.id);
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

      const engagement = await getEngagementById(engagement_id);

      if (!engagement) {
        return NextResponse.json(
          { error: `Engagement ${engagement_id} not found` },
          { status: 404 }
        );
      }

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
        await linkMessagesToEngagement(messageIds, engagement.id);
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
