import { redirect } from "next/navigation";

export default async function InitiativeDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/engagements/${id}`);
}
