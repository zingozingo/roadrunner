import { NextRequest, NextResponse } from "next/server";
import { getPartnerContext, addPartnerContext, deletePartnerContext } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entries = await getPartnerContext(id);
    return NextResponse.json(entries);
  } catch (err) {
    console.error("Failed to fetch partner context:", err);
    return NextResponse.json(
      { error: "Failed to fetch partner context" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const entry = await addPartnerContext({
      partner_id: id,
      content: body.content.trim(),
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("Failed to add partner context:", err);
    return NextResponse.json(
      { error: "Failed to add partner context" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();

    if (!body.contextId || typeof body.contextId !== "string") {
      return NextResponse.json(
        { error: "contextId is required" },
        { status: 400 }
      );
    }

    await deletePartnerContext(body.contextId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete partner context:", err);
    return NextResponse.json(
      { error: "Failed to delete partner context" },
      { status: 500 }
    );
  }
}
