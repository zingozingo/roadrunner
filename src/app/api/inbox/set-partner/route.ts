import { NextRequest, NextResponse } from "next/server";
import { getPartner, setPartnerForInboxGroup } from "@/lib/db";

interface SetPartnerRequest {
  message_id: string;
  partner_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SetPartnerRequest;
    const { message_id, partner_id } = body;

    if (!message_id || !partner_id) {
      return NextResponse.json(
        { error: "message_id and partner_id are required" },
        { status: 400 }
      );
    }

    // Validate partner exists
    const partner = await getPartner(partner_id);
    if (!partner) {
      return NextResponse.json(
        { error: `Partner ${partner_id} not found` },
        { status: 404 }
      );
    }

    const { updatedMessages } = await setPartnerForInboxGroup(message_id, partner_id);

    return NextResponse.json({
      success: true,
      partner_name: partner.name,
      updated_messages: updatedMessages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Set partner failed:", message);
    return NextResponse.json(
      { error: `Failed to set partner: ${message}` },
      { status: 500 }
    );
  }
}
