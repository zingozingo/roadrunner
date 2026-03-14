import { NextRequest, NextResponse } from "next/server";
import {
  getRelationship,
  getEngagementsByRelationship,
  updateRelationship,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const relationship = await getRelationship(id);

    if (!relationship) {
      return NextResponse.json(
        { error: "Relationship not found" },
        { status: 404 }
      );
    }

    const linkedEngagements = await getEngagementsByRelationship(id);

    return NextResponse.json({ relationship, linkedEngagements });
  } catch (error) {
    console.error("GET /api/relationships/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch relationship" },
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
    const { notes, contacts } = body;

    const existing = await getRelationship(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Relationship not found" },
        { status: 404 }
      );
    }

    if (contacts !== undefined && contacts !== null && !Array.isArray(contacts)) {
      return NextResponse.json(
        { error: "contacts must be an array or null" },
        { status: 400 }
      );
    }

    const updates: { notes?: string | null; contacts?: typeof contacts } = {};
    if (notes !== undefined) updates.notes = notes || null;
    if (contacts !== undefined) updates.contacts = contacts;

    const updated = await updateRelationship(id, updates);

    return NextResponse.json({ relationship: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/relationships/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update relationship: ${message}` },
      { status: 500 }
    );
  }
}
