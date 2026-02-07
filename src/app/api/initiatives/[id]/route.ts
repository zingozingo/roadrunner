import { NextRequest, NextResponse } from "next/server";
import {
  getInitiativeById,
  getMessagesByInitiative,
  getParticipantsByInitiative,
  getEntityLinksForEntity,
} from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const initiative = await getInitiativeById(id);

    if (!initiative) {
      return NextResponse.json(
        { error: "Initiative not found" },
        { status: 404 }
      );
    }

    const [messages, participants, entityLinks] = await Promise.all([
      getMessagesByInitiative(id),
      getParticipantsByInitiative(id),
      getEntityLinksForEntity("initiative", id),
    ]);

    return NextResponse.json({
      initiative,
      messages,
      participants,
      entityLinks,
    });
  } catch (error) {
    console.error("GET /api/initiatives/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch initiative" },
      { status: 500 }
    );
  }
}
