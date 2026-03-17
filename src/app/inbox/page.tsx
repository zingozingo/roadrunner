import PageHeader from "@/components/layout/PageHeader";
import InboxClient from "@/components/inbox/InboxClient";
import { getInboxItems } from "@/lib/db";
import type { InboxItem } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const inboxItems = await getInboxItems();

  // Transform InboxItem[] → shape InboxClient expects (approval-shaped)
  // This is a temporary bridge — Phase B rewrites InboxClient entirely
  const approvals = inboxItems.map((item: InboxItem) => ({
    id: item.id,
    type: "new_engagement" as const,
    message_id: item.id,
    engagement_id: null,
    classification_result: null,
    resolved: false,
    resolution: null,
    resolved_at: null,
    created_at: item.forwarded_at,
    message: {
      id: item.id,
      sender_name: item.sender_name,
      sender_email: item.sender_email,
      subject: item.subject,
      body_text: item.body_text,
      body_html: null,
      sent_at: item.forwarded_at,
      forwarded_at: item.forwarded_at,
      engagement_id: null,
      content_type: item.content_type,
      classification_confidence: null,
      classification_result: null,
      pending_review: true,
      forwarder_note: item.forwarder_note,
      to_header: null,
      cc_header: null,
      partner_id: item.partner_id,
    },
    engagement: null,
  }));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inbox"
        subtitle="Review and route unassigned messages to engagements"
      />
      <InboxClient initialApprovals={approvals} />
    </div>
  );
}
