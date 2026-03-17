import { NextResponse } from "next/server";

/**
 * POST /api/classify
 * Batch classification is no longer used — routing is now user-initiated via inbox resolve.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Batch classification has been removed. Use POST /api/reviews/resolve instead." },
    { status: 410 }
  );
}

/**
 * GET /api/classify
 * Queue status is no longer applicable — use GET /api/inbox/count instead.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Classification queue has been removed. Use GET /api/inbox/count instead." },
    { status: 410 }
  );
}
