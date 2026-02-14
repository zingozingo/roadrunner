import { NextRequest, NextResponse } from "next/server";
import { classifyMessage, ClassifyContext, ForwarderContext } from "@/lib/claude";
import {
  getActiveEngagements,
  getActiveEvents,
  getActivePrograms,
  getSupabaseClient,
} from "@/lib/supabase";
import { Message } from "@/lib/types";

// ============================================================
// POST /api/classify/test
//
// Dev/testing endpoint for running classification in isolation.
// Calls classifyMessage() directly — ZERO side effects.
// No DB writes, no SMS, no approval queue, no message updates.
//
// Two modes:
//   Mode A (raw text):      { text, subject?, fromName?, fromEmail?, ... }
//   Mode B (existing msg):  { messageId }
//
// Both modes accept optional context override:
//   { context: { engagements, events, programs } }
//
// If context is omitted, live DB context is fetched (read-only).
// ============================================================

export async function POST(request: NextRequest) {
  const start = performance.now();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    text,
    subject,
    date,
    // New structured fields
    forwarderName,
    forwarderEmail,
    fromName,
    fromEmail,
    to,
    cc,
    // Legacy fields (still supported for curl / backward compat)
    sender,
    senderEmail,
    messageId,
    context: contextOverride,
  } = body as {
    text?: string;
    subject?: string;
    date?: string;
    forwarderName?: string;
    forwarderEmail?: string;
    fromName?: string;
    fromEmail?: string;
    to?: string;
    cc?: string;
    sender?: string;
    senderEmail?: string;
    messageId?: string;
    context?: ClassifyContext;
  };

  // Validate: must provide either text or messageId, not both
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasMessageId = typeof messageId === "string" && messageId.trim().length > 0;

  if (!hasText && !hasMessageId) {
    return NextResponse.json(
      { error: "Provide either 'text' (raw email body) or 'messageId' (existing message UUID)" },
      { status: 400 }
    );
  }

  if (hasText && hasMessageId) {
    return NextResponse.json(
      { error: "Provide 'text' or 'messageId', not both" },
      { status: 400 }
    );
  }

  try {
    // Build the message(s) to classify
    let messages: Message[];
    let mode: "raw" | "existing";

    // Resolve sender fields: prefer new fromName/fromEmail, fall back to legacy sender/senderEmail
    const resolvedSenderName = fromName ?? sender ?? null;
    const resolvedSenderEmail = fromEmail ?? senderEmail ?? null;

    if (hasText) {
      mode = "raw";

      // Build the body text with email headers for Claude to see
      let fullBody = text as string;
      if (to || cc) {
        const headerLines: string[] = [];
        if (to) headerLines.push(`To: ${to}`);
        if (cc) headerLines.push(`CC: ${cc}`);
        fullBody = headerLines.join("\n") + "\n\n" + fullBody;
      }

      messages = [
        {
          id: "test-00000000-0000-0000-0000-000000000000",
          engagement_id: null,
          sender_name: resolvedSenderName,
          sender_email: resolvedSenderEmail,
          sent_at: date ?? new Date().toISOString(),
          subject: (subject as string) ?? null,
          body_text: fullBody,
          body_raw: null,
          content_type: null,
          classification_confidence: null,
          linked_entities: [],
          forwarded_at: new Date().toISOString(),
          pending_review: false,
          classification_result: null,
        },
      ];
    } else {
      mode = "existing";
      const db = getSupabaseClient();
      const { data, error } = await db
        .from("messages")
        .select("*")
        .eq("id", messageId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: `Message not found: ${messageId}` },
          { status: 404 }
        );
      }

      messages = [data as Message];
    }

    // Build classification context — use override or fetch live from DB
    let context: ClassifyContext;

    if (contextOverride) {
      context = {
        engagements: contextOverride.engagements ?? [],
        events: contextOverride.events ?? [],
        programs: contextOverride.programs ?? [],
      };
    } else {
      const [engagements, events, programs] = await Promise.all([
        getActiveEngagements(),
        getActiveEvents(),
        getActivePrograms(),
      ]);
      context = { engagements, events, programs };
    }

    // Build forwarder context if provided
    const forwarderContext: ForwarderContext | undefined =
      forwarderName && forwarderEmail
        ? { name: forwarderName, email: forwarderEmail }
        : undefined;

    // Run classification — pure function, no side effects
    const result = await classifyMessage(messages, context, forwarderContext);

    const processingTimeMs = Math.round(performance.now() - start);

    return NextResponse.json({
      result,
      meta: {
        mode,
        contextStats: {
          engagements: context.engagements.length,
          events: context.events.length,
          programs: context.programs.length,
        },
        processingTimeMs,
      },
    });
  } catch (error) {
    console.error("Test classification error:", error);
    return NextResponse.json(
      {
        error: "Classification failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
