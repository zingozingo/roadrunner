import { NextResponse } from "next/server";
import {
  getUnroutedPartnerlessMessages,
  stampPartnerOnMessages,
  stampPartnerOnMeetingsByMessageIds,
} from "@/lib/db";
import { detectPartnerFromEmail, detectPartnerFromSubject } from "@/lib/partner-detection";
import { INBOX_GROUP_WINDOW_MS } from "@/lib/db/inbox";

/**
 * GET /api/inbox/redetect
 * Re-run partner detection on all unrouted messages that have no partner_id.
 */
export async function GET() {
  const messages = await getUnroutedPartnerlessMessages();

  if (messages.length === 0) {
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

    for (const msg of group) {
      detected = await detectPartnerFromEmail(
        msg.sender_email ?? "",
        null,
        null,
        msg.body_text ?? null
      );
      if (detected) break;
    }

    if (!detected && group[0].subject) {
      detected = await detectPartnerFromSubject(group[0].subject);
    }

    if (detected) {
      const groupIds = group.map((m) => m.id);
      await stampPartnerOnMessages(groupIds, detected.partnerId);
      await stampPartnerOnMeetingsByMessageIds(groupIds, detected.partnerId);
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
