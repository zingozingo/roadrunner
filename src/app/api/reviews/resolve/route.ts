import { NextRequest, NextResponse } from "next/server";
import {
  createEngagement,
  getPartner,
  getEngagementById,
  getMessagesForInboxItem,
  discardInboxItem,
} from "@/lib/db";
import { cleanSubject } from "@/lib/format-utils";
import { resolveInboxToEngagement } from "@/lib/inbox-resolver";

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
    const forwarderNote = messages[0]?.forwarder_note ?? null;
    const partnerId = messages[0]?.partner_id ?? null;

    if (!partnerId) {
      return NextResponse.json(
        { error: "Message has no detected partner. Select a partner first." },
        { status: 400 }
      );
    }

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

      await resolveInboxToEngagement({
        messages, engagement, partnerId, partnerName, forwarderNote, isNew: true,
      });

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

      if (engagement.partner_id && engagement.partner_id !== partnerId) {
        return NextResponse.json(
          { error: "Message partner does not match engagement partner" },
          { status: 400 }
        );
      }

      await resolveInboxToEngagement({
        messages, engagement, partnerId, partnerName, forwarderNote, isNew: false,
      });

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
