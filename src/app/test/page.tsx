import TestClient from "./TestClient";

export const dynamic = "force-dynamic";

export default function TestPage() {
  return (
    <div className="p-6 lg:p-8">
      <TestClient />
    </div>
  );
}
