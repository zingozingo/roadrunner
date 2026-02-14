import { NextRequest, NextResponse } from "next/server";
import { storeMessages, getSupabaseClient } from "@/lib/supabase";
import { processSingleMessage } from "@/lib/classifier";
import { ParsedMessage } from "@/lib/types";

// ============================================================
// POST /api/classify/live-test
//
// Full pipeline test: stores a message, runs classification,
// persists results (engagement, links, participants).
// Mirrors what /api/inbound does but from manual input.
// ============================================================

export async function POST(request: NextRequest) {
  const start = performance.now();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sender, senderEmail, subject, body: emailBody } = body as {
    sender?: string;
    senderEmail?: string;
    subject?: string;
    body?: string;
  };

  if (!emailBody || !emailBody.trim()) {
    return NextResponse.json(
      { error: "'body' (email content) is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Store the test message (mimicking /api/inbound)
    const parsed: ParsedMessage[] = [
      {
        sender_name: sender ?? null,
        sender_email: senderEmail ?? null,
        sent_at: new Date().toISOString(),
        subject: subject ?? null,
        body_text: emailBody,
        body_raw: emailBody,
      },
    ];

    const stored = await storeMessages(parsed);
    const messageId = stored[0].id;

    // 2. Run the full classification pipeline
    //    (classify → route → persist → SMS attempt)
    const result = await processSingleMessage([messageId]);

    // 3. Fetch the updated message to see what engagement was assigned
    const db = getSupabaseClient();
    const { data: updatedMessage } = await db
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    // 4. Fetch the engagement if assigned
    let engagement = null;
    if (updatedMessage?.engagement_id) {
      const { data } = await db
        .from("engagements")
        .select("*")
        .eq("id", updatedMessage.engagement_id)
        .single();
      engagement = data;
    }

    // 5. Fetch entity links created for this engagement
    let entityLinks: Record<string, unknown>[] = [];
    if (updatedMessage?.engagement_id) {
      const { data } = await db
        .from("entity_links")
        .select("*")
        .or(
          `source_id.eq.${updatedMessage.engagement_id},target_id.eq.${updatedMessage.engagement_id}`
        );
      entityLinks = (data as Record<string, unknown>[]) ?? [];
    }

    const processingTimeMs = Math.round(performance.now() - start);

    return NextResponse.json({
      result,
      message: {
        id: messageId,
        engagement_id: updatedMessage?.engagement_id ?? null,
        pending_review: updatedMessage?.pending_review ?? false,
      },
      engagement,
      entityLinks,
      meta: { processingTimeMs },
    });
  } catch (error) {
    console.error("Live test error:", error);
    return NextResponse.json(
      {
        error: "Live test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
