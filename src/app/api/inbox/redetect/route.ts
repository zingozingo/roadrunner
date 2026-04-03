import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db";
import { detectPartnerFromEmail, detectPartnerFromSubject } from "@/lib/partner-detection";
import { INBOX_GROUP_WINDOW_MS } from "@/lib/db/inbox";

/**
 * GET /api/inbox/redetect
 * Re-run partner detection on all unrouted messages that have no partner_id.
 * Groups messages the same way the inbox does (timestamp proximity), runs
 * domain matching across all messages + subject fallback, and stamps partner_id.
 * Idempotent — skips messages that already have a partner_id.
 */
export async function GET() {
  const db = getSupabaseClient();

  // Fetch all unrouted messages without a partner
  const { data: messages, error } = await db
    .from("messages")
    .select("id, sender_email, subject, body_text, forwarded_at, partner_id")
    .is("engagement_id", null)
    .is("partner_id", null)
    .or("content_type.is.null,content_type.neq.noise")
    .order("forwarded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json({ message: "No unmatched inbox messages", updated: 0 });
  }

  // Group by timestamp proximity (same logic as InboxClient)
  type Msg = typeof messages[number];
  const sorted = [...messages].sort(
    (a, b) => new Date(b.forwarded_at).getTime() - new Date(a.forwarded_at).getTime()
  );

  const groups: Msg[][] = [];
  let current: Msg[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].forwarded_at).getTime();
    const currTime = new Date(sorted[i].forwarded_at).getTime();

    if (Math.abs(currTime - prevTime) <= INBOX_GROUP_WINDOW_MS) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);

  // Run detection on each group
  const results: { partner: string; messageCount: number }[] = [];

  for (const group of groups) {
    let detected: { partnerId: string; partnerName: string } | null = null;

    // Try domain matching across all messages in the group
    for (const msg of group) {
      detected = await detectPartnerFromEmail(
        msg.sender_email ?? "",
        null,
        null,
        msg.body_text ?? null
      );
      if (detected) break;
    }

    // Fallback: subject-line matching
    if (!detected && group[0].subject) {
      detected = await detectPartnerFromSubject(group[0].subject);
    }

    if (detected) {
      const groupIds = group.map((m) => m.id);
      await db
        .from("messages")
        .update({ partner_id: detected.partnerId })
        .in("id", groupIds);

      // Also stamp any linked meetings
      await db
        .from("meetings")
        .update({ partner_id: detected.partnerId })
        .in("message_id", groupIds)
        .is("partner_id", null);

      results.push({ partner: detected.partnerName, messageCount: groupIds.length });
    }
  }

  const totalUpdated = results.reduce((sum, r) => sum + r.messageCount, 0);

  console.log(`[REDETECT] ${results.length} groups matched, ${totalUpdated} messages updated:`);
  for (const r of results) {
    console.log(`  ${r.messageCount} messages → ${r.partner}`);
  }

  return NextResponse.json({
    message: `Re-detected ${results.length} groups, ${totalUpdated} messages updated`,
    groups: groups.length,
    matched: results,
    unmatched: groups.length - results.length,
  });
}
