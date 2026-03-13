import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getMeetingNote } from "@/lib/db";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const note = await getMeetingNote(id);
  if (!note) notFound();

  if (note.meeting_id) {
    redirect(`/meetings/${note.meeting_id}`);
  }

  redirect(`/partners/${note.partner_id}`);
}
