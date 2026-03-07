import { NextRequest, NextResponse } from "next/server";
import { getOpenTasks, getTasksByPartner } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const partnerId = sp.get("partnerId");
    const status = sp.get("status") as "open" | "done" | "cancelled" | null;

    if (partnerId) {
      const tasks = await getTasksByPartner(partnerId, {
        status: status ?? "open",
      });
      return NextResponse.json({ tasks });
    }

    // Cross-partner open tasks view
    const tasks = await getOpenTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET /api/notes/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
