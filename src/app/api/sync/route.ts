import { NextRequest, NextResponse } from "next/server";
import { syncAllCatalogs, syncEntity } from "@/lib/sync";
import { VALID_SYNC_ENTITIES, validateEnum } from "@/lib/validation";

export async function POST(request: NextRequest) {
  // Check for Airtable API key
  if (!process.env.AIRTABLE_API_KEY) {
    return NextResponse.json(
      { error: "AIRTABLE_API_KEY environment variable is not configured" },
      { status: 500 }
    );
  }

  try {
    const entity = request.nextUrl.searchParams.get("entity");

    if (entity) {
      const err = validateEnum("entity", entity, VALID_SYNC_ENTITIES);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const result = entity
      ? await syncEntity(entity as "partners" | "programs" | "events" | "engagements" | "meetings")
      : await syncAllCatalogs();

    console.log("Sync completed:", JSON.stringify(result));

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/sync error:", message);
    return NextResponse.json(
      { error: `Sync failed: ${message}` },
      { status: 500 }
    );
  }
}
