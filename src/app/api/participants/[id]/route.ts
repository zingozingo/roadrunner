import { NextRequest, NextResponse } from "next/server";
import { getParticipantById, updateParticipant } from "@/lib/supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, title, organization } = body;

    if (
      name === undefined &&
      email === undefined &&
      title === undefined &&
      organization === undefined
    ) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 }
      );
    }

    const existing = await getParticipantById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    const updated = await updateParticipant(id, {
      name,
      email,
      title,
      organization,
    });

    return NextResponse.json({ participant: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/participants/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update participant: ${message}` },
      { status: 500 }
    );
  }
}
