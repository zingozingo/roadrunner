import { NextRequest, NextResponse } from "next/server";
import { getOpenTasks, getTasksByPartner, getSupabaseClient } from "@/lib/db";

const VALID_OWNERS = new Set(["me", "internal", "partner", "third_party"]);

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partner_id, description, owner, owner_name, due_date } = body;

    if (!partner_id || typeof partner_id !== "string") {
      return NextResponse.json(
        { error: "partner_id is required" },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    if (!owner || !VALID_OWNERS.has(owner)) {
      return NextResponse.json(
        { error: `owner must be one of: ${[...VALID_OWNERS].join(", ")}` },
        { status: 400 }
      );
    }

    const db = getSupabaseClient();
    const { data, error } = await db
      .from("tasks")
      .insert({
        partner_id,
        description: description.trim(),
        owner,
        owner_name: owner_name?.trim() || null,
        due_date: due_date || null,
        status: "open",
        origin: "manual",
        meeting_note_id: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
