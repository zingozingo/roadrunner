import { NextRequest, NextResponse } from "next/server";
import { buildPhase1Context } from "@/lib/phase1-prompt";
import { buildPhase2Context } from "@/lib/phase2-prompt";
import { classifyPhase1, classifyPhase2 } from "@/lib/claude";
import {
  getSupabaseClient,
  getEngagementHistory,
  getActiveEvents,
  getActivePrograms,
  getAwsRelationships,
  getPartner,
} from "@/lib/supabase";
import type { Message } from "@/lib/types";

/**
 * POST /api/debug/classify-two-phase
 *
 * Run the full two-phase classification pipeline on given messages
 * WITHOUT persisting any results. For side-by-side comparison testing.
 *
 * Body: { "message_ids": ["uuid1", ...], "forwarder_note": "optional" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message_ids, forwarder_note } = body as {
      message_ids: string[];
      forwarder_note?: string | null;
    };

    if (!message_ids || message_ids.length === 0) {
      return NextResponse.json(
        { error: "message_ids is required and must be non-empty" },
        { status: 400 }
      );
    }

    // Fetch messages
    const db = getSupabaseClient();
    const { data: messages, error: fetchErr } = await db
      .from("messages")
      .select("*")
      .in("id", message_ids);

    if (fetchErr || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Failed to fetch messages", details: fetchErr?.message },
        { status: 404 }
      );
    }

    // ── Phase 1: Match ──────────────────────────────────────────
    let phase1Context: string;
    try {
      phase1Context = await buildPhase1Context(
        messages as Message[],
        forwarder_note
      );
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to build Phase 1 context",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    let phase1Result;
    try {
      phase1Result = await classifyPhase1(messages as Message[], phase1Context);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Phase 1 classification failed",
          details: err instanceof Error ? err.message : "Unknown error",
          debug: { phase1_context_length: phase1Context.length },
        },
        { status: 500 }
      );
    }

    console.log("Phase 1 result:", JSON.stringify(phase1Result, null, 2));

    // If noise, return early
    if (phase1Result.content_type === "noise") {
      return NextResponse.json({
        phase1: phase1Result,
        phase2: null,
        debug: {
          phase1_context_length: phase1Context.length,
          phase2_context_length: 0,
          history_message_count: 0,
          matched_engagement: null,
          is_new: false,
          note: "Classified as noise, Phase 2 skipped",
        },
      });
    }

    // ── Between phases: fetch data for Phase 2 ──────────────────
    const engagementId = phase1Result.engagement_match.id;
    const partnerId = phase1Result.engagement_match.partner_id;
    const isNew = phase1Result.engagement_match.is_new;

    const [history, matchedPartner, events, programs, relationships] =
      await Promise.all([
        engagementId && !isNew
          ? getEngagementHistory(engagementId)
          : Promise.resolve(null),
        partnerId ? getPartner(partnerId) : Promise.resolve(null),
        getActiveEvents(),
        getActivePrograms(),
        getAwsRelationships(),
      ]);

    // ── Phase 2: Analyze ────────────────────────────────────────
    const phase2Context = buildPhase2Context(
      messages as Message[],
      phase1Result,
      history,
      { events, programs, relationships },
      matchedPartner,
      forwarder_note
    );

    let phase2Result;
    try {
      phase2Result = await classifyPhase2(phase2Context);
    } catch (err) {
      // Phase 2 failed but Phase 1 succeeded — return what we have
      return NextResponse.json({
        phase1: phase1Result,
        phase2: null,
        debug: {
          phase1_context_length: phase1Context.length,
          phase2_context_length: phase2Context.length,
          history_message_count: history?.messages.length ?? 0,
          matched_engagement:
            phase1Result.engagement_match.name || null,
          is_new: isNew,
          phase2_error:
            err instanceof Error ? err.message : "Unknown error",
        },
      });
    }

    console.log("Phase 2 result:", JSON.stringify(phase2Result, null, 2));

    return NextResponse.json({
      phase1: phase1Result,
      phase2: phase2Result,
      debug: {
        phase1_context_length: phase1Context.length,
        phase2_context_length: phase2Context.length,
        history_message_count: history?.messages.length ?? 0,
        matched_engagement:
          phase1Result.engagement_match.name || null,
        is_new: isNew,
      },
    });
  } catch (error) {
    console.error("Debug classify-two-phase error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/debug/classify-two-phase
 *
 * List the 20 most recent messages for easy ID picking.
 */
export async function GET() {
  try {
    const db = getSupabaseClient();

    const { data, error } = await db
      .from("messages")
      .select("id, subject, sender_email, sent_at, forwarded_at, engagement_id, content_type")
      .order("forwarded_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch messages", details: error.message },
        { status: 500 }
      );
    }

    // Look up engagement names for classified messages
    const engagementIds = [
      ...new Set(
        (data ?? [])
          .map((m: { engagement_id: string | null }) => m.engagement_id)
          .filter(Boolean) as string[]
      ),
    ];

    let engagementNames: Record<string, string> = {};
    if (engagementIds.length > 0) {
      const { data: engs } = await db
        .from("engagements")
        .select("id, name")
        .in("id", engagementIds);

      if (engs) {
        engagementNames = Object.fromEntries(
          engs.map((e: { id: string; name: string }) => [e.id, e.name])
        );
      }
    }

    return NextResponse.json({
      recent_messages: (data ?? []).map(
        (m: {
          id: string;
          subject: string | null;
          sender_email: string | null;
          sent_at: string | null;
          forwarded_at: string;
          engagement_id: string | null;
          content_type: string | null;
        }) => ({
          id: m.id,
          subject: m.subject,
          sender: m.sender_email,
          date: m.sent_at,
          forwarded_at: m.forwarded_at,
          engagement: m.engagement_id
            ? engagementNames[m.engagement_id] ?? null
            : null,
          content_type: m.content_type,
        })
      ),
    });
  } catch (error) {
    console.error("Debug list messages error:", error);
    return NextResponse.json(
      { error: "Failed to list messages" },
      { status: 500 }
    );
  }
}
