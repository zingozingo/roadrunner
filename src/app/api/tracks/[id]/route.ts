import { NextRequest, NextResponse } from "next/server";
import {
  getTrackById,
  getLinkedInitiativesForEntity,
  updateTrack,
  deleteTrack,
} from "@/lib/supabase";

const VALID_STATUSES = new Set(["active", "archived"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const track = await getTrackById(id);

    if (!track) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      );
    }

    const linkedInitiatives = await getLinkedInitiativesForEntity("program", id);

    return NextResponse.json({ track, linkedInitiatives });
  } catch (error) {
    console.error("GET /api/tracks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch track" },
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
    const { name, description, eligibility, url, status } = body;

    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: active, archived` },
        { status: 400 }
      );
    }

    const existing = await getTrackById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (eligibility !== undefined) updates.eligibility = eligibility || null;
    if (url !== undefined) updates.url = url || null;
    if (status !== undefined) updates.status = status;

    const updated = await updateTrack(id, updates);

    return NextResponse.json({ track: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/tracks/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update track: ${message}` },
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

    const existing = await getTrackById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      );
    }

    await deleteTrack(id);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/tracks/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete track: ${message}` },
      { status: 500 }
    );
  }
}
