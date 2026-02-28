import { NextRequest, NextResponse } from "next/server";
import {
  getAwsRelationship,
  getEngagementsByAwsRelationship,
  updateAwsRelationship,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const relationship = await getAwsRelationship(id);

    if (!relationship) {
      return NextResponse.json(
        { error: "Relationship not found" },
        { status: 404 }
      );
    }

    const linkedEngagements = await getEngagementsByAwsRelationship(id);

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
    const { notes, primary_contact_email, aws_contact_emails } = body;

    const existing = await getAwsRelationship(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Relationship not found" },
        { status: 404 }
      );
    }

    if (aws_contact_emails !== undefined && !Array.isArray(aws_contact_emails)) {
      return NextResponse.json(
        { error: "aws_contact_emails must be an array" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (notes !== undefined) updates.notes = notes || null;
    if (primary_contact_email !== undefined) updates.primary_contact_email = primary_contact_email || null;
    if (aws_contact_emails !== undefined) updates.aws_contact_emails = aws_contact_emails;

    const updated = await updateAwsRelationship(id, updates);

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
