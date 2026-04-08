import { NextRequest, NextResponse } from "next/server";
import {
  getPartner,
  getEngagementsByPartner,
  getMeetingsByPartner,
  updatePartnerRecord,
  deletePartnerRecord,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partner = await getPartner(id);

    if (!partner) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const [engagements, meetings] = await Promise.all([
      getEngagementsByPartner(id),
      getMeetingsByPartner(id),
    ]);

    return NextResponse.json({
      partner,
      engagements,
      meetings,
    });
  } catch (error) {
    console.error("GET /api/partners/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch partner" },
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

    const existing = await getPartner(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.segment !== undefined) updates.segment = body.segment || null;
    if (body.focus_area !== undefined) updates.focus_area = Array.isArray(body.focus_area) ? body.focus_area : [];
    if (body.aws_stickiness !== undefined) updates.aws_stickiness = body.aws_stickiness || null;
    if (body.key_aws_services !== undefined) updates.key_aws_services = Array.isArray(body.key_aws_services) ? body.key_aws_services : [];

    const data = await updatePartnerRecord(id, updates);

    return NextResponse.json({ partner: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/partners/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update partner: ${message}` },
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

    const existing = await getPartner(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    await deletePartnerRecord(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/partners/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete partner: ${message}` },
      { status: 500 }
    );
  }
}
