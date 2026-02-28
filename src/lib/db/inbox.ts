import { getSupabaseClient } from "./client";
import { ApprovalQueueItem, ClassificationResult, Message, Engagement } from "../types";

export async function createApproval(data: {
  type: ApprovalQueueItem["type"];
  message_id?: string | null;
  engagement_id?: string | null;
  classification_result?: ClassificationResult | null;
}): Promise<ApprovalQueueItem> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_queue")
    .insert({
      type: data.type,
      message_id: data.message_id ?? null,
      engagement_id: data.engagement_id ?? null,
      classification_result: data.classification_result ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create approval: ${error.message}`);
  return row as ApprovalQueueItem;
}

export async function getUnresolvedApprovals(): Promise<
  (ApprovalQueueItem & { message: Message | null; engagement: Engagement | null })[]
> {
  const { data, error } = await getSupabaseClient()
    .from("approval_queue")
    .select("*, message:messages(*), engagement:engagements(*)")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch approvals: ${error.message}`);
  return (data ?? []) as (ApprovalQueueItem & {
    message: Message | null;
    engagement: Engagement | null;
  })[];
}

export async function getUnresolvedApprovalCount(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("approval_queue")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  if (error) throw new Error(`Failed to count approvals: ${error.message}`);
  return count ?? 0;
}

export async function resolveApproval(
  id: string,
  resolution: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("approval_queue")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution,
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to resolve approval: ${error.message}`);
}
