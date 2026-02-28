import { NextRequest, NextResponse } from "next/server";
import {
  getProgramById,
  getLinkedEngagementsForEntity,
  updateProgram,
  deleteProgram,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const program = await getProgramById(id);

    if (!program) {
      return NextResponse.json(
        { error: "Program not found" },
        { status: 404 }
      );
    }

    const linkedEngagements = await getLinkedEngagementsForEntity("program", id);

    return NextResponse.json({ program, linkedEngagements });
  } catch (error) {
    console.error("GET /api/programs/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch program" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, description, requirements } = body;

    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    const existing = await getProgramById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Program not found" },
        { status: 404 }
      );
    }

    const VALID_TYPES = new Set(["Competency", "Service Ready", "SCA", "Program", "Credit Program", "Funding", "Channel", "Enablement"]);
    if (type !== undefined && type !== null && !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Invalid type "${type}". Must be one of: ${[...VALID_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type || null;
    if (description !== undefined) updates.description = description || null;
    if (requirements !== undefined) updates.requirements = requirements || null;

    const updated = await updateProgram(id, updates);

    return NextResponse.json({ program: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/programs/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update program: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getProgramById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Program not found" },
        { status: 404 }
      );
    }

    await deleteProgram(id);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/programs/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete program: ${message}` },
      { status: 500 }
    );
  }
}
