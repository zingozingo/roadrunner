import { NextRequest, NextResponse } from "next/server";
import { getInitiativeById, createParticipantWithLink } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, title, organization, role } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Verify initiative exists
    const initiative = await getInitiativeById(id);
    if (!initiative) {
      return NextResponse.json(
        { error: "Initiative not found" },
        { status: 404 }
      );
    }

    const participant = await createParticipantWithLink(
      {
        name: name.trim(),
        email: email?.trim() || null,
        title: title?.trim() || null,
        organization: organization?.trim() || null,
      },
      id,
      role?.trim() || null
    );

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/initiatives/[id]/participants error:", message);
    return NextResponse.json(
      { error: `Failed to add participant: ${message}` },
      { status: 500 }
    );
  }
}
