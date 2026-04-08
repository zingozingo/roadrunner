import { NextRequest, NextResponse } from "next/server";
import {
  getProgramById,
  updateProgram,
  deleteProgram,
} from "@/lib/db";
import { VALID_PROGRAM_CATEGORIES, validateEnum } from "@/lib/validation";

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

    return NextResponse.json({ program });
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
    const { name, category, description, requirements } = body;

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

    if (category !== undefined && category !== null) {
      const err = validateEnum("category", category, VALID_PROGRAM_CATEGORIES);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category || null;
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

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/programs/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete program: ${message}` },
      { status: 500 }
    );
  }
}
