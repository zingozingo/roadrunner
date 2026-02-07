export default async function InitiativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Initiative Detail</h1>
      <p className="mt-2 text-gray-600">Initiative ID: {id}</p>
    </main>
  );
}
